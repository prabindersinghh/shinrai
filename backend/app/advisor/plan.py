"""Advisor plan: rationale, entry route, compliance roadmap, contacts, growth, and the Verify-linked clause pack.

All prose is deterministic and cites KB ids as [kb:id]; cite.postcheck guards anything the LLM might add.
"""
from __future__ import annotations

from .cite import postcheck
from .fit import FACTORS, factor_table, score, sensitivity, weights_for
from .kb import kb

GOALS = {"sell": ("sell in India", "インドで販売"), "manufacture": ("manufacture in India", "インドで製造"),
         "source": ("source from India", "インドから調達"), "export_hub": ("use India as an export hub", "インドを輸出拠点に")}
BAND_KEYS = {"lt50m": "lt50m", "50m_300m": "50m_300m", "300m_1b": "300m_1b", "gt1b": "gt1b"}
SEEKING_TO_PARTNER = {"distributor": "distributor", "jv": "jv", "supplier": "supplier", "contract_mfg": "contract_mfg"}


def _fmt(v, unit=""):
    return "no data" if v is None else f"{v:,.2f}{unit}" if isinstance(v, float) and v % 1 else f"{v:,}{unit}"


def rationale(r: dict, lang: str) -> str:
    raw, state = r["raw"], r["state"]
    top = sorted(FACTORS, key=lambda f: -r["factors"][f])[:3]
    bits_en, bits_ja = [], []
    if raw["manufacturing"] is not None:
        emp = r["cites"]["manufacturing"] == "kb_asi_top5_emp"
        what_en = "of persons engaged in manufacturing" if emp else "of manufacturing gross value added"
        what_ja = "製造業従事者" if emp else "製造業の粗付加価値"
        bits_en.append(f"{state} accounts for {raw['manufacturing']}% of India's {what_en[3:]} in ASI 2022-23 [kb:{r['cites']['manufacturing']}].")
        bits_ja.append(f"{r['name_ja']}はASI 2022-23でインドの{what_ja}の{raw['manufacturing']}%を占めます[kb:{r['cites']['manufacturing']}]。")
    if raw["japan_cluster"] is not None:
        bits_en.append(f"It hosted {raw['japan_cluster']} Japanese companies in October 2021 [kb:kb_jp_states_2021].")
        bits_ja.append(f"2021年10月時点で日系企業{raw['japan_cluster']}社が進出しています[kb:kb_jp_states_2021]。")
    jits = [kb().get(j)["name"] for j in kb().get(r["id"]).get("jits", [])]
    if jits:
        bits_en.append(f"Japan Industrial Townships: {', '.join(jits)} [kb:{kb().get(r['id'])['jits'][0]}].")
        bits_ja.append(f"日本工業団地：{'、'.join(jits)}[kb:{kb().get(r['id'])['jits'][0]}]。")
    bits_en.append(f"Strongest factors: {', '.join(FACTORS[f]['en'].lower() for f in top)}.")
    bits_ja.append(f"主な強み：{'、'.join(FACTORS[f]['ja'] for f in top)}。")
    text = " ".join(bits_en) if lang == "en" else "".join(bits_ja)
    return postcheck(text, set(kb().entries), lang)[0]


def tradeoffs(r: dict, lang: str) -> list[str]:
    weak = [f for f in FACTORS if r["factors"][f] < 0.35 and r["has_data"][f]]
    nodata = [f for f in FACTORS if not r["has_data"][f]]
    out = []
    if weak:
        out.append(("Weaker on " + ", ".join(FACTORS[f]["en"].lower() for f in weak) + ".") if lang == "en"
                   else ("弱み：" + "、".join(FACTORS[f]["ja"] for f in weak) + "。"))
    if nodata:
        out.append(("No published figure for " + ", ".join(FACTORS[f]["en"].lower() for f in nodata) + "; scored neutral.") if lang == "en"
                   else ("公表値なし：" + "、".join(FACTORS[f]["ja"] for f in nodata) + "（中立として評価）。"))
    return out


def white_space_insight(r: dict) -> dict:
    sd = r["support_detail"]
    en = (f"{r['state']} scores {r['fit']} on fit but {r['support']} on Japanese support coverage: the nearest JETRO office or "
          f"consulate is {sd['nearest_office']}, about {sd['nearest_km']} km from the state's centre. Opportunity with thinner "
          "on-the-ground support, so partner verification and a Genba Audit before entry carry more weight. Shinrai complements "
          "JETRO's network here.")
    ja = (f"{r['name_ja']}は適合度{r['fit']}に対し、日本側支援のカバー率は{r['support']}です。最寄りのJETRO事務所・領事館は"
          f"{sd['nearest_office']}（州中心から約{sd['nearest_km']}km）。支援が手薄な機会のため、参入前のパートナー検証と現地監査がより重要です。"
          "ShinraiはJETROのネットワークを補完します。")
    return {"en": en, "ja": ja, "recommendation_en": "Partner verification + Genba Audit before entry",
            "recommendation_ja": "参入前にパートナー検証と現地監査を実施"}


def entry_route(profile: dict) -> dict:
    k = kb()
    band, goal = profile.get("investment_band") or "50m_300m", profile.get("goal") or "sell"
    table = k.raw["entry_routes"]["footprint"]
    row = next((x for x in table if x["band"] == band and x["goal"] == goal), None) or \
        next((x for x in table if x["band"] == "any" and x["goal"] == goal), None) or \
        next((x for x in table if x["band"] == band), table[0])
    route_id, alt_id = row["route"], row["alt"]
    pref = profile.get("entry_mode")
    reasons_en = [f"Investment band and goal ({GOALS[goal][0]}) map to this starting footprint [kb:{route_id}]."]
    reasons_ja = [f"投資規模と目的（{GOALS[goal][1]}）に基づく推奨の初期形態です[kb:{route_id}]。"]
    if profile.get("timeline_months") == 6 and route_id in ("rt_wos", "rt_jv"):
        route_id, alt_id = alt_id if alt_id not in ("rt_wos", "rt_jv") else "rt_distributor", route_id
        reasons_en.append("A 6-month timeline favours a lighter first step; the subsidiary becomes the follow-on option.")
        reasons_ja.append("6か月の期間では軽い初期形態が適しており、子会社は次の段階の選択肢とします。")
    pref_map = {"distributor": "rt_distributor", "jv": "rt_jv", "wos": "rt_wos", "liaison": "rt_liaison", "contract_mfg": "rt_contract_mfg"}
    if pref in pref_map and pref_map[pref] not in (route_id, alt_id):
        alt_id = pref_map[pref]
        reasons_en.append("Your preferred entry mode is kept as the alternative.")
        reasons_ja.append("ご希望の参入形態を代替案として示しています。")
    sector = next((s for s in k.section("sectors", "sectors") if s["id"] == {"auto_parts": "sec_auto_components", "electronics": "sec_electronics",
                                                                           "food": "sec_food_processing"}.get(profile.get("industry"), "")), None)
    if sector:
        reasons_en.append(f"FDI in {sector['name'].lower()} is under the {sector['fdi_route'].lower()} up to {sector['fdi_cap_pct']}% [kb:{sector['id']}].")
        reasons_ja.append(f"{sector['name_ja']}の外国直接投資は{sector['fdi_cap_pct']}%まで自動承認ルートです[kb:{sector['id']}]。")
    valid = set(k.entries)
    return {"route": _route(route_id), "alternative": _route(alt_id), "advice_en": row["advice_en"], "advice_ja": row["advice_ja"],
            "reasons_en": [postcheck(x, valid, "en")[0] for x in reasons_en], "reasons_ja": [postcheck(x, valid, "ja")[0] for x in reasons_ja],
            "sector": sector and {k_: sector[k_] for k_ in ("id", "name", "name_ja", "fdi_route", "fdi_cap_pct", "pli", "regulators", "notes")}}


def _route(rid: str) -> dict:
    r = kb().get(rid)
    return {k: r.get(k) for k in ("id", "name", "name_ja", "entity", "approvals", "pros", "cons", "setup_steps", "source_url", "as_of",
                                   "verified_by_team")}


def roadmap(route: dict, statuses: dict) -> list[dict]:
    steps = []
    for sid in route["setup_steps"]:
        s = kb().get(sid)
        steps.append({k: s.get(k) for k in ("id", "name", "name_ja", "authority", "form", "trigger", "deadline", "start", "days", "owner",
                                              "why_en", "why_ja", "docs", "critical", "source_name", "source_url", "as_of", "verified_by_team")}
                     | {"status": statuses.get(sid, "not_started")})
    return steps


def contacts(states: list[str], industry: str) -> list[dict]:
    sec = {"auto_parts": "sec_auto_components", "electronics": "sec_electronics", "food": "sec_food_processing"}.get(industry)
    out = []
    for c in kb().section("contacts", "contacts"):
        st_ok = "all" in c["states"] or any(s in c["states"] for s in states)
        se_ok = "all" in c["sectors"] or sec in c["sectors"]
        if st_ok and se_ok:
            out.append({k: c[k] for k in ("id", "kind", "name", "name_ja", "channel", "source_url", "as_of", "verified_by_team")}
                       | {"states": c["states"]})
    return out


def growth(profile: dict) -> dict:
    goal = profile.get("goal") or "sell"
    plays = kb().section("growth_playbooks", "playbooks")
    preferred = {"manufacture": "gp_oem_supplier" if profile.get("industry") == "auto_parts" else "gp_phased",
                 "sell": "gp_phased", "source": "gp_export_hub", "export_hub": "gp_export_hub"}.get(goal, "gp_phased")
    pick = next((p for p in plays if p["id"] == preferred), plays[0])
    levers = [kb().get(l) for l in pick["levers"]]
    phases = [ph | {"mode_name": kb().get(ph["mode"])["name"], "mode_name_ja": kb().get(ph["mode"])["name_ja"]} for ph in pick["phases"]]
    return {"playbook": {k: pick[k] for k in ("id", "name_en", "name_ja")}, "phases": phases,
            "levers": [{k: l[k] for k in ("id", "name_en", "name_ja", "text_en", "text_ja", "source_url", "as_of", "verified_by_team")} for l in levers],
            "alternatives": [{k: p[k] for k in ("id", "name_en", "name_ja")} for p in plays if p["id"] != pick["id"] and goal in p["goals"]]}


def advise(profile: dict, statuses: dict | None = None) -> dict:
    rows = factor_table(profile)
    w = weights_for(profile)
    ranked = score(rows, w)
    top = ranked[:3]
    route = entry_route(profile)
    return {
        "profile": profile, "weights": w, "factors": {f: v for f, v in FACTORS.items()}, "states": ranked,
        "top": [{"state": r["state"], "name_ja": r["name_ja"], "fit": r["fit"], "rationale_en": rationale(r, "en"),
                 "rationale_ja": rationale(r, "ja"), "tradeoffs_en": tradeoffs(r, "en"), "tradeoffs_ja": tradeoffs(r, "ja")} for r in top],
        "sensitivity": sensitivity(rows, w),
        "white_space": [{"state": r["state"], "name_ja": r["name_ja"], "fit": r["fit"], "support": r["support"], **white_space_insight(r)}
                        for r in ranked if r["is_white_space"]],
        "entry": route, "roadmap": roadmap(route["route"], statuses or {}),
        "contacts": contacts([r["state"] for r in top], profile.get("industry", "")),
        "growth": growth(profile),
        "support_network": {s: kb().section("support_network", s) for s in ("offices", "jits", "agencies")},
        "kb_facts": [kb().citation(i) for i in ("kb_asi_top5_gva", "kb_asi_top5_emp", "kb_jp_states_2021", "kb_jp_total_2024", "kb_fdi_h1fy25")],
    }


def clause_pack(partner_type: str, flags: list[dict]) -> dict:
    """Base clauses for the partner type plus risk-driven clauses triggered by this partner's Verify flags."""
    clauses = kb().section("clauses", "clauses")
    by_rule: dict[str, list[dict]] = {}
    for f in flags:
        by_rule.setdefault(f["rule_id"], []).append(f)
    out = []
    for c in clauses:
        if partner_type not in c["partner_types"]:
            continue
        triggers = [t for t in c.get("triggered_by", []) if t in by_rule]
        if not c["base"] and not triggers:
            continue
        because = [{"rule_id": t, "text_en": by_rule[t][0]["text_en"], "text_ja": by_rule[t][0]["text_ja"],
                    "evidence_ids": sorted({e for f in by_rule[t] for e in f["evidence_ids"]})} for t in triggers]
        out.append({k: c[k] for k in ("id", "title_en", "title_ja", "text_en", "text_ja", "law", "source_url", "as_of", "verified_by_team")}
                   | {"base": c["base"], "added_because": because})
    meta = kb().raw["clauses"]["meta"]
    return {"partner_type": partner_type, "clauses": out, "risk_driven": sum(1 for c in out if c["added_because"]),
            "disclaimer_en": meta["disclaimer_en"], "disclaimer_ja": meta["disclaimer_ja"]}
