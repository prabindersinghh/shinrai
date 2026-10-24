# Shinrai 信頼: Product Requirements Document (PRD)

**Hackathon:** Thapar Japan Hackathon 2026 · Problem statement 01JETRO-PS-01 ("Accelerating & De-risking Indian Market Entry for Japanese SMEs")
**Build window:** 24–25 Oct 2026 (offline, ~30 hours of build time)
**One line:** A Japanese SME onboards, adds the Indian companies it is considering as partners, and watches Shinrai investigate each one live. Shinrai pulls official Indian records, builds a graph of the company and the people behind it, checks the partner's own claims against those records, and delivers a cited trust report in Japanese and English.

---

## 1. Problem

- 1,434 Japanese companies operate in India (Oct 2024), almost the same as in 2018. Only about 20% are SMEs.
- Japan has a ¥10 trillion private investment goal for India over 10 years, and India's government wants to double the number of Japanese firms this decade.
- The blocker for SMEs is trust. The facts about Indian companies are public, but they are scattered across government portals (MCA, GST, eCourts, IBBI), written in English and Indian legal formats, and slow to check.
- A Japanese firm checks a Teikoku Databank-style 100-point score (評点) before trading at home. No equivalent exists in Japanese for an Indian counterparty.
- Bad partners are costly even for the largest firms: NTT Docomo's dispute with Tata ended in a $1.17B arbitration award, and Daiichi Sankyo won a ₹3,500 crore award against the former Ranbaxy promoters.

## 2. Users

| Persona | Need |
|---|---|
| **Japanese SME manager** (primary). Example: overseas business lead at a 200-person auto-parts maker in Aichi | Screen 5–10 Indian partner candidates fast, in Japanese, with evidence for the internal approval process (稟議) |
| **JETRO business-matching advisor** (secondary) | Pre-verify partners before introducing them to Japanese SMEs |
| **Hackathon judges** (demo audience) | See the system actually *research*: searches happening, a graph forming, evidence-backed conclusions |

## 3. Core user flow

1. **Onboard the SME (Japanese or English).** Company name, industry, what it is looking for (distributor, JV partner, supplier or contract manufacturer), target Indian states, deal size band, and risk appetite (conservative / balanced / aggressive). This sets the weights in the "fit" score and the tone of the recommendations.
2. **Add candidate partners.** For each, enter any of company name, CIN or GSTIN. Optionally upload the partner's company profile (会社概要), brochure, pitch deck or an email (PDF or text). Shinrai extracts the partner's claims from it.
3. **Investigation Theater (the wow moment).** One click on "Investigate" starts a live, animated research run:
   - **Left: Research log.** Every query appears as it happens: "MCA master data → CIN U29… → 1 record", "Director DIN 0123… → 7 companies", "GST search → status Cancelled", "eCourts party search 'Sunrise Auto' → 2 cases", "News: 14 articles scanned, 1 adverse". Each entry shows source, status, latency and record count.
   - **Center: Graph forming live.** Nodes appear as entities are discovered: the company, directors, the directors' other companies, addresses, GSTINs, cases and news items. Edges animate in. Communities are colored (Louvain clustering), as in a dark knowledge-graph view. Red nodes are risk entities; the graph re-layouts smoothly. Toggle between 2D and 3D.
   - **Right: Findings stream.** Flags and claim checks pop in with severity, and the trust score dial animates as evidence arrives.
4. **Report.** A full company report:
   - **Overall 信頼スコア (0–100)** and band: 低リスク / 標準 / 要注意 / 高リスク.
   - **Six sub-scores:** 実在性 Identity · コンプライアンス Compliance (tax and filings) · 法的リスク Legal (courts and insolvency) · ネットワーク Network (director graph) · 主張整合性 Claim consistency · 評判 Reputation (news).
   - **Fit score** against the SME's onboarding profile (sector, state and scale match).
   - **Claim verification table:** each claim from the partner's document marked ✅ verified / ❌ contradicted / ❓ unverifiable, with the record that proves it.
   - **Red flags,** each with severity, the rule that fired, and source evidence (portal, record ID, retrieved time, snapshot).
   - **Risk outlook (predictions):** early-warning signals, labelled as signals rather than certainties. Examples: filing-default trajectory leading toward strike-off, a director with a churn pattern, a recently changed GST status.
   - **Suggestions:** concrete next steps (documents to request, questions for the first meeting, whether a site visit is needed, contract protections such as advance-payment limits or escrow).
   - **Full trace:** every step of the investigation, in order. Query, source, response summary, timestamp and the rule decisions made. Replayable: "Replay investigation" re-runs the animation from the stored trace.
   - **Export:** PDF in Japanese, English or bilingual, for the internal approval process.
5. **Compare candidates.** Ranked table of all investigated partners: score, band, top flag and fit.

## 4. Features and priority

| # | Feature | Priority |
|---|---|---|
| F1 | SME onboarding (JA/EN) | P0 |
| F2 | Add partner by name, CIN or GSTIN, plus optional document upload | P0 |
| F3 | Investigation engine with source adapters and a streamed event log | P0 |
| F4 | Live graph formation (2D force graph, community colors, red risk nodes) | P0 |
| F5 | Rulebook engine and score computation (deterministic) | P0 |
| F6 | Claim extraction (LLM) and claim verification against records | P0 |
| F7 | Report page: scores, flags, claims, suggestions, trace | P0 |
| F8 | Japanese report generation (LLM, cited, business Japanese 敬語) | P0 |
| F9 | Replay investigation from the stored trace | P1 |
| F10 | 3D graph toggle | P1 |
| F11 | PDF export | P1 |
| F12 | Candidate comparison table | P1 |
| F13 | Risk outlook / early-warning signals | P1 |
| F14 | Continuous monitoring (re-check weekly, alert on change) | P2, pitch only |

## 5. Non-negotiable product principles

1. **No source, no flag.** Every flag and every claim verdict links to a stored evidence record.
2. **The LLM never decides.** The LLM extracts structured data from documents and writes prose. Flags and scores come only from deterministic rules.
3. **Honest uncertainty.** Unknown is shown as unknown (❓), never guessed. Data-source failures are shown in the log, never hidden.
4. **The demo cannot fail.** Every adapter has three modes: LIVE, CACHED (recorded real responses) and SEED (curated demo data). The UI shows which mode each record came from.
5. **Demo data is labelled.** Synthetic demo companies carry a visible "DEMO DATA" label. Do not present real companies as risky unless the risk is a public record (for example, official insolvency status), and show that record.

## 6. Demo script (3 minutes)

1. **(20 s)** Onboard "Tanaka Seiko K.K." (auto parts, wants a distributor in Haryana, conservative).
2. **(10 s)** Add the candidate "Sunrise Auto Components Pvt Ltd" (synthetic demo) and upload its brochure.
3. **(60 s) Investigation Theater.** The log scrolls, the graph grows from 1 node to about 40, two struck-off companies turn red, the brochure claim "20 years experience" turns ❌ against an incorporation date of 2023, and the score dial settles at 50 (要注意).
4. **(40 s)** Report: sub-scores, claims table, a flag with its evidence, the Japanese summary, suggestions, and the trace.
5. **(30 s)** Live: a judge names a real Indian company and Shinrai runs it in LIVE mode. Then show a clean real company (e.g. Maruti Suzuki India Ltd) coming back green.
6. **(20 s)** Compare view and close: "Weeks to 60 seconds. Every JETRO introduction arrives pre-verified."

## 7. Success metrics (shown on the pitch)

- Red-flag recall ≥ 90% on a labelled set of companies with known public issues.
- False red flags ≤ 5% on clean listed companies.
- 100% of flags have evidence links.
- Less than 60 s from name to full report (SEED/CACHED); LIVE depends on the source.
- A native Japanese reviewer approves the report language.

## 8. Out of scope

User accounts, payments, multi-tenant auth, mobile app, paid data contracts, and legal advice. Shinrai produces a due-diligence aid, not a legal opinion; the report footer says so.
