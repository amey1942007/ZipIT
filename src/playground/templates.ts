import { SEARCH_FILE, TIEBREAKER_FILE } from '@/lib/uploadChecks'

export type PlaygroundFile = typeof SEARCH_FILE | typeof TIEBREAKER_FILE

export const PLAYGROUND_FILES: PlaygroundFile[] = [SEARCH_FILE, TIEBREAKER_FILE]

export const SEARCH_TEMPLATE = `"""search.py: your Score class."""

# The engine is a best-first search. Every step it expands the node with the
# HIGHEST score() first. Ties go to tiebreaker.py.
#
# node (one partial path, the "snake"):
#     node.head      flat index of the head cell
#     node.visited   bitmask of visited cells (node.is_visited(cell) -> bool)
#     node.next_cp   number of the next checkpoint to reach (starts at 2)
#     node.depth     cells in the path so far
#     node.path      list of flat indices from the start to the head
#
# board:
#     board.width, board.height, board.n (cells), board.num_checkpoints
#     board.idx(i, j) -> cell     board.rc(cell) -> (i, j)
#     board.adj[cell]             neighbours that are not behind a wall
#     board.manhattan(a, b)
#
# helpers (the only non-stdlib import allowed):
#     manhattan(board, a, b)                  grid distance
#     bfs_distance(board, src, dst, node)     shortest walk around visited cells, None if blocked
#     next_checkpoint(node, board)            cell of the next checkpoint
#     next_manhattan(node, board)             head to next checkpoint
#     unvisited_neighbors(node, board)        unvisited neighbours of the head
#     free_degree(node, board)                how many of those there are
#     unvisited_component_size(node, board)   unvisited cells reachable from the head
#     trapped_unvisited(node, board)          unvisited cells cut off from the head
#
# Optional: define prune(self, node, board) -> bool. Return True to drop a node.

from helpers import next_manhattan


class Score:
    name = "my_score"

    def score(self, node, board):
        # Higher score = expanded first. Start simple, then add bonuses and penalties.
        return -next_manhattan(node, board)
`

export const TIEBREAKER_TEMPLATE = `"""tiebreaker.py: your TieBreaker class."""

# When two nodes have the same score, the node with the GREATER key() is
# expanded first. key() must return a tuple of numbers or strings, and must
# be deterministic: the same node always gets the same key.


class TieBreaker:
    name = "greater_i_then_j"

    def key(self, node, board):
        i, j = board.rc(node.head)
        return (i, j)
`

export const TEMPLATES: Record<PlaygroundFile, string> = {
  [SEARCH_FILE]: SEARCH_TEMPLATE,
  [TIEBREAKER_FILE]: TIEBREAKER_TEMPLATE,
}
