"""Yearly Sentinel-2 L2A frames (least-cloudy dry-season scene) via Microsoft Planetary Computer. No key."""
from __future__ import annotations

import asyncio

import httpx

from ..config import DATA_DIR
from .base import NotAvailable
from .ground_common import GroundAdapter, bbox, site_dir, seed_site_near

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
RENDER = "https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/{b0},{b1},{b2},{b3}/512x512.png"


class ImageryTimelapse(GroundAdapter):
    name = "imagery_timelapse"
    source_name = "Sentinel-2 L2A (Planetary Computer)"
    url = "https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a"
    timeout_s = 60.0

    async def _year(self, client: httpx.AsyncClient, sem: asyncio.Semaphore, lat: float, lon: float, year: int,
                    b: tuple, rel_dir: str) -> dict | None:
        async with sem:
            for window, cloud in ((f"{year}-01-01/{year}-05-31", 10), (f"{year}-01-01/{year}-12-31", 30)):
                body = {"collections": ["sentinel-2-l2a"], "intersects": {"type": "Point", "coordinates": [lon, lat]},
                        "datetime": window, "query": {"eo:cloud_cover": {"lt": cloud}},
                        "sortby": [{"field": "eo:cloud_cover", "direction": "asc"}], "limit": 1}
                resp = await client.post(STAC, json=body)
                resp.raise_for_status()
                feats = resp.json().get("features", [])
                if feats:
                    break
            else:
                return None
            f = feats[0]
            img = await client.get(RENDER.format(b0=b[0], b1=b[1], b2=b[2], b3=b[3]), params={
                "collection": "sentinel-2-l2a", "item": f["id"], "assets": "visual", "asset_bidx": "visual|1,2,3",
                "nodata": 0})
            img.raise_for_status()
            rel = f"{rel_dir}/s2_{year}.png"
            (DATA_DIR / rel).write_bytes(img.content)
            return {"year": year, "path": rel, "scene": f["id"], "date": f["properties"]["datetime"][:10],
                    "cloud": round(f["properties"].get("eo:cloud_cover", 0), 2)}

    async def live(self, query: dict) -> list[dict]:
        lat, lon = query["lat"], query["lon"]
        b = bbox(lat, lon, query.get("half_m", 500))
        rel_dir = site_dir(query['site'])
        sem = asyncio.Semaphore(4)
        async with httpx.AsyncClient(timeout=40) as client:
            frames = await asyncio.gather(*(self._year(client, sem, lat, lon, y, b, rel_dir) for y in query["years"]),
                                          return_exceptions=True)
        return [{**f, "bbox": b} for f in frames if isinstance(f, dict)]

    def seed(self, query: dict) -> tuple[list[dict], str]:
        site = seed_site_near(query["lat"], query["lon"])
        if not site or not site.get("images", {}).get("frames"):
            raise NotAvailable("no seed frames for this site")
        b = bbox(site["lat"], site["lon"], query.get("half_m", 500))
        return [{**f, "bbox": b} for f in site["images"]["frames"]], site.get("mode", "seed")

    def summarize(self, records: list[dict]) -> str:
        if not records:
            return "no cloud-free scenes"
        return f"{len(records)} scenes · {records[0]['year']}→{records[-1]['year']}"
