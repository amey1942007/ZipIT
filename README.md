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

## Pyodide

The Arena loads Python in a Web Worker from a self-hosted Pyodide 314.0.7 runtime. Those files are not committed. `scripts/fetch-pyodide.mjs` copies the browser runtime out of the pinned `pyodide` npm package into `public/pyodide/314.0.7/` on `postinstall` and again before `vite build`. Vite then publishes that directory with the site, so the worker never uses a CDN. `public/pyodide/` is gitignored.

The copied files are `pyodide.mjs`, `pyodide.asm.mjs`, `pyodide.asm.wasm`, `python_stdlib.zip`, and `pyodide-lock.json` (about 13 MB). The npm package is the version pin; committing the wasm as well would duplicate it in git history.
