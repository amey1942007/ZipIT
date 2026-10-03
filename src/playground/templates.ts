import { SEARCH_FILE, TIEBREAKER_FILE } from '@/lib/uploadChecks'

export type PlaygroundFile = typeof SEARCH_FILE | typeof TIEBREAKER_FILE

export const PLAYGROUND_FILES: PlaygroundFile[] = [SEARCH_FILE, TIEBREAKER_FILE]

export const SEARCH_TEMPLATE = `# search.py
# score() returns a number. The node with the HIGHEST score is expanded first.
# Optional: prune(self, node, board) -> bool. Return True to drop a node.
# Imports: helpers and the Python standard library only.


class Score:
    def score(self, node, board):
        raise NotImplementedError("write your heuristic here")
`

export const TIEBREAKER_TEMPLATE = `# tiebreaker.py
# key() returns a tuple of numbers or strings. On equal scores, the GREATER key
# is expanded first. The same node must always get the same key.


class TieBreaker:
    def key(self, node, board):
        raise NotImplementedError("write your tie-breaker here")
`

export const TEMPLATES: Record<PlaygroundFile, string> = {
  [SEARCH_FILE]: SEARCH_TEMPLATE,
  [TIEBREAKER_FILE]: TIEBREAKER_TEMPLATE,
}

export function isUnchanged(file: PlaygroundFile, text: string): boolean {
  return text.trim() === TEMPLATES[file].trim()
}
