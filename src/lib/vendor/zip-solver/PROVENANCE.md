# Provenance

Source: https://github.com/chi-feng/zip-solver
Commit: `1110841913eec0efb1044297e533e528ff1d09de`
License: MIT, Copyright (c) 2026 Chi Feng. See `./LICENSE`.

| This file | Original | Notes |
| --- | --- | --- |
| `solver.ts` | `solver.js` lines 25–164 (`buildNeighbors`, `solve`) | Ported to TypeScript. Elapsed time uses `performance.now`. |
| `solver.test.ts` | `test.js` | The original 14 checks, as one Vitest case. |

Modified: ported to TypeScript. The search stays equivalent to that commit.

The SVG grid in `app.js` (about lines 100–184) was not ported.
