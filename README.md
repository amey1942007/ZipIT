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

## Environment variables

Copy `.env.example` to `.env.local` for local development. All three names are optional for a local build. If either Supabase value is missing, the build still succeeds and the app shows **backend not configured** instead of crashing.

| Name | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL. Public by design. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key. Public by design. |
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
