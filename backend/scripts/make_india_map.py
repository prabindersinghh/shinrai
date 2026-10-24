"""Simplify the India states GeoJSON (Census 2011 state codes, includes Ladakh) into a light web asset.

Source: github.com/datta07/INDIAN-SHAPEFILES (MIT), INDIA/INDIA_STATES.geojson, EPSG:4326.
Run: python -m scripts.make_india_map
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "app" / "advisor" / "sources" / "india_states_raw.geojson"
OUT = ROOT.parent / "frontend" / "public" / "india_states.json"
TOLERANCE = 0.03  # degrees (~3 km): keeps state shapes, drops coastline noise


def _perp(p, a, b) -> float:
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == dy == 0:
        return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
    return abs(dy * x - dx * y + x2 * y1 - y2 * x1) / (dx * dx + dy * dy) ** 0.5


def simplify(points: list, tol: float) -> list:
    """Douglas-Peucker, iterative so long coastlines don't hit the recursion limit."""
    if len(points) < 4:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        s, e = stack.pop()
        best, idx = 0.0, -1
        for i in range(s + 1, e):
            d = _perp(points[i], points[s], points[e])
            if d > best:
                best, idx = d, i
        if best > tol:
            keep[idx] = True
            stack += [(s, idx), (idx, e)]
    return [[round(p[0], 3), round(p[1], 3)] for p, k in zip(points, keep) if k]


def main() -> None:
    raw = json.loads(SRC.read_text(encoding="utf-8"))
    out = []
    for f in raw["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        rings = []
        for poly in polys:
            outer = simplify(poly[0], TOLERANCE)
            if len(outer) >= 4:
                rings.append(outer)
        rings.sort(key=len, reverse=True)
        rings = [r for i, r in enumerate(rings) if i < 3 or len(r) > 12]  # drop tiny islets
        p = f["properties"]
        out.append({"code": p["STCODE11"], "name": p["STNAME_SH"], "rings": rings})
    OUT.write_text(json.dumps({"source": "datta07/INDIAN-SHAPEFILES (MIT), Census 2011 state codes", "states": out},
                              separators=(",", ":")), encoding="utf-8")
    print(f"{len(out)} states -> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    sys.exit(main())
