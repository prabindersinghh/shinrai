"""Night-time lights (VIIRS Black Marble) at the site vs a 1–2 km ring, last 36 months. Earth Engine or SEED."""
from __future__ import annotations

import asyncio
from datetime import date

from .base import NotAvailable
from .ground_common import EE_PROJECT, GroundAdapter, seed_site_near

DATASET = "NASA/VIIRS/002/VNP46A2"


def _ee_series(lat: float, lon: float) -> list[dict]:
    import ee

    ee.Initialize(project=EE_PROJECT)
    pt = ee.Geometry.Point([lon, lat])
    site, ring = pt.buffer(250), pt.buffer(2000).difference(pt.buffer(1000))
    today = date.today()
    out = []
    for i in range(36, 0, -1):
        y, m = divmod(today.year * 12 + today.month - 1 - i, 12)
        start = ee.Date.fromYMD(y, m + 1, 1)
        img = ee.ImageCollection(DATASET).filterDate(start, start.advance(1, "month")).select(
            "Gap_Filled_DNB_BRDF_Corrected_NTL").mean()
        vals = ee.Dictionary({
            "site": img.reduceRegion(ee.Reducer.mean(), site, 500).values().get(0),
            "ring": img.reduceRegion(ee.Reducer.mean(), ring, 500).values().get(0)}).getInfo()
        out.append({"month": f"{y}-{m + 1:02d}", "site": round(vals.get("site") or 0, 2),
                    "ring": round(vals.get("ring") or 0, 2)})
    return out


class NightLights(GroundAdapter):
    name = "nightlights"
    source_name = "VIIRS Black Marble"
    url = "https://developers.google.com/earth-engine/datasets/catalog/NASA_VIIRS_002_VNP46A2"
    timeout_s = 12.0

    async def live(self, query: dict) -> list[dict]:
        if not EE_PROJECT:
            raise NotAvailable("Earth Engine not configured (EE_PROJECT)")
        try:
            import ee  # noqa: F401
        except ImportError as exc:
            raise NotAvailable("earthengine-api not installed") from exc
        return await asyncio.to_thread(_ee_series, query["lat"], query["lon"])

    def seed(self, query: dict) -> tuple[list[dict], str]:
        site = seed_site_near(query["lat"], query["lon"])
        if not site or "nightlights" not in site:
            raise NotAvailable("no seed night-light series for this site")
        return site["nightlights"], site.get("mode", "seed")

    def summarize(self, records: list[dict]) -> str:
        if not records:
            return "no data"
        site = sum(r["site"] for r in records[-12:]) / 12
        ring = sum(r["ring"] for r in records[-12:]) / 12 or 1
        return f"{len(records)} months · activity ratio {site / ring:.2f}"
