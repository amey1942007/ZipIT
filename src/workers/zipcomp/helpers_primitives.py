"""Hard-to-write fundamentals only. Intentionally not a Zip solver.

These functions answer local geometry questions. They do not implement
Warnsdorff search, connectivity pruning policies, or a recommended
heuristic. Combining them (and adding bonuses / penalties) is the
submission.
"""

from __future__ import annotations

from collections import deque


def _bitmask(visited) -> int | None:
    if visited is None:
        return None
    if hasattr(visited, "visited"):
        return int(visited.visited)
    return int(visited)


def _cell_index(board, cell) -> int:
    if isinstance(cell, tuple):
        return board.idx(cell[0], cell[1])
    return int(cell)


def manhattan(board, a, b) -> int:
    """Grid Manhattan distance between two cells (flat index or (row, col))."""
    return board.manhattan(_cell_index(board, a), _cell_index(board, b))


def bfs_distance(board, src, dst, visited=None) -> int | None:
    """Shortest orthogonal walk on the board graph (walls respected).

    ``src`` / ``dst``: flat index or ``(row, col)``.
    If ``visited`` is a bitmask or a Node, those cells are blocked except
    ``src``. Returns ``None`` if unreachable.
    """
    src = _cell_index(board, src)
    dst = _cell_index(board, dst)
    if src == dst:
        return 0
    blocked = _bitmask(visited)
    q = deque([(src, 0)])
    seen = 1 << src
    while q:
        c, dist = q.popleft()
        for d in board.adj[c]:
            if (seen >> d) & 1:
                continue
            if blocked is not None and d != src and (blocked >> d) & 1:
                continue
            if d == dst:
                return dist + 1
            seen |= 1 << d
            q.append((d, dist + 1))
    return None


def next_checkpoint(node, board) -> int | None:
    """Flat index of the next required checkpoint, or None if all collected."""
    return board.next_checkpoint_cell(node)


def next_manhattan(node, board) -> int:
    """Manhattan distance from the snake head to the next checkpoint (0 if none)."""
    target = board.next_checkpoint_cell(node)
    if target is None:
        return 0
    return board.manhattan(node.head, target)


def unvisited_neighbors(node, board, cell=None) -> list[int]:
    """Unvisited orthogonal neighbours of ``cell`` (default: head)."""
    if cell is None:
        cell = node.head
    cell = _cell_index(board, cell)
    return [d for d in board.adj[cell] if not node.is_visited(d)]


def free_degree(node, board, cell=None) -> int:
    """Number of unvisited neighbours of ``cell`` (default: the head)."""
    return len(unvisited_neighbors(node, board, cell))


def trapped_unvisited(node, board) -> int:
    """Unvisited cells not reachable from the head (pocketed behind the path curve)."""
    remaining = board.n - node.depth
    return remaining - unvisited_component_size(node, board)


def unvisited_component_size(node, board, start=None) -> int:
    """Count of unvisited cells reachable from ``start`` (default: head).

    Flood-fill through unvisited cells, stepping from the (already visited)
    start cell into its unvisited neighbours. Does not include visited cells.
    """
    if start is None:
        start = node.head
    start = _cell_index(board, start)
    stack = [start]
    seen = node.visited
    count = 0
    while stack:
        c = stack.pop()
        for d in board.adj[c]:
            if not (seen >> d) & 1:
                seen |= 1 << d
                count += 1
                stack.append(d)
    return count
