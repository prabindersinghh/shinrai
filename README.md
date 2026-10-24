<div align="center">

# Shinrai 信頼

**Partner verification and India market-entry advisory for Japanese SMEs.**

Shinrai maps Indian companies, the people behind them and the ground they stand on, so a Japanese SME can choose where to enter India and trust a partner before it signs.

Thapar Japan Hackathon 2026 · JETRO problem statement 01JETRO-PS-01

</div>

---

## Contents

1. [What it does](#what-it-does)
2. [Quick start](#quick-start)
3. [Demo inputs](#demo-inputs)
4. [Four-minute walkthrough](#four-minute-walkthrough)
5. [Configuration](#configuration)
6. [Data sources and provenance](#data-sources-and-provenance)
7. [How decisions are made](#how-decisions-are-made)
8. [Project structure](#project-structure)
9. [Scripts](#scripts)
10. [Troubleshooting](#troubleshooting)
11. [Credits and licence](#credits-and-licence)

---

## What it does

| Module | Question it answers |
|---|---|
| **Advisor** | Which Indian states fit the company, at what scale, through which entry route, with which compliance steps, contacts and growth plan. Shown on an interactive 3D map of India with fit, white-space and support-coverage layers. |
| **Verify** | Is this specific partner real and safe? A live investigation reads registry, GST, court and insolvency records, builds the network of directors and linked companies, checks the partner's brochure claims, and verifies the claimed factory from satellite imagery. |
| **Intelligence** | Shinrai's own models and analytics: a distress model trained on MCA records, a certificate check, and Vizro dashboards. |
| **Action** | A risk-driven contract term sheet, a 稟議書 (internal approval document), an on-site Genba Audit, and a board-ready master report in English and Japanese. |

The modules feed each other: findings from Verify add protective clauses to the term sheet, and verified partners appear in the Advisor's contacts.

---

## Quick start

### Requirements

| Tool | Version |
|---|---|
| Python | 3.11 or newer |
| Node.js | 18 or newer |
| Git | any recent version |

### 1. Clone

```bash
git clone https://github.com/prabindersinghh/shinrai.git
cd shinrai
```

### 2. Install the backend

```bash
cd backend
python -m pip install -r requirements.txt
python -m playwright install chromium
cd ..
```

### 3. Install the frontend

```bash
cd frontend
npm install
cd ..
```

### 4. (Optional) Add keys

```bash
cp .env.example .env
```

Everything runs without keys. A free [data.gov.in API key](https://data.gov.in) is strongly recommended: the shared public key is rate-limited, and the live registry lookups depend on it. See [Configuration](#configuration).

### 5. Run

Open two terminals from the project root.

**Terminal 1: backend (port 8000)**

```bash
cd backend
python -m uvicorn app.main:app --port 8000
```

**Terminal 2: frontend (port 5173)**

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173**.

On Windows you can start both at once with `./dev.ps1`; on macOS or Linux, `make dev`.

### 6. (Recommended before a live presentation) Record the real scenarios

```bash
cd backend
python -m scripts.record_scenarios
```

This runs the real-company scenarios once against the live public sources and stores each response, so the walkthrough also works without internet.

---

## Demo inputs

Open the **Demo** tab. It prepares a workspace for **Tanaka Seiko K.K.** (auto components; manufacture in India; ¥300M–1B; conservative) and lists the five scenarios below. Type an input into the search box, or press **Run** on a scenario card.

| | Scenario | Type exactly | Expected result | Provenance | Runtime |
|---|---|---|---|---|---|
| **A** | Clean, Japan-linked manufacturer | `L34103DL1981PLC011375` | **Low risk.** Maruti Suzuki India Limited, active since 1981, Suzuki Motor Corporation as parent, Manesar plant confirmed on satellite imagery. | Public records (MCA, IBBI, satellite) | ~35 s |
| **B** | Company in insolvency proceedings | `future retail` | **High risk.** IBBI public announcements: CIRP (23-07-2022) and liquidation (02-08-2024), cited and stated factually; litigation and insolvency clauses added. | Public records (MCA, IBBI). Needs a data.gov.in key for the registry record. | ~35 s |
| **C** | Mid-risk supplier | `kaveri precision` | **Standard.** Overdue filings, two pending cases as respondent, a director with 11 directorships. | Illustrative case | ~40 s |
| **D** | Brochure claims against the record | `sunrise auto components`, with **Attach partner brochure** ticked | **High risk.** Brochure claims a 50,000 sq ft factory since 2005; satellite shows a 353 m² shed built in 2022. Seven risk-driven contract clauses, consented GST data, Genba Audit, 稟議書 "見送り / Do not proceed". | Illustrative case; financial data simulated | ~50 s |
| **E** | Market-entry plan for a new company | Press **Open analysis** on card E | **Advisor run** for Hokuriku Foods Co., Ltd. (food processing, export hub, ¥50–300M, aggressive, needs a port): 3D map, white space, entry route, compliance roadmap, growth plan, contacts. | Cited knowledge base | ~22 s |

**Input matching is forgiving.** Names are case-insensitive and fuzzy-matched; a CIN or GSTIN typed into the search box is recognised automatically.

**Any other company.** Type the name or CIN of any Indian company; Shinrai runs it live. Sources that cannot be reached show ✗ and "not checked".

**Labels.** Illustrative cases and simulated data carry a small "Illustrative case" or "Simulated" label wherever they appear. Real companies are shown only with their official public records.

**Reset between sessions.** Press **Ctrl + Shift + R** on the Demo tab to start a clean workspace.

---

## Four-minute walkthrough

The Demo tab's "Run of show" panel links to each step.

| # | Time | Step | Where |
|---|---|---|---|
| 1 | 15 s | Landing page, then onboarding | `/`, Get started |
| 2 | 35 s | Advisor run: the 3D map rises state by state; move a weight slider to re-rank; entry route and compliance roadmap | Advisor |
| 3 | 10 s | Contacts and verified partners | Advisor, Key contacts tab |
| 4 | 60 s | Verify scenario D (Sunrise): research log, network graph, findings, score and seal | Demo tab, card D |
| 5 | 30 s | Ground truth: time-lapse to the high-resolution "Today" frame, then the 3D flyover from Tokyo | Report, Ground Truth |
| 6 | 20 s | Term sheet: risk-driven clauses, each tagged with the finding and evidence behind it | Report, Partner term sheet |
| 7 | 15 s | Financial data (simulated consent), then the 稟議書 | Report, Money; Create Ringi-sho |
| 8 | 15 s | Genba Audit: checklist from findings and the completed audit with GPS-checked photos | Report, Genba Audit |
| 9 | 15 s | Analytics: model card and partner portfolio | Analytics |
| 10 | 15 s | A company the audience names, then scenario A (Maruti Suzuki) | Demo tab |

Close with the **Full report (統合レポート)**: a board-ready PDF in English, Japanese or both.

---

## Sourcing prototype (frontend only)

The **Sourcing** tab (`/trade`) is a browser-only prototype of the procurement upgrade described in [docs/UPGRADE_PLAN.md](docs/UPGRADE_PLAN.md). It needs no backend: start the frontend and open http://localhost:5173/trade.

| Route | What it shows |
|---|---|
| `/trade` | 3D trade-corridor globe, live counts, and one-click scenarios (positive, fast-forward to shipped, unavailable data, failed pool, failed payment, cancelled order) |
| `/source`, `/supplier/:id` | Supplier discovery with deterministic verification levels (L0–L3), export readiness, a 3D tier staircase and a 3D relationship graph with provenance-coloured edges |
| `/pool/:id`, `/rfq/new` | Pooled RFQ: a 3D container filling with commitments, a private maximum price, versioned and hashed quotes, and a three-way landed-cost comparison (consumption tax shown, never counted as a saving) |
| `/orders/:id`, `/pay/:poId` | One purchase order per buyer, a shipment on the globe, hashed documents, a JPY payable quote with expiry, and a SIMULATED provider with signed webhooks |
| `/s` | Mobile-first supplier console (quote against aggregate demand, orders, catalogue) |
| `/ops` | Hash-chained audit log with a tamper demo, payment exceptions, and the demo clock |

Use the persona switcher in the black bar to act as each buyer, the supplier or ops. All companies, prices, orders and payments are fictional and labelled ILLUSTRATIVE or SIMULATED. State lives in `localStorage`, and **Reset workspace** restores the starting point. The domain logic (money in integer minor units, state machines, landed cost, badge rules) is in `frontend/src/trade/`.

## Configuration

Copy `.env.example` to `.env` in the project root. All keys are optional.

| Variable | Purpose | Without it |
|---|---|---|
| `DATA_GOV_IN_KEY` | MCA company master data (live registry) and distress-model training | Uses the shared public key, which is often rate-limited |
| `ANTHROPIC_API_KEY` | Claim extraction and the cited narrative summary | Deterministic, cited templates |
| `ANTHROPIC_MODEL` | Model for the above | `claude-sonnet-5-5` |
| `GOOGLE_MAPS_KEY` | Geocoding, satellite imagery, photorealistic 3D tiles | OpenStreetMap geocoding, Esri imagery, imagery globe |
| `CESIUM_ION_TOKEN` | 3D terrain | Flat globe |
| `EE_PROJECT`, `EE_SERVICE_ACCOUNT_JSON` | Google Earth Engine: building history, night lights | Shown as "not checked" for real companies |
| `GST_PROVIDER`, `GST_API_KEY` | GST taxpayer status (Cashfree or Surepass) | Not checked for real companies |
| `DIRECTOR_PROVIDER`, `DIRECTOR_API_KEY` | Director network (Probe42) | Not checked for real companies |
| `IAF_CERTSEARCH_KEY` | Live certificate register | Recorded data or "not checked" |
| `FEATURE_DISTRESS_MODEL`, `FEATURE_CERT_CHECK` | Turn the models on or off (`1` / `0`) | On |

---

## Data sources and provenance

Every record carries its source, retrieval time, SHA-256 and mode: **LIVE** (queried now), **CACHED** (a recorded real response) or **ILLUSTRATIVE** (curated data for the illustrative cases).

| Source | Used for |
|---|---|
| MCA company master data (data.gov.in) | Identity, status, capital, incorporation |
| IBBI public announcements | Insolvency and liquidation |
| GST portal (via provider) | Tax registration status |
| eCourts (optional `bharat-courts`) | Court cases |
| GDELT | News |
| Esri World Imagery, Sentinel-2 (Microsoft Planetary Computer), OpenStreetMap | Satellite verification of sites |
| MoSPI Annual Survey of Industries 2022-23 | State manufacturing shares |
| JETRO / Embassy of Japan lists | Japanese company presence by state |
| DPIIT FDI data | Investment momentum by state |
| METI / DPIIT | Japan Industrial Townships |

Knowledge-base facts not yet confirmed against a primary document are marked **"to be verified"** in the interface.

---

## How decisions are made

- **No source, no finding.** Every flag and claim verdict links to a stored evidence record.
- **Rules decide; language models do not.** Scores come from `backend/app/rulebook.yaml`. Language models only extract claims and write cited prose; a post-check removes any uncited factual sentence.
- **Advice comes only from the cited knowledge base** in `backend/app/advisor/kb/`, never from model memory.
- **Unknown stays unknown.** Unverifiable claims show ❓; unreachable sources show "not checked"; with no registry check there is no score.
- **Models are signals.** The distress model affects a score only through a named rule, and its model card shows real measured metrics, or "not trained" until it is trained on real records.

Shinrai is a decision-support tool, not legal advice.

---

## Project structure

```
backend/
  app/adapters/        one module per data source (LIVE → CACHED → ILLUSTRATIVE fallback)
  app/engine/          investigation pipeline, graph, rules, scoring, claims, ground truth, reports
  app/advisor/         knowledge base (kb/*.yaml), fit model, entry route, clause pack
  app/intel/           distress model inference
  app/rulebook.yaml    every rule, severity and deduction
  analytics/app.py     Vizro dashboards, served at /analytics
  scripts/             seeding, recording, training and validation
frontend/
  src/pages/           Landing, Demo, Advisor, Partners, Investigation, Report, Compare,
                       Analytics, MasterReport, Ringi, TermSheet, Consent, AuditField
  src/components/      IndiaMap3D, GraphCanvas, GroundTruthPanel, SiteFlyover, ScoreDial, …
```

---

## Scripts

Run from `backend/`.

| Command | What it does |
|---|---|
| `python -m scripts.validate` | Runs labelled rule fixtures and the full pipeline; prints recall, false-flag rate and evidence coverage |
| `python -m scripts.record_scenarios` | Records the real-company scenarios for offline use |
| `python -m scripts.train_distress --fetch 200000` then `--train` | Downloads MCA records (needs `DATA_GOV_IN_KEY`) and trains the distress model |
| `python -m scripts.make_seed` | Rebuilds the illustrative case data and brochure |
| `python -m scripts.make_ground_seed` | Re-downloads satellite imagery for the seeded sites |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| A real company ends with "Insufficient data" | The shared data.gov.in key is rate-limited. Add your own `DATA_GOV_IN_KEY`, restart the backend, and run `python -m scripts.record_scenarios`. |
| PDF export fails | Run `python -m playwright install chromium`, and keep the frontend running on port 5173. |
| `Address already in use` on port 8000 or 5173 | Stop the earlier server, or start the new one on another port. |
| The Analytics tab is blank | Start the backend from the `backend/` folder so it can find `analytics/`. |
| Windows blocks a compiled library ("Application Control policy") | Shinrai already uses SQLAlchemy's pure-Python mode. For `python-box`, run `python -m pip install --force-reinstall --no-binary python-box python-box`. |

---

## Credits and licence

Built with FastAPI, React, three.js, CesiumJS, Leaflet, react-force-graph, Recharts, LightGBM, SHAP and [Vizro](https://github.com/mckinsey/vizro) (Apache-2.0). India state boundaries: [datta07/INDIAN-SHAPEFILES](https://github.com/datta07/INDIAN-SHAPEFILES) (MIT). Satellite imagery: Esri, Maxar, Earthstar Geographics; Copernicus Sentinel-2 via Microsoft Planetary Computer. Building footprints © OpenStreetMap contributors (ODbL).

Design and scope decisions are recorded in [DECISIONS.md](DECISIONS.md).
