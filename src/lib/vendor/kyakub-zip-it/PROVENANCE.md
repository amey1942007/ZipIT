# Provenance

Source: https://github.com/kyakub/zip-it-puzzle-game
Commit: `54f2a95dad1e4a0330aaf91f1e21f25e7276bde5`
License: MIT, Copyright (c) 2025 Kamran Yakub. See `./LICENSE`.

| This file | Original | Notes |
| --- | --- | --- |
| `hamiltonian.ts` | `scripts/pathfinder.js` lines 1–59 (`getNeighbors`, `shuffle`, `findHamiltonianPath`) | Ported to TypeScript. Adds a seeded tie-break, a node budget, and wall awareness. The worker message handler was not ported. |

Modified: ported to TypeScript. The initial ZipIT path is searched on an open grid; walls are applied later.
