"""JA/EN narrative (cited), suggestions and meeting questions. LLM writes prose only from the facts JSON."""
from __future__ import annotations

import json
import re

from . import llm

CITE = re.compile(r"\[(ev_\d+(?:\s*,\s*ev_\d+)*)\]")
SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}

NARRATIVE_SCHEMA = {
    "type": "object",
    "properties": {
        "summary_ja": {"type": "string"}, "summary_en": {"type": "string"},
        "suggestions": {"type": "array", "items": {"type": "object", "properties": {
            "ja": {"type": "string"}, "en": {"type": "string"}}, "required": ["ja", "en"], "additionalProperties": False}},
        "meeting_questions": {"type": "array", "items": {"type": "object", "properties": {
            "ja": {"type": "string"}, "en": {"type": "string"}}, "required": ["ja", "en"], "additionalProperties": False}},
    },
    "required": ["summary_ja", "summary_en", "suggestions", "meeting_questions"], "additionalProperties": False,
}

NARRATIVE_SYSTEM = """あなたは日本の中小企業の稟議資料を作成する与信調査アナリストです。
入力はインド企業に関する調査結果のJSON（会社情報・フラグ・主張検証・証拠ID）だけです。
- 入力に存在しない事実を一切書かないでください。推測、一般論、外部知識は禁止です。
- 事実を述べるすべての文の末尾に、根拠となる証拠IDを [ev_3] や [ev_3, ev_7] の形で付けてください。入力にない証拠IDは使わないでください。
- summary_ja はビジネス日本語（です・ます調の敬語）で4〜6文。summary_en は同じ内容の英語。
- スコアやフラグの判断を変更・追加しないでください。判断はルールエンジンが既に行っています。
- suggestions と meeting_questions は具体的な次の行動（取り寄せる書類、初回面談での質問、現地訪問、前払い上限やエスクローなどの契約上の保護）。"""

PLAYBOOK = {
    "ID_NOT_FOUND": [("Confirm the exact legal name and CIN with the partner before any further step.",
                      "次の手続きに進む前に、正式な商号とCINを相手方に確認してください。")],
    "ID_STATUS_NOT_ACTIVE": [("Do not sign: the company is not active on the MCA register.",
                              "MCA上で有効な法人ではないため、契約を締結しないでください。")],
    "ID_GSTIN_PAN_MISMATCH": [("Ask why the GSTIN supplied belongs to a different PAN or legal name.",
                               "提示されたGSTINが別のPAN・商号に属する理由を確認してください。")],
    "CMP_GST_CANCELLED": [("Make no advance payment until the partner shows an active GSTIN that you verify on the GST portal yourself.",
                           "有効なGSTINを提示し、GSTポータルで自社確認できるまで前払いは行わないでください。")],
    "CMP_FILING_OVERDUE": [("Request audited financial statements for the last three years and MCA filing receipts (AOC-4, MGT-7).",
                            "直近3期分の監査済み財務諸表とMCA提出控（AOC-4、MGT-7）を取り寄せてください。")],
    "NET_STRUCKOFF_LINKS": [("Run a background check on the linked director and ask why the related companies were struck off.",
                             "関連取締役の経歴調査を実施し、関係会社が登記抹消された理由を確認してください。")],
    "NET_SHARED_ADDRESS_CLUSTER": [("Visit the registered office and the claimed factory before signing.",
                                    "契約前に登記上の本店と主張されている工場を現地訪問してください。")],
    "NET_HIGH_DEGREE_DIRECTOR": [("Ask the director how their time is split across companies and whether related-party trades exist.",
                                  "兼任先での業務配分と関連当事者取引の有無を取締役に確認してください。")],
    "NET_DIRECTOR_DISQUALIFIED": [("Do not proceed while a disqualified director sits on the board.",
                                   "資格停止中の取締役が在任している間は取引を進めないでください。")],
    "LEG_INSOLVENCY": [("Do not sign: insolvency proceedings are running against the company.",
                        "倒産手続きが進行中のため契約を締結しないでください。")],
    "LEG_CASES_AS_RESPONDENT": [("Obtain the status of each pending case and a short opinion from Indian counsel.",
                                 "係属中の各訴訟の状況を入手し、インドの弁護士の簡易意見を取得してください。")],
    "CLM_CONTRADICTED": [("Ask the partner to document each contradicted brochure claim in writing.",
                          "矛盾が判明した会社資料の主張について、書面での裏付けを求めてください。")],
    "REP_ADVERSE_NEWS": [("Ask the partner to explain the adverse news coverage.",
                          "否定的な報道について相手方に説明を求めてください。")],
}
CONTRACT = {
    "high": ("Limit advance payment to zero; use a letter of credit or escrow and start with a trial order.",
             "前払いはゼロとし、信用状またはエスクローを利用して試験発注から始めてください。"),
    "caution": ("Cap advance payment at 10% and use escrow or a letter of credit for the first orders.",
                "前払いは10%以内とし、初回取引はエスクローまたは信用状を利用してください。"),
    "standard": ("Use standard terms with a letter of credit for the first order.",
                 "初回取引は信用状付きの標準条件で進めてください。"),
    "low": ("Normal commercial terms are reasonable; re-check the records before renewal.",
            "通常の取引条件で問題ありません。契約更新前に記録を再確認してください。"),
    "insufficient": ("Collect the missing records before deciding; the registry could not be checked.",
                     "登記情報を確認できなかったため、判断前に不足している記録を収集してください。"),
}
QUESTIONS = {
    "founded_year": ("Which legal entity carried your earlier years of experience, and can you show its records?",
                     "それ以前の事業実績はどの法人によるものですか。その記録をご提示いただけますか。"),
    "location": ("Can we visit the facility, and under which GST registration does it operate?",
                 "工場を訪問できますか。また、どのGST登録で運営されていますか。"),
    "turnover": ("Please share audited accounts and GST returns that support the stated turnover.",
                 "記載の売上高を裏付ける監査済み財務諸表とGST申告書をご提示ください。"),
    "certification": ("Please share the certificate number and the issuing body so we can verify it.",
                      "認証番号と認証機関をお知らせください。こちらで照会いたします。"),
    "clients": ("Which customers can we contact as references?", "照会先としてご紹介いただける取引先はどちらですか。"),
    "employees": ("Can you share EPFO registration details for your workforce?", "従業員のEPFO登録情報をご提示いただけますか。"),
    "capacity": ("Can we see the production lines that deliver the stated capacity?", "記載の生産能力を担う生産ラインを拝見できますか。"),
}


def postcheck(text: str, valid: set[str], lang: str) -> tuple[str, int]:
    """Keep only sentences whose citations all exist; drop uncited sentences. Returns (text, dropped)."""
    parts = re.split(r"(?<=。)" if lang == "ja" else r"(?<=[.!?])\s+", text.strip())
    kept, dropped = [], 0
    for s in (p.strip() for p in parts):
        if not s:
            continue
        cites = [c.strip() for group in CITE.findall(s) for c in group.split(",")]
        if cites and all(c in valid for c in cites):
            kept.append(s)
        else:
            dropped += 1
    return ("" if lang == "ja" else " ").join(kept), dropped


def _cite(ids: list[str]) -> str:
    return f"[{', '.join(dict.fromkeys(ids))}]"


def template_summary(facts_json: dict) -> tuple[str, str]:
    co, flags, claims, score = facts_json["company"], facts_json["flags"], facts_json["claims"], facts_json["score"]
    ev_co = facts_json["evidence"].get("company", [])
    en, ja = [], []
    if co:
        c = _cite(ev_co)
        en.append(f"{co['name']} (CIN {co['cin']}) is registered in {co.get('state')} and was incorporated on "
                  f"{co.get('date_of_incorporation')}, with MCA status {co.get('status')} {c}.")
        ja.append(f"{co['name']}（CIN {co['cin']}）は{co.get('state')}州で{co.get('date_of_incorporation')}に設立され、"
                  f"MCA上のステータスは「{co.get('status')}」です{c}。")
    else:
        c = _cite(facts_json["evidence"].get("resolve", []))
        en.append(f"No registry record matched the input {c}.")
        ja.append(f"入力内容に該当する登記記録は見つかりませんでした{c}。")
    for f in sorted(flags, key=lambda x: SEV_ORDER[x["severity"]])[:4]:
        if f["rule_id"] == "CLM_CONTRADICTED":
            continue
        en.append(f"{f['text_en'].rstrip('.')} {_cite(f['evidence_ids'])}.")
        ja.append(f"{f['text_ja'].rstrip('。')}{_cite(f['evidence_ids'])}。")
    contradicted = [c for c in claims if c["verdict"] == "contradicted"]
    if claims:
        ids = [e for c in contradicted or claims for e in c["evidence_ids"]] or facts_json["evidence"].get("doc", [])
        en.append(f"Of {len(claims)} claims in the partner's document, {len(contradicted)} are contradicted by official "
                  f"records {_cite(ids)}.")
        ja.append(f"相手方資料に記載された{len(claims)}件の主張のうち、{len(contradicted)}件が公的記録と矛盾しています{_cite(ids)}。")
    driver_ids = [e for f in flags for e in f["evidence_ids"]] or ev_co
    if driver_ids:
        en.append(f"The rulebook scores the company {score['overall']}/100 ({score['band_en']}) {_cite(driver_ids[:4])}.")
        ja.append(f"ルールに基づく信頼スコアは{score['overall']}点（{score['band_ja']}）です{_cite(driver_ids[:4])}。")
    return " ".join(en), "".join(ja)


def suggestions(flags: list[dict], claims: list[dict], band: str) -> tuple[list[dict], list[dict]]:
    sugg, seen = [], set()
    for f in sorted(flags, key=lambda x: SEV_ORDER[x["severity"]]):
        for en, ja in PLAYBOOK.get(f["rule_id"], []):
            if en not in seen:
                seen.add(en)
                sugg.append({"en": en, "ja": ja, "rule_id": f["rule_id"]})
    en, ja = CONTRACT.get(band, CONTRACT["standard"])
    sugg.append({"en": en, "ja": ja, "rule_id": "CONTRACT"})
    questions, qseen = [], set()
    for c in claims:
        if c["verdict"] != "verified" and c["field"] in QUESTIONS and c["field"] not in qseen:
            qseen.add(c["field"])
            q_en, q_ja = QUESTIONS[c["field"]]
            questions.append({"en": q_en, "ja": q_ja, "field": c["field"]})
    if any(f["rule_id"] == "NET_STRUCKOFF_LINKS" for f in flags):
        questions.append({"en": "Why were the companies linked to your director struck off, and were any debts left unpaid?",
                          "ja": "取締役が関与していた会社が登記抹消された理由と、未払い債務の有無を教えてください。"})
    if any(f["rule_id"] == "CMP_GST_CANCELLED" for f in flags):
        questions.append({"en": "Under which active GSTIN will you invoice us?",
                          "ja": "どの有効なGSTINで請求書を発行されますか。"})
    return sugg, questions


async def narrative(facts_json: dict) -> dict:
    valid = set(facts_json["all_evidence_ids"])
    base_sugg, base_q = suggestions(facts_json["flags"], facts_json["claims"], facts_json["score"]["band"])
    out = await llm.structured("report.narrative", NARRATIVE_SYSTEM,
                               json.dumps({k: v for k, v in facts_json.items() if k != "all_evidence_ids"},
                                          ensure_ascii=False, default=str),
                               NARRATIVE_SCHEMA, effort="medium")
    method = "llm"
    if out:
        summary_en, drop_en = postcheck(out["summary_en"], valid, "en")
        summary_ja, drop_ja = postcheck(out["summary_ja"], valid, "ja")
        if not summary_en or not summary_ja:
            out = None
    if not out:
        method = "template"
        summary_en, summary_ja = template_summary(facts_json)
        summary_en, drop_en = postcheck(summary_en, valid, "en")
        summary_ja, drop_ja = postcheck(summary_ja, valid, "ja")
        extra_s, extra_q = [], []
    else:
        extra_s, extra_q = out["suggestions"], out["meeting_questions"]
    known = {s["en"] for s in base_sugg}
    return {
        "summary_en": summary_en, "summary_ja": summary_ja, "method": method,
        "dropped_sentences": drop_en + drop_ja,
        "suggestions": base_sugg + [s for s in extra_s if s["en"] not in known][:3],
        "meeting_questions": base_q + extra_q[:3],
    }
