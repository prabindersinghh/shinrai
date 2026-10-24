"""Headline tone: adverse | neutral. LLM when available, else a transparent keyword classifier."""
from __future__ import annotations

import json
import re

from . import llm

ADVERSE = re.compile(
    r"\b(fraud|scam|probe|raid|raided|arrest|arrested|default|defaulted|insolvency|bankrupt|liquidation|cheat|cheating|"
    r"fake|show-cause|penalty|penalised|penalized|seized|money laundering|ed |cbi|sebi bars|blacklist|blacklisted|"
    r"embezzle|forgery|evasion|unpaid|ponzi|wilful defaulter|struck off)\b", re.I)

SCHEMA = {"type": "object", "properties": {"items": {"type": "array", "items": {
    "type": "object", "properties": {"index": {"type": "integer"}, "tone": {"type": "string", "enum": ["adverse", "neutral"]},
                                     "reason": {"type": "string"}},
    "required": ["index", "tone", "reason"], "additionalProperties": False}}},
    "required": ["items"], "additionalProperties": False}

SYSTEM = ("Classify each news headline about an Indian company or person for counterparty due diligence. "
          "'adverse' means it reports fraud, default, insolvency, regulatory action, raids, litigation losses or "
          "similar integrity or solvency risk for the named party. Everything else is 'neutral'. Give a short reason.")


def keyword(article: dict) -> dict:
    text = f"{article.get('title', '')} {article.get('snippet', '')}"
    m = ADVERSE.search(text)
    return {"tone": "adverse" if m else "neutral", "reason": f"keyword “{m.group(0).strip()}”" if m else "no risk terms",
            "method": "keywords"}


async def classify_news(articles: list[dict]) -> list[dict]:
    if not articles:
        return []
    if llm.available():
        payload = json.dumps([{"index": i, "title": a.get("title"), "snippet": a.get("snippet")}
                              for i, a in enumerate(articles)], ensure_ascii=False)
        out = await llm.structured("news.classify", SYSTEM, payload, SCHEMA, max_tokens=4000)
        if out and len(out.get("items", [])) == len(articles):
            by_index = {it["index"]: it for it in out["items"]}
            if set(by_index) == set(range(len(articles))):
                return [{"tone": by_index[i]["tone"], "reason": by_index[i]["reason"], "method": "llm"}
                        for i in range(len(articles))]
    return [keyword(a) for a in articles]
