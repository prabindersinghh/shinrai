"""Shared helpers for the satellite / ground adapters."""
from __future__ import annotations

import json
import math
from functools import lru_cache

from ..config import DATA_DIR, SEED_DIR, env
from .base import SourceAdapter

GROUND_DIR = DATA_DIR / "ground"
GROUND_DIR.mkdir(parents=True, exist_ok=True)
GROUND_BUFFER_M = int(env("GROUND_BUFFER_M", "150"))
GOOGLE_MAPS_KEY = env("GOOGLE_MAPS_KEY")
EE_PROJECT = env("EE_PROJECT")
EE_SERVICE_ACCOUNT_JSON = env("EE_SERVICE_ACCOUNT_JSON")
NOMINATIM_USER_AGENT = env("NOMINATIM_USER_AGENT", "shinrai-hackathon")


def bbox(lat: float, lon: float, half_m: float) -> tuple[float, float, float, float]:
    dlat = half_m / 110540
    dlon = half_m / (111320 * math.cos(math.radians(lat)))
    return (lon - dlon, lat - dlat, lon + dlon, lat + dlat)


def distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def polygon_area_m2(points: list[list[float]]) -> float:
    lat0 = math.radians(sum(p[0] for p in points) / len(points))
    xy = [(p[1] * 111320 * math.cos(lat0), p[0] * 110540) for p in points]
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(xy, xy[1:] + xy[:1]))) / 2


@lru_cache(maxsize=1)
def seed_sites() -> list[dict]:
    path = SEED_DIR / "ground_sites.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def seed_site_near(lat: float, lon: float, within_m: float = 60) -> dict | None:
    return next((s for s in seed_sites() if distance_m((lat, lon), (s["lat"], s["lon"])) <= within_m), None)


def seed_site_for_address(address: str) -> dict | None:
    a = " ".join(address.lower().split())
    return next((s for s in seed_sites() if " ".join(s["address"].lower().split()) == a), None)


def site_dir(site: str) -> str:
    """Relative path under DATA_DIR for one site's imagery (keyed by coordinates so the cache can reuse it)."""
    rel = f"ground/site_{site}"
    (DATA_DIR / rel).mkdir(parents=True, exist_ok=True)
    return rel


class GroundAdapter(SourceAdapter):
    """Ground sources: for seed investigations try SEED, then CACHED, then LIVE (real sites are fetched once)."""

    def mode_order(self, requested: str) -> list[str]:
        override = env(f"ADAPTER_MODE_{self.name.upper()}", "")
        if override:
            return super().mode_order(override)
        return ["seed", "cached", "live"] if requested == "seed" else ["live", "cached", "seed"]
