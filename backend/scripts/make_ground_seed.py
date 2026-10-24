"""Build data/seed/ground_sites.json and aa_gst.json, pre-fetching REAL imagery for each seeded pin.

Imagery (Esri, Sentinel-2) and OSM footprints are real public data, fetched once and stored as seed files.
Building-by-year and night-light series are synthetic for the fictional DEMO companies only; real companies
get no synthetic series (those checks stay "not checked" until Earth Engine is configured).

Run: python -m scripts.make_ground_seed
"""
from __future__ import annotations

import asyncio
import json
import math
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.adapters.buildings_temporal import OsmBuildings  # noqa: E402
from app.adapters.imagery_current import ImageryCurrent  # noqa: E402
from app.adapters.imagery_timelapse import ImageryTimelapse  # noqa: E402
from app.config import DATA_DIR, SEED_DIR  # noqa: E402
from scripts.make_seed import MARUTI_PLANT, SHARED, SUNRISE_GST_ADDR, SUNRISE_SITE  # noqa: E402

YEARS = list(range(2016, 2027))


def nightlights(site_base: float, ring_base: float, months: int = 36) -> list[dict]:
    rows = []
    for i in range(months):
        y, m = divmod(2023 * 12 + 9 + i, 12)
        season = 0.08 * math.sin(i / 12 * 2 * math.pi)
        rows.append({"month": f"{y}-{m + 1:02d}", "site": round(site_base * (1 + season + 0.01 * (i % 3)), 2),
                     "ring": round(ring_base * (1 + season), 2)})
    return rows


SITES = [
    {"id": "sunrise_site", "seed": "sunrise_auto", "address": SUNRISE_SITE, "lat": 18.753083, "lon": 73.871347,
     "precision": "street", "provider": "seed", "state": "Maharashtra", "city": "Pune", "mode": "seed", "demo": True,
     "fetch": True, "osm_radius": 150,
     "buildings": {"series": [{"year": y, "built_area_m2": 0 if y < 2022 else (330 if y == 2022 else 353),
                               "mean_height_m": 0 if y < 2022 else 5.4} for y in range(2016, 2024)]},
     "nightlights": nightlights(1.92, 1.88)},
    {"id": "sunrise_registered", "seed": "sunrise_auto", "address": SHARED, "lat": 28.39601, "lon": 76.99218,
     "precision": "street", "provider": "seed", "state": "Haryana", "city": "Gurugram", "mode": "seed", "demo": True},
    {"id": "sunrise_gst", "seed": "sunrise_auto", "address": SUNRISE_GST_ADDR, "lat": 28.62902, "lon": 77.14301,
     "precision": "street", "provider": "seed", "state": "Delhi", "city": "New Delhi", "mode": "seed", "demo": True},
    {"id": "kaveri_registered", "seed": "kaveri_precision",
     "address": "No. 47, KIADB Industrial Area, Bommasandra, Bengaluru, Karnataka 560099", "lat": 12.81345,
     "lon": 77.69395, "precision": "street", "provider": "seed", "state": "Karnataka", "city": "Bengaluru",
     "mode": "seed", "demo": True, "fetch": True,
     "buildings": {"series": [{"year": y, "built_area_m2": 2380 + (y - 2016) * 40, "mean_height_m": 8.1}
                              for y in range(2016, 2024)]},
     "nightlights": nightlights(14.2, 9.1)},
    {"id": "maruti_plant", "seed": "maruti_suzuki", "address": MARUTI_PLANT, "lat": 28.3681754, "lon": 76.8914586,
     "precision": "street", "provider": "nominatim", "state": "Haryana", "city": "Gurugram", "mode": "cached",
     "demo": False, "fetch": True, "osm_radius": 400},
]


async def fetch_site(site: dict) -> None:
    key = f"{site['lat']:.5f}_{site['lon']:.5f}"
    out_dir = SEED_DIR / "ground" / site["id"]
    out_dir.mkdir(parents=True, exist_ok=True)
    rel_out = f"seed/ground/{site['id']}"
    manifest = out_dir / "manifest.json"
    if manifest.exists():
        site["images"] = json.loads(manifest.read_text(encoding="utf-8"))
    else:
        cur = await ImageryCurrent().live({"lat": site["lat"], "lon": site["lon"], "site": key, "half_m": 220})
        shutil.copy(DATA_DIR / cur[0]["path"], out_dir / "current.png")
        frames = await ImageryTimelapse().live({"lat": site["lat"], "lon": site["lon"], "site": key, "years": YEARS,
                                                "half_m": 500})
        out_frames = []
        for f in sorted(frames, key=lambda x: x["year"]):
            shutil.copy(DATA_DIR / f["path"], out_dir / f"s2_{f['year']}.png")
            out_frames.append({k: f[k] for k in ("year", "scene", "date", "cloud")} |
                              {"path": f"{rel_out}/s2_{f['year']}.png"})
        site["images"] = {"current": {**{k: cur[0][k] for k in ("provider", "attribution", "half_m")},
                                      "path": f"{rel_out}/current.png"}, "frames": out_frames}
        manifest.write_text(json.dumps(site["images"], indent=1), encoding="utf-8")
    osm_file = out_dir / "osm.json"
    if osm_file.exists():
        osm = json.loads(osm_file.read_text(encoding="utf-8"))
    else:
        for attempt in range(4):
            try:
                osm = await OsmBuildings().live({"lat": site["lat"], "lon": site["lon"],
                                                 "radius_m": site.get("osm_radius", 150)})
                break
            except Exception as exc:  # noqa: BLE001
                print(f"  overpass attempt {attempt + 1} failed: {type(exc).__name__}")
                await asyncio.sleep(5)
        else:
            raise SystemExit(f"Overpass unavailable for {site['id']}; rerun later")
        osm_file.write_text(json.dumps(osm), encoding="utf-8")
    if site["demo"]:
        osm = osm[:1]  # the demo company "owns" only the one footprint at its pin
    site["osm"] = osm
    print(f"{site['id']}: {len(site['images']['frames'])} frames, {len(osm)} footprints, "
          f"{sum(o['area_m2'] for o in osm):,} m²")


def aa_gst() -> dict:
    sunrise = []
    for i in range(18):  # GSTR-3B filed from Mar 2023 until the registration was cancelled in Aug 2024
        y, m = divmod(2023 * 12 + 2 + i, 12)
        base = 2_350_000 + 420_000 * math.sin(i / 2.3) + (i % 4) * 95_000
        sunrise.append({"period": f"{y}-{m + 1:02d}", "taxable_turnover": round(base), "tax_paid": round(base * 0.18),
                        "filed_on": f"{y}-{m + 1:02d}-20", "return": "GSTR-3B"})
    scale = 31_000_000 / sum(r["taxable_turnover"] for r in sunrise[-12:])
    for r in sunrise:
        r["taxable_turnover"] = round(r["taxable_turnover"] * scale)
        r["tax_paid"] = round(r["taxable_turnover"] * 0.18)
    kaveri = []
    for i in range(18):
        y, m = divmod(2025 * 12 + 3 + i, 12)
        base = 18_400_000 + 1_900_000 * math.sin(i / 2.0)
        kaveri.append({"period": f"{y}-{m + 1:02d}", "taxable_turnover": round(base), "tax_paid": round(base * 0.18),
                       "filed_on": f"{y}-{m + 1:02d}-20", "return": "GSTR-3B"})
    return {"U29304HR2023PTC110482": sunrise, "U29253KA2014PTC074512": kaveri}


async def main() -> None:
    for site in SITES:
        if site.pop("fetch", False):
            await fetch_site(site)
    (SEED_DIR / "ground_sites.json").write_text(json.dumps(SITES, indent=1, ensure_ascii=False), encoding="utf-8")
    (SEED_DIR / "aa_gst.json").write_text(json.dumps(aa_gst(), indent=1), encoding="utf-8")
    print("wrote ground_sites.json and aa_gst.json")


if __name__ == "__main__":
    asyncio.run(main())
