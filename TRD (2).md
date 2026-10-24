# Shinrai 信頼: Technical Requirements Document (TRD)

Read PRD.md first. This document says how to build it, fast, with a demo that cannot fail.

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | **Python 3.11 + FastAPI**, async | Scrapers and court SDKs are Python; SSE streaming is simple |
| DB | **SQLite + SQLModel** (single file `shinrai.db`) | Zero setup for a 2-day build |
| Streaming | **Server-Sent Events (SSE)** `GET /api/investigations/{id}/stream` | One-way live events; simpler than WebSockets |
| LLM | **Anthropic API** (Claude), via the `anthropic` SDK using tool use / JSON schema output | Claim extraction and Japanese report writing |
| Graph analytics | **networkx** (Louvain communities via `networkx.community.louvain_communities`, degree, shared-address detection) | |
| Frontend | **React 18 + Vite + TypeScript + Tailwind + shadcn/ui** | |
| Graph UI | **react-force-graph-2d** (default) and **react-force-graph-3d** (toggle) | Smooth incremental node insertion |
| Animation | **framer-motion** | Log entries, finding cards, score dial |
| Charts | **recharts** (sub-score radar, bars) | |
| PDF export | **Playwright** printing `/report/{id}?print=1` | Same visuals as the screen |
| Fonts | Inter, Noto Sans JP, JetBrains Mono, Bebas Neue (via @fontsource) | |

## 2. Repository layout

```
shinrai/
  backend/
    app/main.py                 # FastAPI app, routes, SSE
    app/models.py               # SQLModel tables
    app/schemas.py              # Pydantic event + API schemas
    app/engine/orchestrator.py  # runs an investigation, emits events
    app/engine/graph.py         # entity graph build + analytics
    app/engine/rules.py         # loads rulebook.yaml, evaluates
    app/engine/scoring.py       # sub-scores, overall, fit
    app/engine/claims.py        # LLM claim extraction + verification
    app/engine/report.py        # LLM JA/EN narrative (cited), suggestions, outlook
    app/adapters/base.py        # SourceAdapter interface, modes LIVE/CACHED/SEED
    app/adapters/mca_ogd.py     # data.gov.in company master (LIVE)
    app/adapters/mca_directors.py
    app/adapters/gst.py
    app/adapters/courts.py      # eCourts via bharat-courts (LIVE, with timeout)
    app/adapters/ibbi.py        # IBBI public announcements (LIVE scrape)
    app/adapters/strikeoff.py   # MCA struck-off / disqualified lists (SEED file)
    app/adapters/news.py        # GDELT DOC API (LIVE, free)
    app/rulebook.yaml
    data/seed/*.json            # curated demo companies (full records)
    data/cache/*.json           # recorded real responses keyed by (adapter, query hash)
  frontend/
    src/pages/Onboarding.tsx
    src/pages/Partners.tsx
    src/pages/Investigation.tsx # the Theater
    src/pages/Report.tsx
    src/pages/Compare.tsx
    src/components/GraphCanvas.tsx
    src/components/ResearchLog.tsx
    src/components/FindingsStream.tsx
    src/components/ScoreDial.tsx
    src/components/TraceTimeline.tsx
    src/i18n/{ja,en}.json
```

## 3. Data model (SQLModel)

- **Sme**: id, name, name_ja, industry, seeking (distributor | jv | supplier | contract_mfg), target_states[], deal_band, risk_appetite, language
- **Partner**: id, sme_id, input_name, cin?, gstin?, doc_path?, status
- **Investigation**: id, partner_id, mode (live | cached | seed), started_at, finished_at, overall_score, band, subscores JSON, fit_score
- **Entity**: id, inv_id, type (company | person | address | gstin | case | news | doc_claim), key (CIN/DIN/GSTIN/hash), label, attrs JSON, risk (none | low | med | high | critical)
- **Edge**: id, inv_id, src, dst, type (director_of | registered_at | has_gstin | party_in | mentioned_in | claims), attrs JSON
- **Evidence**: id, inv_id, adapter, query, url, retrieved_at, mode, payload JSON (raw), summary, sha256
- **Flag**: id, inv_id, rule_id, severity, deduction, family, entity_ids[], evidence_ids[], text_en, text_ja
- **Claim**: id, inv_id, text, field (founded_year | turnover | employees | location | certification | clients | capacity | other), value, verdict (verified | contradicted | unverifiable), evidence_ids[], explanation_en, explanation_ja
- **TraceEvent**: id, inv_id, seq, ts, type, payload JSON. The full ordered event log, so a replay is just re-streaming these.

## 4. Source adapters

```python
class SourceAdapter(Protocol):
    name: str
    async def fetch(self, query: dict, mode: Mode) -> AdapterResult  # records + evidence + latency + mode_used
```

Rules:
- **Mode resolution:** try LIVE, falling back to CACHED and then SEED (configurable per adapter via env). Never raise into the orchestrator: return `status="failed"` and let the log show it.
- Every LIVE response is written to `data/cache/` so tonight's live runs become tomorrow's guaranteed demo.
- Hard timeout per adapter call (default 8 s; courts 20 s).
- Every result produces an `Evidence` row (raw payload + sha256 + url + time).

| Adapter | LIVE source | Notes |
|---|---|---|
| `mca_ogd` | data.gov.in OGD "Company Master Data" API (free API key) | CIN, name, status, registration date, ROC/state, class, authorised/paid-up capital. No directors. |
| `mca_directors` | No free official API. SEED for demo companies; optional paid adapter (env `PROBE42_KEY` / `SUREPASS_KEY`) for live director lookups | Director list (DIN), and each DIN's other companies |
| `gst` | Paid verification API with free/trial credits (e.g. Cashfree Secure ID, Surepass, KnowYourGST) via env key; else SEED | Status, registration date, legal name, state, filing frequency. Always also run **local GSTIN checks**: state code (chars 1–2), embedded PAN (chars 3–12), checksum |
| `courts` | `bharat-courts` (MIT) party-name search on District/High Courts, OCR captcha solver, 20 s timeout | Return case list; treat 0 as "none found", not "clean" |
| `ibbi` | Scrape IBBI public announcements (CIRP / liquidation) by company name | |
| `strikeoff` | SEED file built from MCA struck-off (Sec 248) and disqualified-director (Sec 164(2)) lists | |
| `news` | GDELT DOC 2.0 API (free, no key), query = company + director names | LLM classifies each headline: adverse / neutral; low weight |

## 5. Orchestrator (event-emitting pipeline)

`run_investigation(inv_id)` is an async generator. Each step emits events that are both stored as `TraceEvent` and pushed to SSE.

```
1. resolve       → mca_ogd by CIN, or by name (fuzzy, rapidfuzz ≥ 90), or derive PAN/state from GSTIN
2. company       → node: company; evidence
3. gst           → node: gstin, edge has_gstin; local GSTIN checks
4. directors     → nodes: person × N, edges director_of
5. expand        → for each DIN: other companies → nodes + edges (depth 1, cap 25 per director)
6. enrich        → for each expanded company: status via mca_ogd/strikeoff (batch)
7. courts + ibbi → nodes: case, edges party_in   (target company + directors)
8. news          → nodes: news, edges mentioned_in
9. claims        → if doc: LLM extract claims → nodes doc_claim → verify each against graph facts
10. analytics    → networkx: Louvain communities, shared registered addresses, director degree
11. rules        → evaluate rulebook → flags (risk colors pushed to nodes)
12. scoring      → sub-scores, overall, band, fit
13. narrative    → LLM writes JA + EN summary, suggestions, outlook, using ONLY flags/claims/evidence JSON
14. done
```

**Pacing for the Theater:** in SEED/CACHED mode, insert a small delay per event (`THEATER_DELAY_MS`, default 120 ms; node events 60 ms) so the graph visibly forms over about 30–45 s. LIVE mode streams at real speed.

### SSE event schema

```json
{"seq":12,"ts":"…","type":"query.started","step":"directors","adapter":"mca_directors","query":{"cin":"U29…"},"mode":"seed"}
{"seq":13,"type":"query.finished","adapter":"mca_directors","status":"ok","records":3,"latency_ms":412,"evidence_id":"ev_7"}
{"seq":14,"type":"node.added","node":{"id":"p_01234567","type":"person","label":"Director B","risk":"none"}}
{"seq":15,"type":"edge.added","edge":{"src":"p_01234567","dst":"c_U29…","type":"director_of"}}
{"seq":31,"type":"node.updated","node":{"id":"c_U74…","risk":"high","community":3}}
{"seq":40,"type":"flag.raised","flag":{"rule_id":"NET_STRUCKOFF_LINKS","severity":"high","deduction":20,"text_en":"…","text_ja":"…","evidence_ids":["ev_9","ev_10"]}}
{"seq":44,"type":"claim.checked","claim":{"text":"20 years of experience","verdict":"contradicted","explanation_en":"Incorporated 2023-04-11 (MCA)","evidence_ids":["ev_2"]}}
{"seq":50,"type":"score.updated","overall":50,"band":"caution","subscores":{"identity":80,"compliance":40,"legal":100,"network":30,"claims":45,"reputation":100}}
{"seq":60,"type":"done","report_url":"/report/inv_1"}
```

## 6. Rulebook (`rulebook.yaml`)

Rules are data, not code. Each rule has: `id, family, severity, deduction, condition` (a named Python predicate over the graph and records), `evidence` (which evidence types to attach), `text_en`, `text_ja`.

Starter set (implement all):

| id | family | severity | deduction | condition |
|---|---|---|---|---|
| ID_NOT_FOUND | identity | critical | 40 | no registry match for the input |
| ID_STATUS_NOT_ACTIVE | identity | critical | 40 | status ∈ {Strike Off, Under Liquidation, Dormant, Amalgamated} |
| ID_GSTIN_PAN_MISMATCH | identity | high | 20 | PAN inside the GSTIN ≠ company PAN, or legal name mismatch |
| ID_STATE_MISMATCH | identity | medium | 8 | GSTIN state code ≠ registered state, and claimed location ≠ either |
| CMP_GST_CANCELLED | compliance | high | 20 | GST status cancelled or suspended |
| CMP_FILING_OVERDUE | compliance | medium | 10 | last balance sheet or AGM > 18 months ago |
| CMP_YOUNG_LOW_CAPITAL | compliance | low | 5 | incorporated < 12 months ago and paid-up capital ≤ ₹1 lakh |
| LEG_INSOLVENCY | legal | critical | 25 | IBBI/NCLT CIRP or liquidation involving the company |
| LEG_CASES_AS_RESPONDENT | legal | medium | 10 | ≥ 2 pending cases with the company as respondent / accused |
| NET_DIRECTOR_DISQUALIFIED | network | critical | 20 | any director on the Sec 164(2) disqualified list |
| NET_STRUCKOFF_LINKS | network | high | 20 | directors linked to ≥ 2 struck-off companies |
| NET_HIGH_DEGREE_DIRECTOR | network | medium | 8 | a director with ≥ 10 directorships |
| NET_SHARED_ADDRESS_CLUSTER | network | medium | 8 | registered address shared with ≥ 5 other companies |
| CLM_CONTRADICTED | claims | high | 10 per claim (cap 30) | a claim verdict = contradicted |
| REP_ADVERSE_NEWS | reputation | medium | 10 | ≥ 1 adverse news item matched to the company or a director |

### Scoring
- Each family has a max deduction: identity 25, compliance 20, legal 25, network 20, reputation 10. Claims is computed as a separate sub-score, and its deduction is capped inside the overall score at 30. Clamp each family at its cap.
- `overall = clamp(100 − Σ family deductions, 0, 100)`. Any **critical** flag caps overall at 39.
- Sub-score per family = `100 × (1 − deduction / cap)`.
- Bands: 80–100 低リスク low · 60–79 標準 standard · 40–59 要注意 caution · 0–39 高リスク high.
- **Fit score (0–100):** sector match (40), state match (30), scale vs deal band (30), weighted by the SME's risk appetite.
- **Risk outlook (P1):** deterministic signals only. Examples: overdue filings plus a GST cancellation mean "strike-off risk rising"; ≥ 2 director changes in 12 months means "governance instability". Label these "signal", never "prediction of fraud".

## 7. LLM usage (strictly bounded)

1. **Claim extraction:** input is the partner document text (pypdf); output is a JSON list `[{text, field, value, unit}]` via a tool schema. Temperature 0.
2. **News classification:** headline + snippet → `adverse | neutral`, with reason.
3. **Narrative:** input is ONLY the JSON of company facts, flags, claims and evidence IDs. Output is a JSON object `{summary_ja, summary_en, suggestions[{ja,en}], meeting_questions[{ja,en}]}`. The system prompt forbids facts not present in the input, and every sentence that states a fact must reference `[ev_x]`. Post-check: strip any sentence citing a non-existent evidence ID.
- Model: `claude-sonnet-4-5` or the latest available Sonnet; set via `ANTHROPIC_MODEL` env.
- Cache LLM outputs by input hash in SQLite so demo re-runs are instant and identical.

## 8. Frontend: visual spec

**Theme:** dark command-center. Background `#0B0D12`, panels `#12151C`, border `#1F2430`, text `#E6E8EE`, muted `#8A90A0`, accent red `#E3122B` (risk, brand), green `#22C55E` (verified), amber `#F59E0B`, community palette of 12 distinct soft colors. Fonts: Inter (UI), Noto Sans JP (Japanese), JetBrains Mono (log, IDs), Bebas Neue (big numbers and headings).

**Investigation Theater** (full-screen, 3 columns: 26% / 48% / 26%):
- **ResearchLog:** monospace lines with an adapter badge, query, a spinner that becomes ✓ / ✗, latency, record count and a mode chip (LIVE / CACHED / SEED). Auto-scrolls. Groups lines by pipeline step with a step header.
- **GraphCanvas:** react-force-graph-2d with nodes appearing incrementally and a fade/scale-in. Node size by degree; color by community, overridden by red for high/critical risk. Edges get directional particles while the run is active. Glow on new nodes. A "Communities" legend (like the reference screenshot) with counts and checkboxes to filter. Hover tooltip; click a node to open a side drawer with its attributes and evidence links. Buttons: 2D/3D, Fit view, Replay.
- **FindingsStream:** cards sliding in (framer-motion) for flags (severity color bar) and claim checks (✅ / ❌ / ❓). An animated **ScoreDial** pinned on top, tweening the score as `score.updated` events arrive.
- A top progress bar with the 14 pipeline steps.

**Report page:** a hero with score dial, band, company identity, mode badge and a DEMO DATA label when applicable. Then: a sub-score radar plus bars; the Fit score; the claims table; flags (expandable, showing evidence JSON and a link); a JA/EN toggle for the narrative; suggestions and meeting questions; Risk outlook; a static, filterable snapshot of the graph; the trace timeline (every event with a timestamp, filterable by step); an Export PDF button. Print CSS for A4 landscape.

**Onboarding:** a 3-step wizard (Company → What you seek → Risk appetite), with a JA/EN toggle in the header.

## 9. Seed data (required for the demo)

Create `data/seed/` with:
1. **`sunrise_auto.json` (synthetic, labelled DEMO):** a company incorporated 2023 with ₹1 lakh paid-up capital, GST cancelled 2024, filings 2 years overdue, 3 directors. Director B has 7 other companies, 2 of them struck off. About 9 linked companies and about 40 nodes in total, with 1 adverse news item. A brochure `sunrise_brochure.pdf` claims "20 years of experience", "Factory in Pune", "₹50 crore turnover", "ISO 9001 certified" and "Supplier to major OEMs". Expected result: score about 50, 要注意.
2. **`maruti_suzuki.json`:** a real listed company built from public facts (active, GST active, filings current). Expected: about 85+, 低リスク. Mark as CACHED real data with its sources.
3. **`kaveri_precision.json` (synthetic, DEMO):** a mid case scoring about 70.
4. `strikeoff_list.json`, `disqualified_directors.json`: small curated lists containing the synthetic names above.

## 10. API

```
POST /api/sme                         → create SME
POST /api/partners                    → {sme_id, name?, cin?, gstin?} + multipart doc
POST /api/investigations              → {partner_id, mode?} → {id}
GET  /api/investigations/{id}/stream  → SSE (live, or replay if finished)
GET  /api/investigations/{id}/report  → full report JSON
GET  /api/investigations/{id}/graph   → nodes/edges
GET  /api/investigations/{id}/pdf     → PDF (Playwright)
GET  /api/compare?sme_id=             → ranked list
```

## 11. Env

```
ANTHROPIC_API_KEY=   ANTHROPIC_MODEL=
DATA_GOV_IN_KEY=
GST_PROVIDER=cashfree|surepass|none   GST_API_KEY=
DIRECTOR_PROVIDER=none|surepass|probe42   DIRECTOR_API_KEY=
ADAPTER_MODE_DEFAULT=auto   THEATER_DELAY_MS=120
```

## 12. Build order (by risk)

1. **(H0–3)** Adapters for `mca_ogd` LIVE plus SEED loader; cache write-through. Prove a real CIN lookup works.
2. **(H3–7)** Orchestrator plus the SSE event stream plus the TraceEvent store, using SEED data for Sunrise.
3. **(H7–12)** Theater UI: ResearchLog plus GraphCanvas with incremental nodes plus FindingsStream. **This is the wow moment, so get it beautiful early.**
4. **(H12–16)** Rulebook plus scoring plus networkx analytics.
5. **(H16–20)** Claims extraction and verification, and the LLM narrative (JA/EN) with the citation post-check.
6. **(H20–25)** Report page, onboarding, compare.
7. **(H25–28)** PDF export, replay, 3D toggle, the remaining live adapters (courts, IBBI, news, GST).
8. **(H28–30)** Run the validation set, record cache, rehearse the demo twice.

## 13. Acceptance criteria

- Sunrise (SEED) runs end-to-end in 30–45 s with the graph visibly forming, and finishes at a score of 45–55 with ≥ 4 flags and ≥ 3 contradicted claims, each with evidence.
- Maruti Suzuki (CACHED) finishes ≥ 80 with no high/critical flags.
- Any LIVE input never crashes the UI: failed sources show ✗ in the log and the report shows "not checked".
- Every flag and claim in the report opens its evidence.
- The Japanese narrative contains no uncited factual sentence.
- Replay reproduces the identical animation from the stored trace.
