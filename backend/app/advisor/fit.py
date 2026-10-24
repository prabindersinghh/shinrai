"""Market & location fit (deterministic): fit(state) = Σ wᵢ · factorᵢ, plus support coverage and white space.

Factors are normalised to 0–1 across the profiled states. A missing value is never guessed: it becomes a
neutral 0.5 and is reported as "no data" so the user can see exactly what drove a ranking.
"""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

from .kb import kb

MAP = Path(__file__).resolve().parents[3] / "frontend" / "public" / "india_states.json"

FACTORS = {
    "manufacturing": {"en": "Manufacturing base (ASI)", "ja": "製造業の厚み（ASI）"},
    "japan_cluster": {"en": "Japanese company cluster", "ja": "日系企業の集積"},
    "jit": {"en": "Japan Industrial Townships", "ja": "日本工業団地（JIT）"},
    "logistics": {"en": "Port and logistics access", "ja": "港湾・物流アクセス"},
    "sector_cluster": {"en": "Sector cluster match", "ja": "業種集積との適合"},
    "fdi_momentum": {"en": "FDI inflow momentum", "ja": "直接投資の勢い"},
}
BASE_WEIGHTS = {
    "sell": {"manufacturing": 0.15, "japan_cluster": 0.20, "jit": 0.05, "logistics": 0.10, "sector_cluster": 0.25, "fdi_momentum": 0.25},
    "manufacture": {"manufacturing": 0.25, "japan_cluster": 0.15, "jit": 0.15, "logistics": 0.10, "sector_cluster": 0.20, "fdi_momentum": 0.15},
    "source": {"manufacturing": 0.30, "japan_cluster": 0.10, "jit": 0.05, "logistics": 0.20, "sector_cluster": 0.30, "fdi_momentum": 0.05},
    "export_hub": {"manufacturing": 0.20, "japan_cluster": 0.10, "jit": 0.10, "logistics": 0.35, "sector_cluster": 0.15, "fdi_momentum": 0.10},
}
SECTOR_WORDS = {
    "auto_parts": ["auto", "automobile"], "machinery": ["engineering", "machine"], "electronics": ["electronic", "semiconductor"],
    "food": ["food", "agri"], "chemicals": ["chemical", "petro"], "textiles": ["textile"], "medical": ["pharma", "medical"],
}
PORT = {"major_port": 1.0, "minor_port": 0.6, "landlocked": 0.35}


def _dist_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


@lru_cache(maxsize=1)
def centroids() -> dict[str, tuple[float, float]]:
    """Area-weighted centroid of each state's largest ring, from the map asset (lat, lon)."""
    out = {}
    for s in json.loads(MAP.read_text(encoding="utf-8"))["states"]:
        ring = s["rings"][0]
        a = cx = cy = 0.0
        for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
            cross = x1 * y2 - x2 * y1
            a += cross
            cx += (x1 + x2) * cross
            cy += (y1 + y2) * cross
        a *= 0.5
        out[s["name"]] = (cy / (6 * a), cx / (6 * a)) if a else (ring[0][1], ring[0][0])
    return out


def _norm(values: dict[str, float | None]) -> dict[str, tuple[float, bool]]:
    known = [v for v in values.values() if v is not None]
    lo, hi = (min(known), max(known)) if known else (0, 1)
    return {k: ((v - lo) / (hi - lo) if hi > lo else 1.0, True) if v is not None else (0.5, False)
            for k, v in values.items()}


def weights_for(profile: dict) -> dict[str, float]:
    w = dict(BASE_WEIGHTS.get(profile.get("goal") or "sell", BASE_WEIGHTS["sell"]))
    appetite = profile.get("risk_appetite", "balanced")
    if appetite == "conservative":
        w["japan_cluster"] += 0.08
        w["jit"] += 0.05
        w["fdi_momentum"] -= 0.05
    elif appetite == "aggressive":
        w["fdi_momentum"] += 0.08
        w["japan_cluster"] -= 0.05
    musts = set(profile.get("must_haves") or [])
    if "port" in musts:
        w["logistics"] += 0.10
    if "japanese_community" in musts:
        w["japan_cluster"] += 0.08
    total = sum(max(v, 0) for v in w.values())
    return {k: round(max(v, 0) / total, 4) for k, v in w.items()}


def factor_table(profile: dict) -> list[dict]:
    k = kb()
    states = k.section("states", "states")
    jits = k.section("support_network", "jits")
    words = SECTOR_WORDS.get(profile.get("industry", "auto_parts"), [])
    goal = profile.get("goal") or "sell"
    raw = {
        "manufacturing": {s["name"]: (s.get("asi_employment_share_pct") if goal in ("manufacture", "source") else s.get("asi_gva_share_pct"))
                          for s in states},
        "japan_cluster": {s["name"]: s.get("jp_companies_2021") for s in states},
        "jit": {s["name"]: float(len(s.get("jits") or [])) + sum((j.get("jp_companies") or 0) for j in jits if j["state"] == s["name"]) / 25
                for s in states},
        "logistics": {s["name"]: PORT.get(s.get("port_access"), 0.35) for s in states},
        "sector_cluster": {s["name"]: 1.0 if any(w in " ".join(s.get("clusters", [])).lower() for w in words) else 0.3 for s in states},
        "fdi_momentum": {s["name"]: (math.log10(s["fdi_h1_fy25_usd_mn"]) if s.get("fdi_h1_fy25_usd_mn") else None) for s in states},
    }
    normed = {f: _norm(v) for f, v in raw.items()}
    cites = {"manufacturing": "kb_asi_top5_emp" if goal in ("manufacture", "source") else "kb_asi_top5_gva",
             "japan_cluster": "kb_jp_states_2021", "fdi_momentum": "kb_fdi_h1fy25"}
    rows = []
    for s in states:
        name = s["name"]
        rows.append({
            "state": name, "name_ja": s["name_ja"], "id": s["id"],
            "factors": {f: round(normed[f][name][0], 4) for f in FACTORS},
            "has_data": {f: normed[f][name][1] for f in FACTORS},
            "raw": {f: raw[f][name] for f in FACTORS},
            "cites": cites,
        })
    return rows


def support_scores() -> dict[str, dict]:
    k = kb()
    offices = k.section("support_network", "offices")
    jits = k.section("support_network", "jits")
    cents = centroids()
    out = {}
    for s in k.section("states", "states"):
        c = cents.get(s["name"])
        nearest = min(offices, key=lambda o: _dist_km(c, (o["lat"], o["lon"])))
        d = _dist_km(c, (nearest["lat"], nearest["lon"]))
        proximity = max(0.0, 1 - min(d, 700) / 700)
        n_jit = sum(1 for j in jits if j["state"] == s["name"])
        jp = s.get("jp_companies_2021")
        parts = {"proximity": proximity, "jits": min(n_jit, 3) / 3, "japanese_companies": (min(jp, 400) / 400) if jp else 0.5,
                 "japan_desk": 1.0 if s.get("japan_desk") else 0.0}
        out[s["name"]] = {"score": round(sum(parts.values()) / len(parts), 4), "parts": parts,
                          "nearest_office": nearest["name"], "nearest_km": round(d)}
    return out


def score(rows: list[dict], weights: dict[str, float]) -> list[dict]:
    support = support_scores()
    out = []
    for r in rows:
        fit = sum(weights[f] * r["factors"][f] for f in FACTORS)
        sup = support[r["state"]]["score"]
        out.append({**r, "fit": round(fit * 100, 1), "support": round(sup * 100, 1),
                    "white_space": round(fit * (1 - sup) * 100, 1), "support_detail": support[r["state"]]})
    out.sort(key=lambda x: -x["fit"])
    for i, r in enumerate(out, 1):
        r["rank"] = i
    median_fit = sorted(r["fit"] for r in out)[len(out) // 2]
    ws = sorted([r for r in out if r["fit"] >= median_fit], key=lambda x: -x["white_space"])[:2]
    for r in out:
        r["is_white_space"] = r in ws
    return out


def sensitivity(rows: list[dict], weights: dict[str, float]) -> list[dict]:
    """Which single weight change (+0.15) would change the top recommendation."""
    base_top = score(rows, weights)[0]["state"]
    changes = []
    for f in FACTORS:
        w = dict(weights)
        w[f] += 0.15
        total = sum(w.values())
        w = {k: v / total for k, v in w.items()}
        new_top = score(rows, w)[0]["state"]
        if new_top != base_top:
            changes.append({"factor": f, "label_en": FACTORS[f]["en"], "label_ja": FACTORS[f]["ja"], "new_top": new_top})
    return changes
