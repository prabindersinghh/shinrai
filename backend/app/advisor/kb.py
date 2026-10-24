"""Knowledge base: loads and validates the curated YAML, and retrieves entries with BM25.

Every entry carries id, source_url and as_of; verified_by_team marks facts confirmed against a fetched primary
source. The Advisor states facts only from here, never from model memory.
"""
from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

import yaml
from rank_bm25 import BM25Okapi

KB_DIR = Path(__file__).resolve().parent / "kb"
REQUIRED = ("id", "source_url", "as_of", "verified_by_team")


class KB:
    def __init__(self) -> None:
        self.raw = {p.stem: yaml.safe_load(p.read_text(encoding="utf-8")) for p in sorted(KB_DIR.glob("*.yaml"))}
        self.entries: dict[str, dict] = {}
        self.sources = {s["id"]: s for s in self.raw["states"]["sources"].values()}
        for name, data in self.raw.items():
            for section, items in data.items():
                if not isinstance(items, list):
                    continue
                for item in items:
                    if isinstance(item, dict) and "id" in item:
                        item = self._with_source(item)
                        missing = [k for k in REQUIRED if k not in item]
                        if missing:
                            raise ValueError(f"KB entry {item['id']} in {name}.{section} lacks {missing}")
                        self.entries[item["id"]] = {**item, "_file": name, "_section": section}
        for s in self.sources.values():
            self.entries[s["id"]] = {**s, "_file": "states", "_section": "sources"}
        docs = [self._text(e) for e in self.entries.values()]
        self._ids = list(self.entries)
        self._bm25 = BM25Okapi([self._tokens(d) for d in docs])

    def _with_source(self, item: dict) -> dict:
        """Facts reference a shared source by id; inline its citation fields."""
        src = self.sources.get(item.get("source"))
        if src:
            return {**item, "source_name": src["source_name"], "source_url": src["source_url"], "as_of": src["as_of"],
                    "verified_by_team": src["verified_by_team"]}
        return item

    @staticmethod
    def _text(e: dict) -> str:
        return " ".join(str(v) for k, v in e.items() if isinstance(v, (str, int, float)) and not k.startswith("_"))

    @staticmethod
    def _tokens(text: str) -> list[str]:
        return re.findall(r"[a-z0-9]+", text.lower())

    def get(self, kb_id: str) -> dict:
        return self.entries[kb_id]

    def citation(self, kb_id: str) -> dict:
        e = self.entries[kb_id]
        return {"id": kb_id, "source_name": e.get("source_name") or e.get("name") or e.get("name_en") or kb_id,
                "source_url": e["source_url"], "as_of": str(e["as_of"]), "verified": bool(e["verified_by_team"])}

    def search(self, query: str, k: int = 5) -> list[dict]:
        scores = self._bm25.get_scores(self._tokens(query))
        ranked = sorted(zip(scores, self._ids), reverse=True)[:k]
        return [self.entries[i] for s, i in ranked if s > 0]

    def section(self, file: str, section: str) -> list[dict]:
        return [e for e in self.entries.values() if e["_file"] == file and e["_section"] == section]


@lru_cache(maxsize=1)
def kb() -> KB:
    return KB()
