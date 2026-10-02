// Adapted from ThVerg/AiZipSolve@63cfd1df3d4d83e6ecc69154d167ab47e6516ad1
// zipsolve/generator.py _backbite and _default_moves (MIT, Copyright (c) 2026 ThVerg). See ./LICENSE.

export function defaultMoves(n: number): number {
  return Math.floor(Math.max(1000, 30 * n * Math.sqrt(n)))
}

/**
 * Randomise a Hamiltonian path. Linking an endpoint to a neighbour and
 * reversing the tail stays on the graph.
 */
export function backbite(
  path: readonly number[],
  neighbors: readonly (readonly number[])[],
  rng: () => number,
  moves: number,
): number[] {
  const next = path.slice()
  if (next.length < 3) return next
  for (let k = 0; k < moves; k++) {
    const flip = rng() < 0.5
    if (flip) next.reverse()
    const end = next[next.length - 1]!
    const options = neighbors[end] ?? []
    if (options.length > 0) {
      const chosen = options[Math.floor(rng() * options.length)]!
      if (chosen !== next[next.length - 2]) {
        const at = next.indexOf(chosen)
        if (at >= 0) {
          const reversed = next.slice(at + 1).reverse()
          next.splice(at + 1, next.length - at - 1, ...reversed)
        }
      }
    }
    if (flip) next.reverse()
  }
  return next
}
