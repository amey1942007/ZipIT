import json
import random
import sys

_BLOCKED = (
    "js",
    "pyodide_js",
    "pyodide.ffi",
    "pyodide.code",
    "pyodide.http",
    "pyodide.webloop",
    "micropip",
)


def _block_imports():
    try:
        import pyodide

        pyodide.unregisterJsModule("pyodide_js")
    except Exception:
        pass
    for name in list(sys.modules):
        for blocked in _BLOCKED:
            if name == blocked or name.startswith(blocked + "."):
                del sys.modules[name]
                break

    class _Blocker:
        def find_spec(self, fullname, path, target=None):
            for blocked in _BLOCKED:
                if fullname == blocked or fullname.startswith(blocked + "."):
                    raise ImportError("import of %s is blocked" % fullname)
            return None

    sys.meta_path.insert(0, _Blocker())


_block_imports()


class Grid(list):
    def __init__(self, numbers, wall_pairs, rows, cols):
        super().__init__(numbers)
        self.rows = rows
        self.cols = cols
        self.walls = frozenset(frozenset((tuple(a), tuple(b))) for a, b in wall_pairs)

    def blocked(self, a, b):
        return frozenset((tuple(a), tuple(b))) in self.walls

    def neighbors(self, r, c):
        out = []
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < self.rows and 0 <= nc < self.cols and not self.blocked((r, c), (nr, nc)):
                out.append((nr, nc))
        return out


_GRID = None
_user_next = None
_PATH_JSON = "[]"
_COST_JSON = "[]"


def _load(numbers, wall_pairs, rows, cols):
    global _GRID
    _GRID = Grid(numbers, wall_pairs, rows, cols)


def _seed(n):
    random.seed(n)


def _install_user(source):
    global _user_next
    ns = {"__name__": "submission"}
    exec(compile(source, "submission.py", "exec"), ns, ns)
    fn = ns.get("next_move")
    if not callable(fn):
        raise RuntimeError("next_move not defined")
    _user_next = fn


def _call():
    path = [tuple(p) for p in json.loads(_PATH_JSON)]
    cost = json.loads(_COST_JSON)
    try:
        out = _user_next(_GRID, path, cost)
    except Exception as exc:
        return json.dumps({"error": str(exc)[:500]})
    if not isinstance(out, (tuple, list)) or len(out) != 2:
        return json.dumps(None)
    try:
        return json.dumps([int(out[0]), int(out[1])])
    except Exception:
        return json.dumps(None)
