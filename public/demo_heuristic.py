def next_move(grid, path, cost_map):
    r, c = path[-1]
    best = None
    for nr, nc in grid.neighbors(r, c):
        cost = cost_map[nr][nc]
        if cost is None:
            continue
        onward = sum(1 for ar, ac in grid.neighbors(nr, nc)
                     if (ar, ac) != (r, c) and cost_map[ar][ac] is not None)
        key = (onward, cost)  # fewest onward options first, then closest to next number
        if best is None or key < best[0]:
            best = (key, (nr, nc))
    return best[1] if best else (r, c)  # (r, c) = no idea -> recorded as 'x'
