# Shinrai 信頼: Upgrade Plan, from Partner Trust to Trust-Backed Procurement

Audited against commit `ad8ddb3` (main, clean working tree) on 2026-10-25. No application code was changed.
Companion documents: [ARCHITECTURE_PROPOSAL.md](ARCHITECTURE_PROPOSAL.md) · [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) · [RESEARCH_AND_COMPLIANCE.md](RESEARCH_AND_COMPLIANCE.md)

---

## 1. Executive recommendation

**Verdict: extend Shinrai into procurement, narrowly and in sequence. Verification remains the product's core.**

1. **The trust layer works and is the asset.** I ran the existing validation: 21/21 rule fixtures pass, and the three seeded pipelines land at Sunrise 22 (high), Kaveri 72 (standard) and Maruti 100 (low), with 100% evidence coverage. The frontend typechecks and builds. Nothing in the procurement vision should weaken the rules "no source, no finding" and "rules decide".
2. **None of the commercial layer exists yet.** There is no RFQ, supplier catalogue, pool, purchase order, payment, FX, shipment or trade-document code anywhere in the repository (§2). There are also **no accounts and no tenancy**. That is acceptable for a single-user trust demo, and it blocks any feature where one SME's quantities, prices or invoices must be hidden from another.
3. **Order pooling is plausible but unvalidated.** Its value depends on standardised specifications, real supplier price tiers, and buyers whose timing and ports line up. No official dataset shows Japanese SME demand for Indian-sourced goods (RESEARCH §2.2). Pooling is a hypothesis to test with 8–12 interviews (RESEARCH §6), not a premise.
4. **Pool demand, not legal liability.** Use **Model A**: pooled negotiation, with a separate PO, invoice, payment and import for each buyer. It is the only model compatible with "Shinrai holds no funds", "each buyer is its own importer of record", and "a CEPA certificate of origin covers one importation". Model B (shared logistics) is a pilot add-on. Model C (central importer) is deferred.
5. **Pooling does not cut tax.** Japan's MFN duty on machinery and transport parts is already about 0% (WTO). Import consumption tax is levied per declaration on CIF + duty and is normally creditable. Savings come from price tiers, MOQ access and freight, and must be shown per cost category against an explicit independent-purchase baseline.
6. **Don't touch money.** UPI is not a Japan→India B2B rail. Japan's amended Payment Services Act (in force 1 Jun 2026) now covers cross-border collection agency, and India's PA rules bar PAs from running marketplaces. The MVP uses a clearly labelled **SIMULATED** provider. The pilot uses direct bank transfer with Shinrai doing quotes, documents and reconciliation. A regulated partner comes only after legal opinions.

**Positioning:** *"Shinrai: verified Indian suppliers, pooled RFQs and a clear landed cost, in Japanese, so a Japanese SME can make its first Indian purchase safely."*
Not "a global B2B marketplace", and not "cheaper imports via tax-efficient pooling".

---

## 2. Current-state audit

### 2.1 Method
- Read every backend module (`backend/app/**`), the scripts, seed data, rulebook and knowledge base, the frontend routes, API client, i18n and visual tokens, and README, PRD, TRD, DECISIONS, the development prompt and the pitch PDF.
- Ran `python -m scripts.validate` in an isolated venv with the DB redirected to a scratch path: **ALL PASS**.
- Ran `tsc -b --noEmit`: **exit 0**.
- Ran `vite build` (output to a scratch directory): **success**, with a 1.7 MB main chunk warning.
- Not run: the full app in a browser, LIVE adapters against government portals, Playwright PDF export, and the Vizro analytics mount. Analytics failed to import in the minimal venv because plotly was not installed; it is optional by design.

### 2.2 Audit matrix

Status key: **Impl** = implemented and exercised by validation; **Impl (unrun)** = code present, not exercised this pass; **Partial**; **Sim** = simulated; **Missing**.

| Feature | Current implementation | Relevant files | Verified status | Gap | Recommended treatment | Priority |
|---|---|---|---|---|---|---|
| SME onboarding and profile | `Sme` table with extended fields; create, update, list | `backend/app/models.py:24-46`, `main.py:57-96`, `pages/Onboarding.tsx` | Impl (unrun via UI) | `GET /api/sme` returns **all** SMEs, with no owner | Add `workspace_id` and scope (P0-03/04) | P0 |
| Company identification | Name, CIN or GSTIN. Forgiving parser. data.gov.in OGD LIVE with sample key → CACHED → SEED | `main.py:108-134`, `adapters/mca_ogd.py`, `adapters/gstin.py` | Impl (SEED/CACHED validated; LIVE not run) | The shared sample key is rate-limited (DECISIONS) | Keep. Require an own key for the pilot | — |
| Entity resolution | Exact CIN; fuzzy name with rapidfuzz ≥ 90; GSTIN embedded-PAN and state checks | `orchestrator.py:203-249`, `adapters/gstin.py` | Impl | Pitch claims Fellegi–Sunter probabilistic linkage; code is a threshold match | Correct the pitch wording, or implement it later | P1 |
| Director / company graph | Per-investigation `GraphState`, NetworkX Louvain. Deterministic node IDs `c_{CIN}`, `p_{DIN}` | `engine/graph.py`, `orchestrator.py:311-390` | Impl for SEED. **LIVE directors need Probe42, and DIN expansion is not supported** (`mca_directors.py:27`) | For real companies the network graph is usually empty, shown as "not checked" | Badge rules must treat the network as "not checked", not clean (P0-06) | P0 |
| Evidence and citations | `Evidence` rows with sha256, mode and payload. Every flag carries evidence IDs. Citation post-check on the narrative | `orchestrator.py:164-176`, `engine/report.py`, `engine/llm.py` | Impl (100% coverage in validate) | `ev_id` is unique only within an investigation | Global relationships reference `(inv_id, ev_id)` | — |
| Trace and replay | `TraceEvent` per event. SSE live or replay from trace | `orchestrator.py:116-123`, `main.py:181-214` | Impl (unrun via UI) | In-memory `RUNS` means a single process only | Fine for the pilot. LISTEN/NOTIFY later | P2 |
| Risk rules and score | YAML rulebook (24 rules, 9 families), critical cap 39, "insufficient" band when the registry is unchecked | `rulebook.yaml`, `engine/rules.py`, `engine/scoring.py` | Impl (21/21 fixtures) | Fixtures are synthetic. There is no labelled real-company set, as validate.py itself says | Build the labelled set (pitch promises 30+30) | P1 |
| JA/EN reports | Narrative LLM with deterministic template fallback; JA/EN PDFs via Playwright; ringi-sho; master report | `engine/report.py`, `routes_modules.py:535-640`, `routes_master.py` | Impl (template path in validate); PDF unrun | 134 inline `lang === "ja"` ternaries outside i18n JSON | Move them into i18n (P1-12). No new inline strings | P1 |
| Market-entry advisor | KB YAML with BM25 and citation post-check; deterministic fit; 3D map; entry route; compliance Gantt | `advisor/*`, `routes_advisor.py`, `pages/Advisor.tsx` | Impl (unrun) | About 91 KB entries are `verified_by_team: false` versus 9 true | Keep the "to be verified" chips. Verify the entries used in demos | P1 |
| Partner comparison | Ranked by score, with top flag | `main.py:314-332`, `pages/Compare.tsx` | Impl (unrun) | Unscoped by owner | Scope (P0-04) | P0 |
| Site verification | Geocode, Esri, Sentinel-2, OSM footprint, optional Earth Engine; ground rules | `adapters/geocode.py`, `imagery_*`, `buildings_temporal.py`, `engine/ground.py` | Impl (Sunrise ground rules fired in validate) | Earth Engine is not authenticated, so it falls back as documented | Keep | — |
| Certificates | IAF CertSearch adapter (key) → SEED; verdicts never "contradicted" on absence | `adapters/cert_check.py` | Partial (live needs key) | Endpoint shape is unverified without a key | Reuse for product certifications (P0-05) | P0 |
| Genba audit | Checklist from flags; EXIF GPS and time checks; locked on completion; demo completion seeds labelled photos | `routes_modules.py:142-530` | Impl (unrun) | Trusts EXIF (documented); no auditor auth | Feeds badge L3 | P1 |
| Financial data / consent | **Simulated** Account Aggregator consent; seed GSTR-3B; labelled SIMULATED in API and UI | `routes_modules.py:33-120`, `adapters/aa_gst.py`, `pages/Consent.tsx` | **Sim** | The consent decision is unauthenticated (token only), and the requester sees the link | Keep labelled. Do not reuse for payments | — |
| Auth, tenancy, permissions | **None.** CORS restricted to `FRONTEND_URL` | `main.py:29` | **Missing** | Blocks all private commercial data | P0-03/04 | **P0** |
| Upload handling | Brochure: extension allowlist, random name, **no size cap**. Audit photos: re-encoded, nosniff | `main.py:98-105`, `routes_modules.py:306-370`, `main.py:336-347` | Partial | No size limit or magic-byte check on brochure upload | Fix with the trade-doc upload rules (P0-23) | P0 |
| Migrations | `create_all` plus additive `ALTER TABLE ADD COLUMN` | `models.py:214-233` | Impl | No Alembic; no constraint changes possible | Additive for the hackathon; Alembic at Postgres (P1-03) | P1 |
| Tests and CI | `scripts/validate.py` only; no pytest; no CI workflow | `backend/scripts/validate.py` | Impl (passes) | No unit tests for anything new | P0-01 | **P0** |
| Order / RFQ / pool / PO | none | grep of `backend/app`, `frontend/src`, `scripts` | **Missing** | — | M3–M4 | P0 |
| Supplier catalogue | none (`Sme.seeking='supplier'` is a label only) | `models.py:28` | **Missing** | — | M2 | P0 |
| Payments / FX / reconciliation | none. Contract clauses mention L/C or escrow as text | `advisor/kb/clauses.yaml:18-21, 68-72` | **Missing** | — | M6 (SIMULATED) | P0 |
| Shipment / trade documents | none. IEC appears only as a compliance step | `advisor/kb/compliance_steps.yaml:41` | **Missing** | — | M7 | P0 |
| Cross-company graph | none; graph is investigation-scoped | `models.py:76-95` | **Missing** | — | P1-01 projection | P1 |

### 2.3 Documentation versus source mismatches
| Document says | Source shows |
|---|---|
| Pitch p.4: "STACK FastAPI · **PostgreSQL**" | SQLite (`models.py:211`) |
| Pitch p.4: entity resolution by "Fellegi–Sunter" probabilistic matching | rapidfuzz ratio ≥ 90 threshold (`orchestrator.py:237-240`) |
| Pitch p.4: "Playwright fetchers with a cache layer" for sources | httpx for adapters; Playwright is used only for PDF printing |
| Pitch p.3 sample shows "SOURCES CHECKED MCA21 ✓ GST ✓ eCourts ✓" | GST, director network and courts are live only with optional keys or packages (`gst.py:27`, `mca_directors.py:17`, `courts.py:19`); otherwise "not checked" |
| TRD §1: dark theme, shadcn/ui | White-first by owner decision (DECISIONS). shadcn/ui is not in `package.json` |
| PRD §8: "User accounts, payments, multi-tenant auth: out of scope" | Still true. The new vision makes these in scope |

### 2.4 Technical debt and demo-breaking risks
- **Hard dependency on pandas and numpy at import time.** `routes_master.py:13` → `intel/distress.py:11-12` means the API cannot start without them, even with the distress model off. I verified this in a minimal venv. Fix: P0-02.
- **Single-process state.** `RUNS` (`orchestrator.py:70`). Two uvicorn workers would break live SSE.
- **PDF export depends on the frontend being on :5173.** This is documented in README Troubleshooting.
- **The `bharat-courts` entry point is guessed** (`courts.py:24`). LIVE courts may silently report "not checked".
- **The data.gov.in shared sample key is rate-limited.** Real-company demos can end in "Insufficient data" (README).
- **Frontend bundle is 1.7 MB** in the main chunk (cesium and three). Slow on mobile, which matters for the Indian supplier UI. Code-split the new supplier routes.
- **`frontend/tsconfig.tsbuildinfo` is committed.** Harmless, but it creates noise.
- **No licence file** in the repo. README "Credits and licence" lists third-party licences only. Decide the licence before outside contributors join.

---

## 3. Customer problems, alternatives and gaps (summary)

Full evidence with sources is in RESEARCH §2–3.

| Problem | Evidence strength | What Shinrai already covers | What the upgrade adds |
|---|---|---|---|
| Can I trust this Indian company? | Strong anecdotal and pitch evidence (large-firm disputes); official survey data is thin | Registry, GST, insolvency, network, claims, ground truth | Supplier badge with defined levels and expiry |
| Quality variance and capacity claims | JETRO anecdotes (single firms); Tier-2 QC immaturity [SEC] | Claim check, ground truth, Genba audit | Certifications per product; inspection documents in the order flow |
| MOQs too large for an SME | **Hypothesis**; no data found | — | Pooled RFQ against supplier tiers |
| Fragmented demand gives weak prices | **Hypothesis** | — | Tier ladder visible to pool members |
| Unclear landed cost (freight, duty, tax, fees) | Mechanics verified from Japan Customs; SME pain is a hypothesis | — | Explainable estimator with status per line |
| Japanese-language documents and communication | **Hypothesis** (no survey found) | JA reports, ringi-sho | Bilingual RFQ, PO and status |
| Payment risk, FX and reconciliation | Regulatory facts verified; SME practice unverified | Contract clauses (L/C / escrow text) | Payment quote, status, reconciliation (simulated, then bank transfer) |

**Alternatives** (RESEARCH §3): IndiaMART, Alibaba.com (Trade Assurance for Indian suppliers since Jun 2025), Global Sources, JETRO e-Venue, EEPC buyer-seller meets, trading companies, Japanese digital forwarders (Shippio), and domestic matching platforms (Mitsuri, EMIDAS). In public material, none combines verification of Indian suppliers with Japanese-language document handling and SME demand pooling. That is an absence finding, not proof of an opening.

---

## 4. Order-pooling business model

### 4.1 Three models compared

| Dimension | **A. Pooled demand, separate orders** | **B. Consolidated logistics** | **C. Single importer / central buyer** |
|---|---|---|---|
| Who contracts with the supplier | Each buyer (own PO) | Each buyer (own PO) | Aggregator |
| Importer of record | Each buyer | Each buyer, own house B/L | Aggregator |
| Payment | Each buyer pays the supplier | Each buyer pays the supplier; freight split | Aggregator pays and collects from members |
| Funds held by Shinrai | None | None (forwarder invoices each buyer, or allocated) | Yes (payables and receivables) |
| CEPA CoO | One per importation, per buyer | Per buyer; direct-consignment rule applies | One per aggregator import |
| Regulatory load on Shinrai | Low (facilitator; antitrust hygiene) | Low–medium (forwarder partner contracts) | High: import licence obligations, consumption-tax registration and recovery, product liability, inventory, working capital, possibly funds-transfer rules |
| Value unlocked | Supplier tiers, MOQ access, admin per order | Plus per-unit freight and handling | Plus simplest buyer experience, single shipment |
| Main risk | Pools fail to fill; members back out | Port and timing mismatch; one buyer's delay holds the container | Default and credit risk, unsold inventory, liability |
| **Recommendation** | **MVP** | **Pilot, with a forwarder partner, opt-in per pool** | **Defer.** Revisit only if interviews show buyers want it and a partner IOR (trading company) can carry it |

### 4.2 Where the benefit actually comes from

| Category | Mechanism | How Shinrai measures it | Status |
|---|---|---|---|
| Supplier volume discount | Combined committed quantity reaches a higher tier | Unit price at the pool tier vs the tier the buyer's own quantity reaches | Computable from supplier tiers |
| MOQ access | A buyer below MOQ can buy at all | Baseline is "not purchasable" (shown as such, not as an infinite saving) | Computable |
| Freight consolidation | Shared LCL or FCL lowers cost per CBM | Allocated share vs a standalone LCL quote | Needs forwarder quotes (Model B) |
| Admin per order | Shared RFQ, one supplier negotiation | Not monetised in the MVP; time-to-quote metric instead | Metric only |
| Supplier utilisation | Predictable aggregated demand | Supplier-side metric | Interview-dependent |
| Working capital | Not improved in Model A (each buyer pays its own advance) | — | Not claimed |
| **Customs duty / consumption tax** | **No pooling effect.** Calculated per declaration on CIF + duty; split invoices are aggregated; tax normally creditable | Shown separately, never counted as a saving | Verified rules (RESEARCH §5.1) |

### 4.3 Pooling rules

| # | Rule |
|---|---|
| 1 | **Creating a pooled RFQ.** A verified buyer creates an RFQ against a published product, choosing spec options (grade, size, standard, finish, packaging), quantity, destination port, delivery window, incoterm and a private max unit price. They can submit it privately or "open as pool". Opening freezes `spec_hash`, incoterm, named place, destination port, window and deadline. |
| 2 | **Mandatory fields.** Product or full spec, quantity and unit, certifications required, quality standard reference, destination port (UN/LOCODE), delivery window, Incoterms 2020 term and named place. A max unit price is required to *commit*. MOQ and tiers come from the supplier and are not buyer-editable. |
| 3 | **Compatibility.** Same product and `spec_hash`; same incoterm and named place; same destination port; delivery windows overlapping ≥ 14 days; buyer's required certifications ⊆ product's register-verified certifications. Otherwise the buyer is told which fields mismatch and can open their own pool. |
| 4 | **Discovery and joining.** Open pools are listed to buyer workspaces at verification level ≥ "registered business". A buyer sees the product, supplier badge, tier ladder, aggregate committed and interested quantity, a member-count bucket and the deadline. No member identities. |
| 5 | **Supplier price tiers.** The supplier publishes `min_qty → unit price` tiers per incoterm with a validity date. Tiers seen during the pool are the supplier's list. The binding price is in the versioned quote. |
| 6 | **Interest vs commitment vs binding.** *Interested* is non-binding and counts only as a signal. *Committed* means the buyer will accept if the final unit price ≤ its private ceiling, and counts toward the threshold. *Binding* is created only when the buyer accepts a specific quote version (`terms_hash`) and the PO is issued. |
| 7 | **Timing.** The organiser sets `opens_at`, `closes_at` (7–30 days), `min_total_qty` (≥ supplier MOQ) and `max_total_qty` (supplier capacity). Per-member minimum is 1 unit of sale. A per-member maximum is optional. |
| 8 | **Threshold not met.** At `closes_at` with committed < min, the pool becomes `FAILED_THRESHOLD`. All members lapse with **no obligation and no charge**, and each is offered an "order alone at your tier" option where its quantity ≥ MOQ. |
| 9 | **Final acceptance.** The supplier issues quote vN on the committed total. An acceptance window opens (e.g. 72 h). Each member accepts vN. Members above their ceiling are released automatically. If acceptances drop below the tier, the supplier may requote for the lower tier as vN+1, and everyone re-accepts. |
| 10 | **Cost allocation.** Goods are priced at the identical unit price for all members. In Model A, freight, insurance, duty and fees are each buyer's own. In Model B, shared freight is allocated by chargeable weight using integer largest-remainder allocation. Duty and tax are always per importer and estimated separately. |
| 11 | **Changes, withdrawal, rejection.** Before `closes_at`, members can change or withdraw freely. After close, no withdrawal; commitments lapse only via the state machine. A supplier decline gives `SUPPLIER_DECLINED`, and everyone lapses. After a PO, cancellation follows the PO terms and affects only that PO. |
| 12 | **Deposits, default, refunds, disputes.** There are **no platform deposits** in the MVP. Advances, late payment, refunds and quality disputes are governed by each bilateral PO's payment terms between buyer and supplier. Shinrai records state and documents, and does not adjudicate or hold funds. A defaulting buyer affects only its own PO. The supplier priced the tier on the accepted total, so the PO terms should include a "tier honoured if ≥ X% of accepted volume ships" clause, to be confirmed with suppliers in interviews. |
| 13 | **Organiser role.** **Facilitator only**: not a buyer for others, not an agent, not a legal counterparty. The organiser sees aggregates only and carries no obligations for other members. This is written into the terms of use. |
| 14 | **Privacy.** Members see the aggregate and a member bucket ("3–5"). The supplier sees the aggregate before confirmation and per-buyer POs after. No member sees another's identity, quantity or ceiling. Ceilings are never shown to the supplier. |
| 15 | **No silent changes.** Every issued quote is immutable and hashed. Any change creates vN+1, which resets acceptances. A buyer can only accept a hash it was shown. All transitions are written to the hash-chained `DomainEvent` log. |
| 16 | **Competition hygiene** (from JFTC guidance, RESEARCH §1). Pools never set or share members' resale prices, output or customers. Information exchange is limited to what the pool needs. Counsel review is required before the pilot. |

State machines for the pool, membership, PO and payment are in ARCHITECTURE §5.

### 4.4 How each buyer is shown its benefit
For each member, `/pool/:ref` and `/orders/:ref` show three columns: **Independent** (own quantity at own tier, own freight, or "MOQ not met"), **Pooled (separate logistics)**, and **Pooled + shared freight** (only if enabled). Rows are by category, each with a status. The headline "net saving" appears only if every line is at least ESTIMATE and none is UNKNOWN. Otherwise it reads "Goods saving ¥X; other costs incomplete". Consumption tax is listed but excluded from savings.

---

## 5. Commercial relationship graph

**Principle:** the investigation graph stays as it is. A **separate, persistent, permissioned graph** is projected from it and from platform events. Design and fields are in ARCHITECTURE §4.3.

- **Nodes.** Global `Org` (legal entity) with typed identifiers: CIN, GSTIN, IEC, Japanese corporate number, masked PAN. Persons are keyed by DIN only. Products and categories. Pools and POs stay as domain records, not graph nodes, and are linked via `PLATFORM_OBSERVED` edges.
- **Edges.** `DIRECTOR_OF`, `OWNS`/`SUBSIDIARY_OF`, `REGISTERED_AT`, `VERIFIED_SUPPLIER_FOR`, `SOURCES_FROM`, `POOL_MEMBER_OF`, `ORDERED_FROM`, `SHIPPED_VIA`, `PAID_VIA`. Every edge carries `source_kind` (PUBLIC_RECORD / CONSENTED / PLATFORM_OBSERVED / USER_REPORTED / INFERRED), `evidence_ref`, `observed_at`, `valid_from`/`valid_to`, `validation_status` (verified / reported / inferred / stale / disputed), optional `confidence`, and `visibility`.
- **Rules.**
  - A directorship is never displayed as a trading relationship.
  - "Discovered" does not mean "verified".
  - User-reported edges are labelled "reported by the buyer".
  - Platform transaction edges are visible only to the parties. A public aggregate ("12 completed platform orders, 0 disputes") is shown only with supplier consent.
  - Unknown stays unknown.
  - Edges older than the source's freshness window (e.g. 180 days for registry status) render as **stale**.
- **UI legend.** Verified (solid), Reported (dashed), Inferred (dotted, with reason), Stale (grey), Unavailable (hollow, "not checked"). This reuses the existing white-first graph conventions (DECISIONS: Trellis-like canvas, red reserved for risk).
- **Sufficiency.** SQLite/Postgres tables plus NetworkX on a per-request subgraph are enough. A graph database is not justified at this scale (ARCHITECTURE §12).
- **Migration.** A backfill script projects finished investigations, idempotently. Investigations gain a nullable `org_id`. No existing record changes.

---

## 6. Landed cost and trade compliance

The estimator (ARCHITECTURE §3.1 `procurement/landed_cost.py`, checklist P0-18) follows Japanese import mechanics verified in RESEARCH §5:
- **Inputs**: product description, proposed HS code (status UNVERIFIED by default), quantity, unit price and currency, origin, incoterm and named place, mode, ports, freight quote, insurance, broker fee, domestic delivery, payment fees, platform fee, CoO availability.
- **Computation**:
  - customs value ≈ CIF;
  - duty = rate × CIF, with the rate user-entered. A CEPA preferential rate is used only if CoO = yes, and is still NEEDS_PROFESSIONAL;
  - import consumption tax = 10% × (CIF + duty), or 8% for reduced-rate goods, shown and excluded from savings.
- **Statuses**: every line is CONFIRMED, QUOTED, ESTIMATE, UNKNOWN or NEEDS_PROFESSIONAL, and the total takes the worst status. A missing input makes the total **INCOMPLETE**. No precise-looking figure is fabricated.
- **Never claimed**: an automated binding HS code or tariff; CEPA eligibility without origin evidence; any duty or tax effect from pooling.
- **Links shown in the UI**: the Japan Customs tariff schedule, the advance ruling (事前教示) page, and the CEPA rules of origin.

---

## 7. Journeys and UX

### 7.1 Personas and journeys

**A. Japanese SME buyer.** Onboard (existing wizard plus a "sourcing" goal) → define requirement (category, spec, qty, port, window) → discover suppliers (`/source`, badge-first) → review trust evidence (existing report, deep-linked from the badge) → request a quote, or join or create a pool → compare quotes and landed cost → accept the quote and confirm its own PO → review the JPY payable quote and payment path → track production and shipment → confirm delivery or raise a dispute → reorder (P1).

**B. Indian supplier (mobile-first).** Register the business (CIN/GSTIN) → identity verification (existing Verify pipeline, plus IEC, LUT and AD bank checklist) → create catalogue (spec options, MOQ, tiers per incoterm) → receive pooled RFQ (aggregate demand) → issue quote → accept final demand → confirm POs → post production and shipment updates with documents (commercial invoice, packing list, B/L, CoO) → reconcile payments (simulated, later bank-confirmed) → receive verified-purchase reviews (P1).

**C. Pool organiser and participating buyer.** The same as A, plus the organiser can publish, close early or cancel. The organiser sees aggregates only and has no duties beyond facilitation.

**D. Trade-support advisor / due-diligence reviewer (JETRO, consultant).** Read-only view of supplier badges and investigation reports for consenting workspaces. Can trigger a Verify run or Genba audit. Never sees buyers' quantities or prices.

**E. Operations / admin.** Verification queue (suppliers awaiting L2/L3), payment exceptions (short or unmatched reconciliation, failed webhooks), dispute register, and in demo mode the SIMULATED provider controls.

### 7.2 The seven questions every important screen answers
Implement a shared `StatusHeader` component (extending `components/StepBar.tsx`) with these fixed slots:
1. **What is happening**: the state in plain words, e.g. "Pool open, 42,000 of 50,000 committed".
2. **What you need to do**: one primary action.
3. **What is missing**: missing inputs and documents, listed.
4. **Your financial commitment**: "None yet", "Conditional up to ¥X", or "Binding: PO-2026-0007 ¥X".
5. **What could go wrong**: e.g. "If 50,000 isn't reached by 15 Nov, the pool closes and nobody is charged".
6. **Who acts next**: "Supplier (quote due 18 Nov)".
7. **Evidence**: links to the investigation report, quote version, documents and provider events.

### 7.3 Bilingual and domain behaviour
- All new strings go in `i18n/{en,ja}.json`. Japanese uses business register (です/ます, or 敬語 in PDFs), with a terminology glossary reviewed by a native speaker: 最低発注数量 (MOQ), 見積, 発注書, 輸入者, 原産地証明書, 関税, 輸入消費税, 通関業者.
- Currency through `Intl.NumberFormat`: JPY with no decimals; INR in en-IN grouping in English. FX shown as "1 INR = ¥1.7832 (SIMULATED, 2026-10-25 12:00 JST, valid 15 min)". Dates in `yyyy/MM/dd` for Japanese and `d MMM yyyy` for English, with the time zone always shown on deadlines (JST for buyers, IST for suppliers).
- Inline explainers (popover chips) for MOQ, Incoterms (with a responsibility diagram), HS code ("a proposal until a customs broker confirms it"), FX quote, tariff, CoO and payment status. The user gets value before learning any jargon.
- Errors carry a code plus bilingual messages, e.g. `capacity_exceeded`, "Only 8,000 units remain in this pool / このプールの残り枠は8,000個です".
- **Supplier mobile**: 360 px layouts, ≥ 44 px targets, code-split routes (not loaded with cesium or three), English default, works on slow networks (no heavy charts).
- **Visual continuity**: white-first tokens from `tailwind.config.js` (paper, stage, ink, line). Hinomaru red **only for risk and the brand seal**. Verified green and amber/caution as in `lib/visual.ts`. Provenance chips reuse `MODE` styles, adding SIMULATED (amber) and ESTIMATE (outline). The look is an operational B2B tool: tables, timelines and status headers. No consumer-marketplace styling and no chat wrapper.

### 7.4 Trust rules extended to marketplace claims
- "Verified supplier" always shows its level, date, expiry, mode and a link to the investigation.
- Buyer reviews are labelled "Buyer review (verified purchase)" and never mixed with official evidence.
- No invented orders, payments or relationships. Demo records are ILLUSTRATIVE or SIMULATED on every surface.
- Certifications show `claimed`, `register-verified`, `expired` or `contradicted`.
- A graph connection never implies endorsement.

---

## 8. Payments (summary)

Full research is in RESEARCH §4, and the design in ARCHITECTURE §5.4, §6 and §7.

| Phase | Path | Shinrai's role | Money held by Shinrai |
|---|---|---|---|
| Hackathon | `simulated` provider | Quote, intent, signed webhooks to itself, status, reconciliation, all labelled SIMULATED | No |
| Pilot | Buyer's bank → supplier's AD bank (SWIFT), or the supplier's own PA-CB link for small orders | Payment instruction PDF (supplier invoice reference, purpose-code note for the supplier, bank details entered by the supplier and confirmed by both), proof-of-payment upload, supplier confirms receipt, reconciliation, eBRC reminder | No |
| Later | Regulated partner via the `Provider` protocol | Integration, idempotent initiation, webhooks, reconciliation | Only through the partner's licensed accounts, after legal opinions |

The payment quote shows: supplier invoice amount (INR) and reference; buyer payable (JPY); rate, timestamp and expiry; known fees and unknown fees; and explicit exclusions (freight, insurance, duty, consumption tax, broker). Money is integer minor units (JPY 0, INR 2 per ISO 4217). Payable rounding protects the payee.

**What Shinrai builds**: quotes display, state machine, documents, reconciliation, audit trail.
**What needs a regulated partner**: FX execution, fund movement, refunds and chargebacks, KYC on payers as a regulated entity.

---

## 9. Business model and metrics

### 9.1 Monetisation options
| Option | Pros | Cons / risks | Validate by |
|---|---|---|---|
| Paid verification reports (per report or bundle) | Extends the current product; no regulatory load | Low frequency per SME | Pricing interviews; JETRO pilot |
| Supplier enhanced profile / verification subscription | Supplier pays to be found by qualified Japanese buyers | Pay-to-play perception; must not influence the badge | Supplier interviews (#5, #6) |
| Pooled-RFQ facilitation fee (buyer, per successful PO) | Aligned with value delivered | Must be shown in the landed cost; never deducted from export proceeds without legal review (RESEARCH §8 Q4) | Buyer interviews |
| Supplier success fee on platform POs | Common marketplace model | Possible double-charging; Indian FEMA and GST treatment needs review | Counsel + supplier interviews |
| Logistics referral (forwarder or broker) | Useful for Model B | Must be disclosed; conflict of interest | Partner terms |
| JETRO / trade association partnership | Credibility, distribution | Slow procurement | Pilot proposal (pitch p.6) |

Recommendation: verification remains the paid core. For the pilot, either **no transaction fee** (to measure demand cleanly) or a single disclosed buyer-side facilitation fee. Never charge both sides for the same service without disclosure.

### 9.2 Pilot metrics (each savings metric with its baseline)
| Metric | Definition | Baseline / data needed |
|---|---|---|
| Time to eligible supplier | RFQ created → first supplier with badge ≥ L1 shortlisted | Buyer's stated current time (interview) |
| Time to complete quote | RFQ/pool close → issued quote vN | Same |
| Verification adequacy | % of listed suppliers at L2+ with badge age < 180 days | Badge table |
| RFQ→quote, quote→order | Conversion rates | Platform events |
| Pool formation and threshold attainment | % of opened pools reaching `QUOTE_PENDING`; % reaching `CONFIRMED` | Pool states |
| Pool cancellation and failed commitments | % lapsed or released members; % failed threshold | Membership states |
| **Median net landed-cost saving** | Per buyer: pooled scenario total minus independent scenario total, by category, **only for complete estimates**, later compared with actual invoices | Supplier tier list, forwarder quotes, broker fees. Later, actual invoices and import declarations from the buyer, with consent |
| Supplier MOQ fulfilment | % of POs at or above MOQ that would not have been met individually | Pool data |
| Payment success / reconciliation time | % of intents SETTLED; SETTLED → matched | Provider events (simulated in the demo) |
| On-time delivery, disputes, resolution time | ETA vs delivered; disputes per PO; days to resolution | Shipment events |
| Repeat purchase | Buyers and suppliers with ≥ 2 POs in 6 months | POs |
| Contribution margin per successful order | Revenue − variable costs (verification, audit, support) | Finance |

The number of pools opened, sign-ups or pooled GMV are **activity** metrics. They are not evidence of customer benefit.

---

## 10. Prioritised scope and phased roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Now (no code)** | Run 8–12 interviews (RESEARCH §6). Pick the demo category. Confirm one forwarder and one broker for realistic inputs | ≥ 5 buyers describe the MOQ or price pain unprompted, and ≥ 2 suppliers agree to tiered pooled quotes. If not, **pivot the upgrade to "verified sourcing + landed cost" without pooling** |
| **1. Prototype / hackathon** | IMPLEMENTATION_CHECKLIST §5 H-slice, or full P0 (M0–M8, about 17–23 dev-days) | QG-01…QG-24 green; 4 demo scenarios; every simulated surface labelled |
| **2. Pilot (8–12 weeks)** | Postgres and Alembic, real login, direct bank-transfer path, IEC/GST live checks, broker-confirmed HS, global org graph, metrics dashboard (P1 list) | 3–5 pools attempted with real suppliers; ≥ 1 completed real PO outside the platform's money flow; legal opinions received |
| **3. Scale** | Model B with a forwarder, a regulated payment partner, monitoring, more categories and corridors (P2) | Positive contribution margin per order; repeat purchase |

Not in any MVP: a global marketplace, a live settlement rail, an all-country historical dealer graph, automated tariff determination, or end-to-end logistics integration.

---

## 11. Open assumptions and key decisions

**Decided by this plan**: Model A; no funds held; conditional commitment with a private ceiling; integer minor-unit money; additive schema; SQLite now and Postgres at pilot; HS and tariff are user-entered and unverified (IMPLEMENTATION_CHECKLIST L1–L7).

**Open (owner and deadline needed)**: demo category (B1); port and incoterm (B2); fee model (B3); persona switcher vs login (B4); supplier "tier honoured if ≥ X% ships" clause; legal opinions in Japan and India; data residency.

**Assumptions that could invalidate the case**:
1. SMEs don't want India sourcing at meaningful volume (no official data yet).
2. Specifications don't standardise enough to pool.
3. Suppliers won't honour tiers against split POs.
4. Freight and broker fixed costs per buyer erase tier savings at SME volumes.
5. Regulators treat any Shinrai payment orchestration as funds transfer.
6. Trading companies already serve this need cheaply.

---

## 12. Judges' demo script (about 4 minutes)

| Time | Beat | What is shown | Honesty line said aloud |
|---|---|---|---|
| 0:00 | Problem | Japanese SME wants 12,000 stainless bolts; the Indian supplier's MOQ is 10,000, and its best tier starts at 50,000 | "Illustrative company and prices." |
| 0:30 | Trust layer | Existing Verify run (Sunrise → high risk, then the clean illustrative supplier → L2 badge with date and evidence) | "Registry data is live or cached; this supplier is illustrative." |
| 1:30 | Pool | Buyer A opens a pool; Buyers B and C commit; the progress bar crosses 50,000; tier 2 lights up | "Committing isn't purchasing. Nobody else sees your quantity." |
| 2:10 | Quote and own PO | Supplier issues v1 on mobile; each buyer accepts; three separate POs | "Each company is its own importer. Shinrai isn't a party to the sale." |
| 2:40 | Savings | Three-column landed cost: goods saving shown; freight from an entered quote; duty 0% (WTO MFN for this line, broker to confirm); consumption tax listed and excluded | "Modelled from shown inputs, not money saved." |
| 3:10 | Payment | JPY payable quote with expiry; SIMULATED settle → PO moves to production; Buyer B's payment fails, re-quotes after expiry | "Simulated provider; no money moved." |
| 3:40 | Unhappy paths | Failed pool (31k of 50k): everyone released, no charges. Unverified supplier shows "Not verified". Incomplete landed cost shows no headline saving | — |
| 4:00 | Close | "Trust first, then a purchase an SME can explain to its 稟議." | — |
