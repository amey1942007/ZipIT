# ZipIT

Static site for the ARIESxROBOTICSxEES fresher tech group challenge at IIT Delhi. Teams write a Python heuristic for LinkedIn's Zip puzzle. Official scores are written by a separate scorer. This site does not grade.

The app is a Vite + React + TypeScript SPA. It is published with GitHub Pages at `https://amey1942007.github.io/ZipIT/`.

## Setup

Node.js 24 is required (see `.nvmrc` and `package.json` `engines`).

```bash
nvm use
npm ci
npm run dev
```

Other scripts: `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build`, `npm run preview`.

`npm run dev` serves http://localhost:5173. `npm run preview` serves http://localhost:4173. The admin edge function's CORS allowlist includes those two origins and `https://amey1942007.github.io`.

## Environment variables

Copy `.env.example` to `.env.local` for local development. All three names are optional for a local build. If either Supabase value is missing, the build still succeeds and the app shows **backend not configured** instead of crashing.

| Name | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (`https://uvnmysivplivpvdcbbtp.supabase.co`). Public by design. Read from the environment at build time; it is not hard-coded in the client. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key. Public by design. Set it in the environment or as an Actions variable. Do not commit the key. |
| `VITE_PLAYGROUND_URL` | Placeholder link for the Code Playground button. |

Never commit `.env`, `.env.local`, a service-role key, or any scorer credential. The browser only ever receives the publishable key, and only because Vite inlines `VITE_*` variables at build time.

## GitHub Pages

An admin does this once. This repository does not change those settings.

1. Settings → Pages → Build and deployment → Source = **GitHub Actions**.
2. Settings → Secrets and variables → Actions → **Variables** (not secrets):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

`VITE_PLAYGROUND_URL` can be added as a variable later, when the playground link exists. The deploy workflow already passes the two Supabase variables into the build. A missing variable does not fail the build.

Pushes to `main` run `.github/workflows/deploy.yml`. Pull requests run `.github/workflows/ci.yml` (install, typecheck, lint, test, build) with read-only permissions.

## Routes

The app uses `HashRouter` from `react-router`, so Pages does not need a rewrite. Opening the site with no hash lands on Login (`#/login`). The other stubs are Home (`#/`), Profile, Submissions, Leaderboard, Arena, and Admin.

## Submissions and the Mac mini scorer

A submission is two files, following the ZipIt_ARIES engine contract:

- `search.py`: `class Score` with `score(self, node, board) -> number` (higher expands first) and an optional `prune(self, node, board) -> bool`.
- `tiebreaker.py`: `class TieBreaker` with `key(self, node, board) -> tuple` (the greater key wins a tie).

The browser uploads both files to the private `submissions` bucket at `{team_id}/{submission_id}/search.py` and `{team_id}/{submission_id}/tiebreaker.py`, then inserts one `submissions` row (`file_path`, `tiebreaker_path`, `status = 'queued'`). At most **3** rows may be `queued` or `running` across all teams (`enforce_queue_cap`). `scoring_queue_depth()` returns the current count.

The scorer runs on the Mac mini with the service key from its own environment, never from this repo. It processes **one submission at a time**:

1. Pick the oldest `queued` row and set `status = 'running'`.
2. Download `file_path` and `tiebreaker_path` into a fresh `submissions/submission_NN/` folder as `search.py` and `tiebreaker.py`.
3. Run the ZipIt_ARIES evaluation (`evaluate_submission`) on the event test set.
4. Write the result to the same row:

| Column | Value |
| --- | --- |
| `status` | `scored`, or `failed` when the files do not load or the run crashes |
| `score` | One number, higher is better: `solved * 1000 + speed_bonus`, where `speed_bonus` is 0 to 999 |
| `scored_at` | `now()` |
| `metrics` | JSON object: `set`, `boards`, `solved`, `total_time_s`, `total_expansions`, `total_backtracks` (extra keys are fine) |
| `error` | Short, participant-safe message when `failed` (no stack traces or paths) |

5. Delete the temporary folder.

Writing `status` or `score` refreshes the leaderboard and prunes old runs automatically (top 3 scored plus the latest per team). The Submissions page shows `metrics.solved`, `metrics.boards` and `metrics.total_time_s` when present.

## Pyodide

The Arena loads Python in a Web Worker from a self-hosted Pyodide 314.0.7 runtime. Those files are not committed. `scripts/fetch-pyodide.mjs` copies the browser runtime out of the pinned `pyodide` npm package into `public/pyodide/314.0.7/` on `postinstall` and again before `vite build`. Vite then publishes that directory with the site, so the worker never uses a CDN. `public/pyodide/` is gitignored.

The copied files are `pyodide.mjs`, `pyodide.asm.mjs`, `pyodide.asm.wasm`, `python_stdlib.zip`, and `pyodide-lock.json` (about 13 MB). The npm package is the version pin; committing the wasm as well would duplicate it in git history.
