"""In-memory index over data/seed/*.json used by every adapter's SEED mode."""
from __future__ import annotations

import json
import re
from functools import lru_cache

from rapidfuzz import fuzz

from ..config import SEED_DIR

_SUFFIX = re.compile(r"\b(private|pvt|limited|ltd|llp|india|co|company|the)\b\.?", re.I)


def norm_name(name: str) -> str:
    return re.sub(r"\s+", " ", _SUFFIX.sub(" ", (name or "").lower().replace(".", " "))).strip()


class SeedStore:
    def __init__(self) -> None:
        self.files: dict[str, dict] = {}
        self.companies: dict[str, dict] = {}  # cin -> master record (+ _seed id, _mode)
        self.gst_by_cin: dict[str, list[dict]] = {}
        self.directors_by_cin: dict[str, list[dict]] = {}
        self.companies_by_din: dict[str, list[str]] = {}
        self.cases: list[dict] = []
        self.insolvency: list[dict] = []
        self.news: dict[str, list[dict]] = {}
        self.strikeoff: dict[str, dict] = {}
        self.disqualified: dict[str, dict] = {}
        self._load()

    def _load(self) -> None:
        for path in sorted(SEED_DIR.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            if path.stem == "strikeoff_list":
                self.strikeoff = {r["cin"]: r for r in data}
                continue
            if path.stem == "disqualified_directors":
                self.disqualified = {r["din"]: r for r in data}
                continue
            if not isinstance(data, dict) or "company" not in data:
                continue  # ground_sites, aa_gst, auditors: read by their own adapters
            sid, mode = data["id"], data.get("mode", "seed")
            self.files[sid] = data
            main = data["company"]
            self.companies[main["cin"]] = {**main, "_seed": sid, "_mode": mode, "_main": True}
            for cin, c in data.get("linked_companies", {}).items():
                self.companies.setdefault(cin, {**c, "_seed": sid, "_mode": mode, "_main": False})
            self.gst_by_cin[main["cin"]] = data.get("gst", [])
            for cin, g in data.get("linked_gst", {}).items():
                self.gst_by_cin.setdefault(cin, [g])
            self.directors_by_cin[main["cin"]] = data.get("directors", [])
            for d in data.get("directors", []):
                key = d.get("din") or f"name:{d['name']}"
                self.companies_by_din[key] = d["companies"]
            self.cases += [{**c, "_seed": sid, "_mode": mode} for c in data.get("cases", [])]
            self.insolvency += [{**i, "_seed": sid, "_mode": mode} for i in data.get("insolvency", [])]
            self.news[main["cin"]] = [{**n, "_mode": mode} for n in data.get("news", [])]

    def seed_for(self, cin: str) -> dict | None:
        c = self.companies.get(cin)
        return self.files.get(c["_seed"]) if c else None

    def mode_for(self, cin: str) -> str:
        return self.companies.get(cin, {}).get("_mode", "seed")

    def find_by_name(self, name: str, threshold: int = 90) -> tuple[dict | None, int]:
        target = norm_name(name)
        best, best_score = None, 0
        for cin, c in self.companies.items():
            if not c.get("_main"):
                continue
            names = [c["name"], *self.files[c["_seed"]].get("aliases", [])]
            score = max(fuzz.ratio(target, norm_name(n)) for n in names)
            if score > best_score:
                best, best_score = c, score
        return (best, best_score) if best_score >= threshold else (None, best_score)

    def find_by_pan(self, pan: str) -> dict | None:
        return next((c for c in self.companies.values() if c.get("pan") == pan), None)

    def find_by_gstin(self, gstin: str) -> dict | None:
        for cin, rows in self.gst_by_cin.items():
            if any(r["gstin"] == gstin for r in rows):
                return self.companies.get(cin)
        return None


@lru_cache(maxsize=1)
def store() -> SeedStore:
    return SeedStore()
