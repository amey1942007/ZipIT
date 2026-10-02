# Provenance

Source: https://github.com/ThVerg/AiZipSolve
Commit: `63cfd1df3d4d83e6ecc69154d167ab47e6516ad1`
License: MIT, Copyright (c) 2026 ThVerg. See `./LICENSE`.

| This file | Original (`zipsolve/generator.py`) | Notes |
| --- | --- | --- |
| `backbite.ts` | `_backbite` lines 287–313, `_default_moves` lines 316–317 | Ported to TypeScript. The RNG is `() => number`. Deadline, `fix_start`, and `target_end` were not ported. |
| `checkpoints.ts` | `default_num_checkpoints` lines 422–426, `place_checkpoints` lines 429–460 | Stratified interior checkpoints. The `avoid` path (`_place_avoiding`) was not ported. |
| `walls.ts` | `_add_walls` lines 1031–1041 | Wall keys use the solver's `a\|b` form. |
| `uniqueness.ts` | `_puzzle_from_path` uniqueness loop, lines 493–547 | The oracle is chi-feng's `solve({ limit: 2 })` instead of `_two_solutions`. |

Modified: ported to TypeScript. The torch and numpy server were not ported.
