"""Best-score (best-first) search engine.

The engine owns the frontier, the closed set, the game rules, and metric
counting. A participant supplies:

  * a ``Score`` class with ``score(node, board) -> number`` — **higher is
    expanded first**. Scores may be large positive or large negative.
  * optionally ``prune(node, board) -> bool`` — if True, the node is not
    pushed onto the frontier (hard prune; counted in ``pruned``).
  * a ``TieBreaker`` class with ``key(node, board) -> tuple``; among nodes of
    **equal score**, the **GREATER** key is expanded first (default: greater
    row ``i``, then greater column ``j``).

Score contract (read this):
  The engine calls ``score(node, board)`` independently on **each node**.
  It does **not** accumulate a path cost. You may implement sequential
  tracking, if/else bonuses, or huge penalties directly in ``score``.
  Best-first search on node scores is not required to be additive UCS.

Metrics:
  expansions     nodes popped and expanded
  generated      children pushed onto the frontier
  dead_ends      expanded nodes that produced no child
  backtracks     expansions whose node is not a child of the previously
                 expanded node
  tiebreaks      pops where the best score was shared, so the tie-breaker
                 decided which node to expand
  tiebreak_fifo  of those, ties the tie-breaker could not split (insertion
                 order)
  duplicates     popped nodes already closed under (visited, head)
"""

from __future__ import annotations

import heapq
import itertools
import time

from .game import Board, Node


class _Entry:
    __slots__ = ("score", "tb", "seq", "node")

    def __init__(self, score, tb, seq, node):
        self.score, self.tb, self.seq, self.node = score, tb, seq, node

    def __lt__(self, other):
        # heapq is a min-heap: "less" means extracted first.
        # Greater score first; among equal scores, greater tie-key first;
        # remaining ties keep insertion order (smaller seq first).
        if self.score != other.score:
            return self.score > other.score
        if self.tb != other.tb:
            return self.tb > other.tb
        return self.seq < other.seq


def best_score_search(board: Board, scorer, tiebreaker, max_expansions: int = 200_000,
                      time_limit: float = 30.0, recorder=None) -> dict:
    seq = itertools.count()
    stats = dict(expansions=0, generated=0, pruned=0, dead_ends=0, backtracks=0,
                 tiebreaks=0, tiebreak_fifo=0, duplicates=0)

    start = board.start_node()
    frontier = [_Entry(scorer.score(start, board), tiebreaker.key(start, board), next(seq), start)]
    closed: set[tuple[int, int]] = set()
    last: Node | None = None
    solution = None
    status = "exhausted"
    t0 = time.perf_counter()
    _prune = getattr(scorer, "prune", None)

    while frontier:
        entry = heapq.heappop(frontier)
        node = entry.node
        key = (node.visited, node.head)
        if key in closed:
            stats["duplicates"] += 1
            continue
        closed.add(key)

        tie = bool(frontier) and frontier[0].score == entry.score
        if tie:
            stats["tiebreaks"] += 1
            if frontier[0].tb == entry.tb:
                stats["tiebreak_fifo"] += 1
        backtrack = last is not None and node.parent is not last
        if backtrack:
            stats["backtracks"] += 1

        node.eid = stats["expansions"]
        stats["expansions"] += 1
        last = node
        if recorder is not None:
            recorder.expand(node, entry.score, tie, backtrack)

        if board.is_goal(node):
            solution = node.path
            status = "solved"
            break
        if stats["expansions"] >= max_expansions:
            status = "expansion_limit"
            break
        if (stats["expansions"] & 1023) == 0 and time.perf_counter() - t0 > time_limit:
            status = "time_limit"
            break

        pushed = 0
        for child in board.successors(node):
            if _prune is not None and _prune(child, board):
                stats["pruned"] += 1
                continue
            heapq.heappush(frontier, _Entry(scorer.score(child, board), tiebreaker.key(child, board),
                                            next(seq), child))
            pushed += 1
        stats["generated"] += pushed
        if pushed == 0:
            stats["dead_ends"] += 1

    stats["elapsed"] = time.perf_counter() - t0
    stats["status"] = status
    stats["solution"] = solution
    if recorder is not None:
        recorder.finish(status, solution, stats)
    return stats


# Backward-compatible name (score, not additive cost).
best_first_search = best_score_search
best_cost_search = best_score_search
