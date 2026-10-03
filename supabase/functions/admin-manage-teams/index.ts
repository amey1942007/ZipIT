// ZipIT edge function: admin-manage-teams — v3 (migration 010: admin may reset team passwords).
// Deploy with verify_jwt = false: the function authenticates every request itself (same model as purge-storage),
// so the ops path can call it without any user JWT.
//
// Who may act:
//   1. Ops token  : header  x-zipit-ops-token: <token>   — checked with RPC verify_ops_token (Vault holds sha256 only)
//   2. Server key : header  Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>  — constant-time compare with the env key
//      -> create / reset_password / delete / lookup
//   3. Admin JWT (tony) -> reset_password only, and only for team accounts. Everything else: 403 admin_view_only.
// Everyone else is refused BEFORE the body is read:
//   * team / other JWT  -> 403 forbidden
//   * no / bad auth     -> 401 missing_auth / invalid_token / invalid_ops_token
//
// POST JSON { action: 'create' | 'reset_password' | 'delete' | 'lookup', username, team_name?, password?, reason? }
//   reason (1-500 chars) is required for create / reset_password / delete on the server path.
//   On the admin path it is optional and defaults to 'Admin website'.
// Every create / reset_password / delete writes an admin_audit row:
//   server path -> RPC server_audit (actor NULL, actor_kind/actor_label 'server', details.via 'ops_token' | 'service_role')
//   admin path  -> direct insert   (actor = admin uid, actor_kind/actor_label 'admin', details.via 'admin')
// Passwords (min 8 chars) are never returned or logged.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://amey1942007.github.io",
  "http://localhost:5173", // vite dev
  "http://localhost:4173", // vite preview
]);
const DEFAULT_ORIGIN = "https://amey1942007.github.io";
const USERNAME_RE = /^[a-z0-9_]{3,32}$/;
const MIN_PASSWORD = 8;
const ACTIONS = ["create", "reset_password", "delete", "lookup"] as const;
const ADMIN_ACTIONS: readonly Action[] = ["reset_password"];
type Action = (typeof ACTIONS)[number];
type Via = "ops_token" | "service_role" | "admin";

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // x-zipit-ops-token is deliberately NOT allowed from browsers: the ops path is server-to-server only.
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

// Constant-time equality: compare fixed-length digests with XOR accumulation (no early exit, no length leak).
async function safeEqual(a: string, b: string): Promise<boolean> {
  if (!a || !b) return false;
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false, error: "method_not_allowed" });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Who is calling? (decided before the body is read) ──
  let via: Via | null = null;
  let adminUid: string | null = null;
  const opsToken = (req.headers.get("x-zipit-ops-token") ?? "").trim();
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  if (opsToken) {
    const { data: valid, error: vErr } = await admin.rpc("verify_ops_token", { p: opsToken });
    if (vErr) {
      console.error("verify_ops_token failed", vErr.message);
      return json(req, 500, { ok: false, error: "verify_failed" });
    }
    if (valid !== true) return json(req, 401, { ok: false, error: "invalid_ops_token" });
    via = "ops_token";
  } else if (bearer && (await safeEqual(bearer, serviceKey))) {
    via = "service_role";
  } else if (bearer) {
    const { data: userData, error: userErr } = await admin.auth.getUser(bearer);
    if (userErr || !userData?.user) return json(req, 401, { ok: false, error: "invalid_token" });
    if (userData.user.app_metadata?.role !== "admin") return json(req, 403, { ok: false, error: "forbidden" });
    via = "admin";
    adminUid = userData.user.id;
  } else {
    return json(req, 401, { ok: false, error: "missing_auth" });
  }

  // ── Input ──
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { ok: false, error: "invalid_json" });
  }
  const action = body.action as Action;
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : undefined;
  let reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!ACTIONS.includes(action)) return json(req, 400, { ok: false, error: "invalid_action" });
  if (via === "admin" && !ADMIN_ACTIONS.includes(action)) {
    return json(req, 403, {
      ok: false,
      error: "admin_view_only",
      detail: "The admin account can only reset team passwords here. Team create / delete are done " +
        "by the organisers through the server path.",
    });
  }
  if (via === "admin" && !reason) reason = "Admin website";
  if (!USERNAME_RE.test(username)) {
    return json(req, 400, { ok: false, error: "invalid_username", detail: "must match ^[a-z0-9_]{3,32}$" });
  }
  if (action !== "lookup" && (reason.length < 1 || reason.length > 500)) {
    return json(req, 400, { ok: false, error: "invalid_reason", detail: "reason is required (1-500 characters)" });
  }

  // Returns true when the audit row was written. A failed audit is reported to the caller (audit_logged: false).
  const audit = async (a: string, teamId: string | null, details: Record<string, unknown>): Promise<boolean> => {
    if (via === "admin") {
      const { error } = await admin.from("admin_audit").insert({
        action: a, team_id: teamId, details: { ...details, via }, actor: adminUid,
        actor_kind: "admin", actor_label: "admin", reason,
      });
      if (error) console.error("audit failed", a, error.message);
      return !error;
    }
    const { error } = await admin.rpc("server_audit", {
      p_action: a, p_team: teamId, p_target: null, p_details: { ...details, via }, p_reason: reason,
    });
    if (error) console.error("audit failed", a, error.message);
    return !error;
  };

  // ── create ──
  if (action === "create") {
    const teamName = typeof body.team_name === "string" && body.team_name.trim() ? body.team_name.trim() : username;
    if (teamName.length < 2 || teamName.length > 40) {
      return json(req, 400, { ok: false, error: "invalid_team_name", detail: "2-40 characters" });
    }
    if (!password || password.length < MIN_PASSWORD) {
      return json(req, 400, { ok: false, error: "invalid_password", detail: `at least ${MIN_PASSWORD} characters` });
    }
    const { data: existing } = await admin.from("teams").select("id").eq("username", username).maybeSingle();
    if (existing) return json(req, 409, { ok: false, error: "username_taken" });

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: `${username}@zipit.local`,
      password,
      email_confirm: true,
      app_metadata: { role: "team" },
    });
    if (createErr || !created?.user) {
      const msg = createErr?.message ?? "create_failed";
      const status = /already|exists|registered/i.test(msg) ? 409 : 400;
      return json(req, status, { ok: false, error: "auth_create_failed", detail: msg });
    }
    const uid = created.user.id;
    const { error: teamErr } = await admin.from("teams").insert({ id: uid, username, team_name: teamName, role: "team" });
    if (teamErr) {
      await admin.auth.admin.deleteUser(uid); // roll back the auth user
      return json(req, 400, { ok: false, error: "team_insert_failed", detail: teamErr.message });
    }
    const logged = await audit("team_create", uid, { username, team_name: teamName });
    return json(req, 200, { ok: true, action, via, audit_logged: logged, team: { id: uid, username, team_name: teamName } });
  }

  // reset_password / delete / lookup: target must be an existing *team* (never the admin account)
  const { data: team, error: teamLookupErr } = await admin
    .from("teams").select("id, username, team_name, role, avatar_path, created_at").eq("username", username).maybeSingle();
  if (teamLookupErr) return json(req, 500, { ok: false, error: "lookup_failed", detail: teamLookupErr.message });
  if (!team) return json(req, 404, { ok: false, error: "team_not_found" });
  if (team.role !== "team") return json(req, 403, { ok: false, error: "not_a_team_account" });

  // ── lookup (read-only; used by dry runs) ──
  if (action === "lookup") {
    const [subs, reps, lb] = await Promise.all([
      admin.from("submissions").select("id, status, score, file_path, created_at").eq("team_id", team.id)
        .order("score", { ascending: false, nullsFirst: false }),
      admin.from("replays").select("id, submission_id").eq("team_id", team.id),
      admin.from("leaderboard").select("rank, best_score").eq("team_id", team.id).maybeSingle(),
    ]);
    const err = subs.error ?? reps.error ?? lb.error;
    if (err) return json(req, 500, { ok: false, error: "lookup_failed", detail: err.message });
    return json(req, 200, {
      ok: true, action, via,
      team: { id: team.id, username: team.username, team_name: team.team_name, role: team.role,
              avatar_path: team.avatar_path, created_at: team.created_at },
      submissions: subs.data ?? [], replays: reps.data ?? [], leaderboard: lb.data ?? null,
    });
  }

  // ── reset_password ──
  if (action === "reset_password") {
    if (!password || password.length < MIN_PASSWORD) {
      return json(req, 400, { ok: false, error: "invalid_password", detail: `at least ${MIN_PASSWORD} characters` });
    }
    const { error } = await admin.auth.admin.updateUserById(team.id, { password });
    if (error) return json(req, 400, { ok: false, error: "password_reset_failed", detail: error.message });
    const logged = await audit("team_password_reset", team.id, { username });
    return json(req, 200, { ok: true, action, via, audit_logged: logged, team: { id: team.id, username } });
  }

  // ── delete ──
  const { count, error: countErr } = await admin
    .from("submissions").select("id", { count: "exact", head: true }).eq("team_id", team.id);
  if (countErr) return json(req, 500, { ok: false, error: "count_failed", detail: countErr.message });
  const submissionsRemoved = count ?? 0;

  let avatarQueueId: number | null = null;
  if (team.avatar_path) {
    const { data: q, error: qErr } = await admin
      .from("storage_purge_queue").insert({ bucket: "avatars", path: team.avatar_path }).select("id").single();
    if (qErr) return json(req, 500, { ok: false, error: "queue_failed", detail: qErr.message });
    avatarQueueId = q.id;
  }

  // Cascade removes teams/submissions/replays/leaderboard rows; the submissions delete trigger queues their files.
  const { error: delErr } = await admin.auth.admin.deleteUser(team.id);
  if (delErr) {
    if (avatarQueueId !== null) await admin.from("storage_purge_queue").delete().eq("id", avatarQueueId);
    return json(req, 400, { ok: false, error: "delete_failed", detail: delErr.message });
  }
  const logged = await audit("team_delete", team.id, { username, team_name: team.team_name, submissions_removed: submissionsRemoved });
  return json(req, 200, {
    ok: true, action, via, audit_logged: logged, team: { id: team.id, username }, submissions_removed: submissionsRemoved,
  });
});
