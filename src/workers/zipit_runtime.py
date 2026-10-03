"""In-browser runner for the ZipIt_ARIES contract.

search.py      -> class Score       score(self, node, board) -> number, optional prune(self, node, board) -> bool
tiebreaker.py  -> class TieBreaker  key(self, node, board)   -> tuple

The vendored engine (zipcomp.game, zipcomp.engine) and helpers are written to the
in-memory filesystem by ``_install_engine`` so submissions import them exactly as on
the Mac mini: ``from helpers import next_manhattan``.
"""

import ast
import json
import math
import os
import sys
import types

_BLOCKED = (
    "js",
    "pyodide_js",
    "pyodide.ffi",
    "pyodide.code",
    "pyodide.http",
    "pyodide.webloop",
    "micropip",
)

# Standard-library modules a heuristic has no reason to touch. Everything else in
# sys.stdlib_module_names (math, heapq, collections, functools, ...) is allowed.
_DENIED = {
    "os", "sys", "subprocess", "socket", "shutil", "pathlib", "importlib", "ctypes",
    "multiprocessing", "threading", "_thread", "signal", "builtins", "io", "glob",
    "tempfile", "urllib", "http", "ftplib", "smtplib", "ssl", "select", "selectors",
    "asyncio", "pickle", "marshal", "shelve", "sqlite3", "code", "codeop", "pdb",
    "inspect", "gc", "resource", "platform", "webbrowser", "zipimport", "runpy",
    "time", "datetime", "secrets", "uuid",
}

_ROOT = "/zipit"


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


def _install_engine(sources_json):
    """Write zipcomp/{game,engine}.py and helpers/{__init__,primitives}.py, then import them."""
    sources = json.loads(sources_json)
    layout = {
        "zipcomp/__init__.py": "",
        "zipcomp/game.py": sources["game"],
        "zipcomp/engine.py": sources["engine"],
        "helpers/__init__.py": sources["helpers_init"],
        "helpers/primitives.py": sources["helpers_primitives"],
    }
    for rel, text in layout.items():
        path = os.path.join(_ROOT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            f.write(text)
    if _ROOT not in sys.path:
        sys.path.insert(0, _ROOT)
    import helpers  # noqa: F401
    import zipcomp.engine  # noqa: F401
    import zipcomp.game  # noqa: F401


_scorer = None
_tiebreaker = None


def _short(exc):
    text = "%s: %s" % (type(exc).__name__, exc) if str(exc) else type(exc).__name__
    return text.replace(_ROOT + "/", "")[:400]


def _line_of(exc, filename):
    tb = exc.__traceback__
    line = None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == filename:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line


def _where(exc, filename):
    line = _line_of(exc, filename)
    return "%s line %d: %s" % (filename, line, _short(exc)) if line else "%s: %s" % (filename, _short(exc))


def _imports(tree):
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                yield alias.name.split(".")[0], node.lineno
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                yield ".", node.lineno
            elif node.module:
                yield node.module.split(".")[0], node.lineno


def _import_problem(filename, tree):
    allowed = set(getattr(sys, "stdlib_module_names", ())) - _DENIED
    for name, line in _imports(tree):
        if name == "helpers":
            continue
        if name == ".":
            return "%s line %d: relative imports are not allowed" % (filename, line)
        if name in _DENIED or name not in allowed:
            return "%s line %d: import %s is not allowed (helpers and the safe standard library only)" % (
                filename, line, name)
    return None


def _load_module(source, filename, modname):
    module = types.ModuleType(modname)
    module.__file__ = filename
    exec(compile(source, filename, "exec"), module.__dict__)
    return module


def _number_ok(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    return not (isinstance(value, float) and (math.isnan(value) or math.isinf(value)))


def _key_ok(value):
    if not isinstance(value, tuple):
        return False
    for part in value:
        if isinstance(part, str):
            continue
        if not _number_ok(part):
            return False
    return True


def _warmup_board():
    from zipcomp.game import Board

    return Board(3, 3, [(0, 0), (1, 1), (2, 2)], [], "warmup_3x3")


def _check(search_src, tiebreaker_src):
    """Return [{id, ok, message}] in order. Stops at the first failure."""
    global _scorer, _tiebreaker
    _scorer = None
    _tiebreaker = None
    out = []

    def result(check_id, problem):
        out.append({"id": check_id, "ok": problem is None, "message": problem or ""})
        return problem is None

    trees = {}
    problem = None
    for filename, source in (("search.py", search_src), ("tiebreaker.py", tiebreaker_src)):
        try:
            trees[filename] = ast.parse(source, filename)
        except SyntaxError as exc:
            problem = "%s line %s: %s" % (filename, exc.lineno, exc.msg)
            break
    if not result("syntax", problem):
        return json.dumps(out)

    problem = _import_problem("search.py", trees["search.py"]) or _import_problem(
        "tiebreaker.py", trees["tiebreaker.py"])
    if not result("imports", problem):
        return json.dumps(out)

    problem = None
    try:
        search_mod = _load_module(search_src, "search.py", "submission_score")
    except Exception as exc:
        search_mod, problem = None, _where(exc, "search.py")
    tb_mod = None
    if problem is None:
        try:
            tb_mod = _load_module(tiebreaker_src, "tiebreaker.py", "submission_tb")
        except Exception as exc:
            problem = _where(exc, "tiebreaker.py")
    if problem is None:
        cls = getattr(search_mod, "Score", None)
        if cls is None or not callable(getattr(cls, "score", None)):
            problem = "search.py must define class Score with score(self, node, board)"
    if problem is None:
        cls = getattr(tb_mod, "TieBreaker", None)
        if cls is None or not callable(getattr(cls, "key", None)):
            problem = "tiebreaker.py must define class TieBreaker with key(self, node, board)"
    if problem is None:
        try:
            scorer = search_mod.Score()
        except Exception as exc:
            problem = _where(exc, "search.py")
    if problem is None:
        prune = getattr(scorer, "prune", None)
        if prune is not None and not callable(prune):
            problem = "search.py: prune must be a method if you define it"
    if problem is None:
        try:
            tiebreaker = tb_mod.TieBreaker()
        except Exception as exc:
            problem = _where(exc, "tiebreaker.py")
    if not result("classes", problem):
        return json.dumps(out)

    board = _warmup_board()
    problem = None
    nodes = [board.start_node()]
    nodes += board.successors(nodes[0])
    for node in nodes:
        try:
            value = scorer.score(node, board)
        except Exception as exc:
            problem = _where(exc, "search.py")
            break
        if not _number_ok(value):
            problem = "search.py: score() must return a finite int or float, got %r" % (value,)
            break
        try:
            key = tiebreaker.key(node, board)
        except Exception as exc:
            problem = _where(exc, "tiebreaker.py")
            break
        if not _key_ok(key):
            problem = "tiebreaker.py: key() must return a tuple of numbers or strings, got %r" % (key,)
            break
        if getattr(scorer, "prune", None) is not None:
            try:
                dropped = scorer.prune(node, board)
            except Exception as exc:
                problem = _where(exc, "search.py")
                break
            if not isinstance(dropped, bool):
                problem = "search.py: prune() must return True or False, got %r" % (dropped,)
                break
    if not result("output", problem):
        return json.dumps(out)

    from zipcomp.engine import best_score_search

    problem = None
    try:
        first = best_score_search(_warmup_board(), scorer, tiebreaker, 20_000, 3.0)
        second = best_score_search(_warmup_board(), scorer, tiebreaker, 20_000, 3.0)
        if first["status"] != "solved":
            problem = "Did not solve the 3x3 warm-up board (status: %s)" % first["status"]
        elif first["expansions"] != second["expansions"]:
            problem = "Two runs on the same board expanded a different number of nodes. Keep the search deterministic."
    except Exception as exc:
        problem = _where(exc, "search.py") if _line_of(exc, "search.py") else _where(exc, "tiebreaker.py")
    if not result("smoke", problem):
        return json.dumps(out)

    _scorer = scorer
    _tiebreaker = tiebreaker
    return json.dumps(out)


class _Deepest:
    """Recorder hook: remembers the deepest expanded node for unsolved runs."""

    def __init__(self):
        self.node = None

    def expand(self, node, score, tie, backtrack):
        if self.node is None or node.depth > self.node.depth:
            self.node = node

    def finish(self, status, solution, stats):
        pass


def _run(board_json, max_expansions, time_limit):
    from zipcomp.engine import best_score_search
    from zipcomp.game import Board

    if _scorer is None or _tiebreaker is None:
        return json.dumps({"status": "error", "error": "Run the checks first.", "path": [], "stats": {}})
    board = Board.from_dict(json.loads(board_json))
    deepest = _Deepest()
    try:
        stats = best_score_search(board, _scorer, _tiebreaker, int(max_expansions), float(time_limit), recorder=deepest)
    except Exception as exc:
        line = _line_of(exc, "search.py")
        where = _where(exc, "search.py") if line else _where(exc, "tiebreaker.py")
        path = deepest.node.path if deepest.node is not None else []
        return json.dumps({"status": "error", "error": where, "path": [list(board.rc(c)) for c in path], "stats": {}})
    solution = stats.get("solution")
    path = solution if solution else (deepest.node.path if deepest.node is not None else [])
    clean = {k: v for k, v in stats.items() if k != "solution"}
    return json.dumps({
        "status": stats["status"],
        "error": None,
        "path": [list(board.rc(c)) for c in path],
        "stats": clean,
    })
