"""Bounded LLM calls (TRD §7): JSON-schema structured output, cached by input hash in SQLite.

Returns None whenever the model is unavailable so callers fall back to their deterministic path.
"""
from __future__ import annotations

import hashlib
import json
import logging

from ..config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL
from ..models import LlmCache, session

log = logging.getLogger("shinrai.llm")


def _key(purpose: str, system: str, user: str, schema: dict) -> str:
    blob = json.dumps([ANTHROPIC_MODEL, purpose, system, user, schema], sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(blob.encode()).hexdigest()


def cached(purpose: str, key: str):
    with session() as s:
        row = s.get(LlmCache, key)
        return row.output if row else None


async def structured(purpose: str, system: str, user: str, schema: dict, max_tokens: int = 8000,
                     effort: str = "low") -> dict | None:
    key = _key(purpose, system, user, schema)
    hit = cached(purpose, key)
    if hit is not None:
        return hit
    if not ANTHROPIC_API_KEY:
        return None
    try:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY, timeout=60.0, max_retries=1)
        resp = await client.messages.create(
            model=ANTHROPIC_MODEL, max_tokens=max_tokens, system=system,
            messages=[{"role": "user", "content": user}],
            output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
        )
        if resp.stop_reason in ("refusal", "max_tokens"):
            log.warning("llm %s stopped: %s", purpose, resp.stop_reason)
            return None
        text = next(b.text for b in resp.content if b.type == "text")
        data = json.loads(text)
    except Exception as exc:  # noqa: BLE001 - any failure means "use the deterministic path"
        log.warning("llm %s failed: %s", purpose, exc)
        return None
    with session() as s:
        s.merge(LlmCache(key=key, purpose=purpose, output=data))
        s.commit()
    return data


def available() -> bool:
    return bool(ANTHROPIC_API_KEY)


CAPTION_SCHEMA = {"type": "object", "properties": {"caption": {"type": "string"}}, "required": ["caption"],
                  "additionalProperties": False}


async def caption_image(rel_path: str) -> str | None:
    """One descriptive line about a satellite image. Display only: never feeds a rule."""
    import base64

    from ..config import DATA_DIR

    path = DATA_DIR / rel_path
    if not path.exists():
        return None
    data = path.read_bytes()
    key = hashlib.sha256(b"caption" + ANTHROPIC_MODEL.encode() + data).hexdigest()
    hit = cached("ground.caption", key)
    if hit is not None:
        return hit.get("caption")
    try:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY, timeout=60.0, max_retries=1)
        resp = await client.messages.create(
            model=ANTHROPIC_MODEL, max_tokens=2000,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                             "data": base64.b64encode(data).decode()}},
                {"type": "text", "text": "Describe what is visible in this overhead satellite image in one short line "
                                         "(for example: 'industrial sheds, loading bay, parked trucks' or 'vacant plot'). "
                                         "Describe only; do not judge."}]}],
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": CAPTION_SCHEMA}},
        )
        out = json.loads(next(b.text for b in resp.content if b.type == "text"))
    except Exception as exc:  # noqa: BLE001
        log.warning("caption failed: %s", exc)
        return None
    with session() as s:
        s.merge(LlmCache(key=key, purpose="ground.caption", output=out))
        s.commit()
    return out.get("caption")
