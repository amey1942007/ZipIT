import helpersSource from '@/workers/zipcomp/helpers_primitives.py?raw'
import type { ZipPuzzle } from '@/lib/zip/types'

/** 4×4 example: checkpoints 1, 2, 3 at cells 0, 7, 12 and one wall between cells 5 and 6. */
export const EXAMPLE_PUZZLE: ZipPuzzle = { rows: 4, cols: 4, waypoints: [0, 7, 12], walls: ['5|6'] }
/** The example node is this partial path. */
export const EXAMPLE_PATH = [0, 1, 5]

/**
 * `expr` is evaluated by the engine test with `board`, `node` and every helper in scope, and its
 * repr must equal `value` (whitespace ignored). `label` replaces `expr` on screen when set.
 */
export interface RefEntry {
  expr: string
  value: string
  note: string
  label?: string
}

export interface RefSection {
  title: string
  entries: RefEntry[]
}

export const BOARD_REFERENCE: RefSection[] = [
  {
    title: 'Fields',
    entries: [
      { expr: 'board.width', value: '4', note: 'Columns.' },
      { expr: 'board.height', value: '4', note: 'Rows.' },
      { expr: 'board.n', value: '16', note: 'Number of cells (width × height). A full path has n cells.' },
      {
        expr: '[[board.idx(i, j) for j in range(board.width)] for i in range(board.height)]',
        label: 'cell numbers',
        value: '[[0, 1, 2, 3],\n [4, 5, 6, 7],\n [8, 9, 10, 11],\n [12, 13, 14, 15]]',
        note: 'Cells are flat indices: idx = row * width + col. node.head, node.path and board.adj all use these numbers.',
      },
      {
        expr: 'board.checkpoints',
        value: '[(0, 0), (1, 3), (3, 0)]',
        note: '(row, col) of each numbered dot, in order. checkpoints[0] is dot 1.',
      },
      {
        expr: 'board.walls',
        value: '[((1, 1), (1, 2))]',
        note: 'Pairs of (row, col) cells with a wall between them. You can never step across one.',
      },
      { expr: 'board.cp_idx', value: '[0, 7, 12]', note: 'Flat index of each checkpoint, in order.' },
      { expr: 'board.cp_number', value: '{0: 1, 7: 2, 12: 3}', note: 'Flat index → checkpoint number.' },
      { expr: 'board.num_checkpoints', value: '3', note: 'How many numbered dots.' },
      { expr: 'board.start', value: '0', note: 'Checkpoint 1. Every path starts here.' },
      { expr: 'board.goal', value: '12', note: 'The last checkpoint. It must be the very last cell of the path.' },
      {
        expr: 'board.full_mask',
        value: '65535',
        note: 'All n bits set. node.visited == board.full_mask means every cell is on the path.',
      },
      {
        expr: 'board.adj',
        value:
          '[[4, 1], [5, 0, 2], [6, 1, 3], [7, 2],\n [0, 8, 5], [1, 9, 4], [2, 10, 7], [3, 11, 6],\n [4, 12, 9], [5, 13, 8, 10], [6, 14, 9, 11], [7, 15, 10],\n [8, 13], [9, 12, 14], [10, 13, 15], [11, 14]]',
        note: 'adj[cell] lists the cells you can step to from cell, walls already removed, in the order up, down, left, right. Cell 5 lists [1, 9, 4]: the wall hides 6.',
      },
    ],
  },
  {
    title: 'Methods',
    entries: [
      { expr: 'board.idx(1, 1)', value: '5', note: '(row, col) → flat index.' },
      { expr: 'board.rc(7)', value: '(1, 3)', note: 'Flat index → (row, col).' },
      { expr: 'board.manhattan(0, 15)', value: '6', note: '|Δrow| + |Δcol| between two flat indices. Ignores walls.' },
      { expr: 'board.next_checkpoint_cell(node)', value: '7', note: 'Flat index of the next checkpoint, or None when all are collected.' },
      { expr: 'board.remaining(node)', value: '13', note: 'Cells still to visit: n - node.depth.' },
      { expr: 'board.free_degree(node, 5)', value: '2', note: 'Unvisited neighbours of a cell.' },
      {
        expr: 'board.unvisited_connected(node)',
        value: 'True',
        note: 'True when every unvisited cell can still be reached from the head. Flood fill: looks at the whole board.',
      },
      {
        expr: 'board.dead_end_cells(node)',
        value: '0',
        note: 'Unvisited cells (not the goal) with at most one way in. Anything above 0 means this path cannot finish. Scans the whole board.',
      },
      {
        expr: '[child.head for child in board.successors(node)]',
        label: 'board.successors(node)',
        value: '[9, 4]',
        note: 'The legal next Nodes (their heads shown). The engine already calls this, so calling it in score() repeats work.',
      },
    ],
  },
]

export const NODE_REFERENCE: RefSection[] = [
  {
    title: 'Fields',
    entries: [
      { expr: 'node.path', value: '[0, 1, 5]', note: 'Flat indices from checkpoint 1 to the head. Rebuilt from parents on every access, so it costs depth steps.' },
      { expr: 'node.head', value: '5', note: 'The cell the path ends on: (1, 1).' },
      { expr: 'board.rc(node.head)', value: '(1, 1)', note: 'The head as (row, col).' },
      { expr: 'node.depth', value: '3', note: 'Number of cells in the path.' },
      {
        expr: 'node.next_cp',
        value: '2',
        note: 'Number of the next checkpoint to reach. It becomes num_checkpoints + 1 once all are collected.',
      },
      {
        expr: 'node.visited',
        value: '35',
        note: 'A bitmask stored as one int: bit k is 1 when cell k is on the path. 35 = 2⁰ + 2¹ + 2⁵ (cells 0, 1, 5).',
      },
      { expr: 'bin(node.visited)', value: "'0b100011'", note: 'The same bits, read right to left from cell 0.' },
      {
        expr: '[[int(node.is_visited(board.idx(i, j))) for j in range(board.width)] for i in range(board.height)]',
        label: 'visited as a grid',
        value: '[[1, 1, 0, 0],\n [0, 1, 0, 0],\n [0, 0, 0, 0],\n [0, 0, 0, 0]]',
        note: 'node.visited unpacked onto the board, 1 = on the path.',
      },
      { expr: 'node.parent.head', value: '1', note: 'node.parent is the previous Node (None for the start node).' },
      {
        expr: 'node.eid',
        value: '-1',
        note: 'Expansion id. Still -1 when score() and key() run: the engine scores a node when it creates it, before expanding it.',
      },
    ],
  },
  {
    title: 'Methods',
    entries: [
      { expr: 'node.is_visited(5)', value: 'True', note: 'Is a flat index on the path?' },
      { expr: 'node.is_visited(6)', value: 'False', note: '' },
    ],
  },
]

export const RETURN_REFERENCE: RefSection[] = [
  {
    title: 'search.py · Score.score(self, node, board)',
    entries: [
      {
        expr: 'node.depth * 10 - next_manhattan(node, board)',
        value: '28',
        note: 'Return one finite number (int or float). The engine expands the HIGHEST score first. It calls score() once for every new node and never adds scores up along the path.',
      },
    ],
  },
  {
    title: 'search.py · Score.prune(self, node, board) (optional)',
    entries: [
      {
        expr: 'trapped_unvisited(node, board) > 0',
        value: 'False',
        note: 'Return True to drop the node: it never enters the frontier. Pruning a node that could still finish means the board cannot be solved.',
      },
    ],
  },
  {
    title: 'tiebreaker.py · TieBreaker.key(self, node, board)',
    entries: [
      {
        expr: '(-free_degree(node, board), node.head)',
        value: '(-2, 5)',
        note: 'Return a tuple of numbers or strings. Only used between nodes with equal scores: tuples compare left to right and the GREATER one is expanded first. The same node must always get the same key.',
      },
    ],
  },
]

export interface HelperDoc {
  name: string
  signature: string
  summary: string
  details: string[]
  examples: RefEntry[]
  cost: string
  source: string
}

/** The helper's own `def` block, cut from the vendored ZipIt_ARIES file. */
export function helperSource(name: string, source: string = helpersSource): string {
  const lines = source.split('\n')
  const start = lines.findIndex((line) => line.startsWith(`def ${name}(`))
  if (start === -1) return ''
  const next = lines.findIndex((line, i) => i > start && /^\S/.test(line))
  return lines
    .slice(start, next === -1 ? lines.length : next)
    .join('\n')
    .trimEnd()
}

const DOCS: Omit<HelperDoc, 'source'>[] = [
  {
    name: 'manhattan',
    signature: 'manhattan(board, a, b)',
    summary: 'Grid distance |Δrow| + |Δcol| between two cells. It ignores walls and the path.',
    details: ['a, b: flat index or (row, col).', 'Returns an int.'],
    examples: [
      { expr: 'manhattan(board, 0, 15)', value: '6', note: 'Corner to corner.' },
      { expr: 'manhattan(board, (0, 0), (3, 3))', value: '6', note: 'Same cells as (row, col).' },
    ],
    cost: 'Constant time. Cheap to call on every node.',
  },
  {
    name: 'bfs_distance',
    signature: 'bfs_distance(board, src, dst, visited=None)',
    summary: 'Length of the shortest real walk from src to dst, one neighbour at a time, going around walls.',
    details: [
      'src, dst: flat index or (row, col).',
      'visited (optional): a Node or a bitmask. Those cells are blocked, except src. Pass node to walk only through free cells.',
      'Returns the number of steps, 0 when src == dst, or None when dst cannot be reached.',
    ],
    examples: [
      { expr: 'bfs_distance(board, 5, 6)', value: '3', note: 'The wall between 5 and 6 forces 5 → 1 → 2 → 6. manhattan says 1.' },
      { expr: 'bfs_distance(board, 5, 7, node)', value: '4', note: 'Head to checkpoint 2 through free cells: 5 → 9 → 10 → 11 → 7.' },
      { expr: 'bfs_distance(board, 5, 0, node)', value: 'None', note: 'Cell 0 is on the path, so it is blocked.' },
    ],
    cost: 'Breadth-first search: can visit every cell on each call. Called on every node, it adds up on big boards.',
  },
  {
    name: 'next_checkpoint',
    signature: 'next_checkpoint(node, board)',
    summary: 'Flat index of the next checkpoint the path must reach, or None once every checkpoint is collected.',
    details: ['Same as board.next_checkpoint_cell(node).'],
    examples: [{ expr: 'next_checkpoint(node, board)', value: '7', note: 'Checkpoint 2 sits at (1, 3).' }],
    cost: 'Constant time.',
  },
  {
    name: 'next_manhattan',
    signature: 'next_manhattan(node, board)',
    summary: 'Manhattan distance from the head to the next checkpoint, or 0 when none are left. It ignores walls.',
    details: ['Returns an int.', 'Use bfs_distance(board, node.head, next_checkpoint(node, board), node) for the real walk.'],
    examples: [
      { expr: 'next_manhattan(node, board)', value: '2', note: '(1, 1) to (1, 3).' },
      {
        expr: 'bfs_distance(board, node.head, next_checkpoint(node, board), node)',
        value: '4',
        note: 'The real walk is longer because of the wall.',
      },
    ],
    cost: 'Constant time.',
  },
  {
    name: 'unvisited_neighbors',
    signature: 'unvisited_neighbors(node, board, cell=None)',
    summary: 'Neighbours of cell (default: the head) that are not on the path yet, walls respected, in the order up, down, left, right.',
    details: ['cell: flat index or (row, col).', 'Returns a list of flat indices.'],
    examples: [
      { expr: 'unvisited_neighbors(node, board)', value: '[9, 4]', note: 'From the head 5: 1 is visited and 6 is behind the wall.' },
      { expr: 'unvisited_neighbors(node, board, 0)', value: '[4]', note: 'From cell 0.' },
    ],
    cost: 'Constant time (at most 4 neighbours).',
  },
  {
    name: 'free_degree',
    signature: 'free_degree(node, board, cell=None)',
    summary: 'How many unvisited neighbours cell (default: the head) has. A low number means the cell is close to becoming a dead end.',
    details: ['Equals len(unvisited_neighbors(node, board, cell)).'],
    examples: [
      { expr: 'free_degree(node, board)', value: '2', note: 'The head has two ways on: 9 and 4.' },
      { expr: 'free_degree(node, board, 15)', value: '2', note: 'The corner cell 15.' },
    ],
    cost: 'Constant time.',
  },
  {
    name: 'unvisited_component_size',
    signature: 'unvisited_component_size(node, board, start=None)',
    summary: 'How many unvisited cells a flood fill from start (default: the head) can reach.',
    details: [
      'start: flat index or (row, col).',
      'It equals board.n - node.depth when nothing has been cut off.',
    ],
    examples: [{ expr: 'unvisited_component_size(node, board)', value: '13', note: 'All 13 unvisited cells are reachable.' }],
    cost: 'Flood fill over the board on every call.',
  },
  {
    name: 'trapped_unvisited',
    signature: 'trapped_unvisited(node, board)',
    summary: 'Unvisited cells the head can no longer reach. Anything above 0 means this path can never finish.',
    details: ['Computed as (board.n - node.depth) - unvisited_component_size(node, board).'],
    examples: [{ expr: 'trapped_unvisited(node, board)', value: '0', note: 'Nothing is cut off yet.' }],
    cost: 'One flood fill per call.',
  },
]

export const HELPER_DOCS: HelperDoc[] = DOCS.map((doc) => ({ ...doc, source: helperSource(doc.name) }))
