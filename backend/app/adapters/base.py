"""SourceAdapter base: LIVE -> CACHED -> SEED resolution with write-through cache. Never raises."""
from __future__ import annotations

import asyncio
import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Any

from ..config import ADAPTER_MODE_DEFAULT, CACHE_DIR, env

MODES = ("live", "cached", "seed")
# Some government APIs (data.gov.in) stall requests with a library default User-Agent.
HTTP_HEADERS = {"User-Agent": "Shinrai/1.0 (partner due-diligence research)"}


class NotAvailable(Exception):
    """This mode cannot serve the query (no key, not installed, no record)."""


@dataclass
class AdapterResult:
    adapter: str
    source_name: str
    query: dict
    status: str = "ok"  # ok | empty | failed | skipped
    records: list[dict] = field(default_factory=list)
    mode_used: str = "seed"
    latency_ms: int = 0
    url: str = ""
    summary: str = ""
    error: str = ""
    attempts: list[dict] = field(default_factory=list)

    @property
    def checked(self) -> bool:
        return self.status in ("ok", "empty")


def query_hash(adapter: str, query: dict) -> str:
    blob = json.dumps({"a": adapter, "q": query}, sort_keys=True, default=str)
    return hashlib.sha256(blob.encode()).hexdigest()[:20]


class SourceAdapter:
    name = "base"
    source_name = "Source"
    url = ""
    timeout_s = 8.0

    def mode_order(self, requested: str) -> list[str]:
        override = env(f"ADAPTER_MODE_{self.name.upper()}", "")
        requested = override or requested or ADAPTER_MODE_DEFAULT
        if requested == "seed":
            return ["seed", "cached"]
        if requested == "cached":
            return ["cached", "seed"]
        return list(MODES)

    async def live(self, query: dict) -> list[dict]:
        raise NotAvailable("no live source configured")

    def seed(self, query: dict) -> tuple[list[dict], str]:
        """Return (records, mode tag). Seed files tag real recorded data as 'cached'."""
        raise NotAvailable("no seed data")

    def summarize(self, records: list[dict]) -> str:
        return f"{len(records)} record{'s' if len(records) != 1 else ''}"

    def _cache_path(self, query: dict):
        return CACHE_DIR / f"{self.name}_{query_hash(self.name, query)}.json"

    def _read_cache(self, query: dict) -> list[dict]:
        path = self._cache_path(query)
        if not path.exists():
            raise NotAvailable("not in cache")
        return json.loads(path.read_text(encoding="utf-8"))["records"]

    def _write_cache(self, query: dict, records: list[dict]) -> None:
        payload = {"adapter": self.name, "query": query, "saved_at": time.time(), "records": records}
        self._cache_path(query).write_text(json.dumps(payload, indent=1, default=str), encoding="utf-8")

    async def _live_with_deadline(self, query: dict) -> list[dict]:
        """Hard deadline. asyncio.wait_for waits for a cancelled call to unwind, which never happens when a client
        is stuck in DNS or a thread; here an overrunning call is cancelled and abandoned instead."""
        task = asyncio.ensure_future(self.live(query))
        done, _ = await asyncio.wait({task}, timeout=self.timeout_s)
        if not done:
            task.cancel()
            task.add_done_callback(lambda t: t.cancelled() or t.exception())  # silence "never retrieved"
            raise asyncio.TimeoutError
        return task.result()

    async def fetch(self, query: dict, mode: str = "auto") -> AdapterResult:
        result = AdapterResult(adapter=self.name, source_name=self.source_name, query=query, url=self.url)
        started = time.perf_counter()
        for m in self.mode_order(mode):
            t0 = time.perf_counter()
            try:
                if m == "live":
                    records = await self._live_with_deadline(query)
                    try:
                        self._write_cache(query, records)
                    except OSError:
                        pass
                    tag = "live"
                elif m == "cached":
                    records, tag = self._read_cache(query), "cached"
                else:
                    records, tag = self.seed(query)
                result.records, result.mode_used = records, tag
                result.status = "ok" if records else "empty"
                result.attempts.append({"mode": m, "ok": True, "ms": int((time.perf_counter() - t0) * 1000)})
                break
            except NotAvailable as exc:
                result.attempts.append({"mode": m, "ok": False, "skip": True, "error": str(exc)})
            except asyncio.TimeoutError:
                result.attempts.append({"mode": m, "ok": False, "error": f"timeout after {self.timeout_s:.0f}s"})
            except Exception as exc:  # noqa: BLE001 - adapters must never raise into the orchestrator
                result.attempts.append({"mode": m, "ok": False, "error": f"{type(exc).__name__}: {exc}"[:200]})
        else:
            hard = [a for a in result.attempts if not a.get("skip")]
            result.status = "failed" if hard else "skipped"
            result.error = "; ".join(f"{a['mode']}: {a['error']}" for a in result.attempts)
            result.mode_used = hard[0]["mode"] if hard else "none"
        result.latency_ms = int((time.perf_counter() - started) * 1000)
        result.summary = self.summarize(result.records) if result.checked else (
            "source unavailable" if result.status == "failed" else "not checked")
        return result


def pick(record: dict, *names: str, default: Any = None) -> Any:
    """Tolerant field lookup across source schemas (case/underscore-insensitive)."""
    flat = {k.lower().replace("_", "").replace(" ", ""): v for k, v in record.items()}
    for n in names:
        v = flat.get(n.lower().replace("_", "").replace(" ", ""))
        if v not in (None, "", "NA"):
            return v
    return default
