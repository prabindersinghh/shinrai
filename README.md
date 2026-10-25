<div align="center">

# Shinrai 信頼

**An AI platform that tells a Japanese SME where to enter India, how to comply, and whether a specific Indian partner can be trusted, with cited evidence, in Japanese, in about 60 seconds.**

Thapar Japan Hackathon 2026 · JETRO problem statement 01JETRO-PS-01

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![three.js](https://img.shields.io/badge/three.js-3D_map-000000?style=for-the-badge&logo=threedotjs&logoColor=white)
![CesiumJS](https://img.shields.io/badge/CesiumJS-flyover-6CADDF?style=for-the-badge&logo=cesium&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-SQLModel-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![LightGBM](https://img.shields.io/badge/LightGBM-distress_model-2E7D32?style=for-the-badge)
![Vizro](https://img.shields.io/badge/Vizro-analytics-E3122B?style=for-the-badge)
![Playwright](https://img.shields.io/badge/Playwright-PDF_export-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-cited_narrative-D97757?style=for-the-badge&logo=anthropic&logoColor=white)

![Data](https://img.shields.io/badge/Data-MCA_·_IBBI_·_GST_·_eCourts-141414?style=for-the-badge)
![Satellite](https://img.shields.io/badge/Satellite-Sentinel--2_·_Esri_·_OSM-141414?style=for-the-badge)
![Languages](https://img.shields.io/badge/Languages-English_·_日本語-E3122B?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-hackathon_build-F59E0B?style=for-the-badge)

</div>

---

## Contents

1. [The problem](#the-problem)
2. [What the platform does](#what-the-platform-does)
3. [Quick start](#quick-start)
4. [Demo inputs](#demo-inputs)
5. [Four-minute walkthrough](#four-minute-walkthrough)
6. [Screens and routes](#screens-and-routes)
7. [How decisions are made](#how-decisions-are-made)
8. [Validation](#validation)
9. [Sourcing prototype](#sourcing-prototype-frontend-only)
10. [Configuration](#configuration)
11. [Data sources](#data-sources)
12. [Architecture](#architecture)
13. [Scripts](#scripts)
14. [Troubleshooting](#troubleshooting)
15. [Roadmap](#roadmap)
16. [Credits and licence](#credits-and-licence)

---

## The problem

India has been ranked the most promising overseas market by Japanese manufacturers for years, yet the number of Japanese companies there has barely moved since 2018 (1,434 in October 2024), and only about one in five is an SME. The blocker is trust. The facts about Indian companies are public, but they are scattered across registries, tax, court and insolvency portals, in English and Indian legal formats, and slow to check. A Japanese firm checks a 100-point credit score before trading at home; no equivalent exists in Japanese for an Indian counterparty.

Shinrai closes that gap: one platform from "where should we go" to "can we sign with this partner", every finding traceable to its source.

---

## What the platform does

Status key: **Live** works end to end · **Simulated** works end to end on sandbox data and is labelled as such in the interface · **Planned** designed, not yet in this build.

### Plan: where and how to enter

| # | Feature | What it does | Status |
|---|---|---|---|
| 1 | **SME onboarding (JA / EN)** | Sector, products, goal, scale, timeline, entry preference, must-haves and risk appetite drive every recommendation. | Live |
| 2 | **Market & location fit** | A **3D map of India** scores every profiled state for the SME's sector and scale. Live weight sliders re-rank instantly; the top three locations come with cited reasons and "what would change this". | Live |
| 3 | **White space** | Highlights high-opportunity states with little Japanese support (JETRO offices, consulates, Japan Industrial Townships), where first movers need verification most. Shinrai complements JETRO's network. | Live |
| 4 | **Entry route** | Recommends a distributor, liaison office, JV, wholly owned subsidiary or contract manufacturing, with an alternative, based on goal, scale, timeline and FDI rules. | Live |
| 5 | **Compliance roadmap** | A 180-day Gantt chart of every registration and filing (authority, form, deadline, owner, plain-language advice), each step cited and trackable. | Live |

### Verify: can this partner be trusted

| # | Feature | What it does | Status |
|---|---|---|---|
| 6 | **Paper check** | Reads registry (MCA), GST, court, insolvency (IBBI) and news records to confirm the partner is real and compliant. | Live (registry, insolvency, news); GST and courts with provider keys. Regional-language press (Hindi, Marathi, translated): shown in the illustrative case; live sources planned |
| 7 | **People graph** | A live-forming graph of the directors and their other companies, exposing struck-off links, shared-address clusters and shell patterns. | Live |
| 8 | **Ground Truth (現地現物 from space)** | Satellite building history, a 2016–2026 Sentinel-2 time-lapse ending on high-resolution imagery, night-light activity, and a **3D flyover from Tokyo** to the site, showing whether the claimed factory exists, how big it is and since when. | Live (imagery and footprints); building history and night lights with Earth Engine |
| 9 | **Claim check** | Every claim in the partner's brochure marked ✅ verified / ❌ contradicted / ❓ unverifiable against registry records, satellite data and certificate registers. | Live |
| 10 | **Money check** | Consent-based GST turnover through India's Account Aggregator framework, comparing declared turnover with claimed turnover. | **Simulated** |
| 11 | **Cyber posture** | Passive checks of the partner's internet-facing systems: TLS, email-spoofing protection (SPF / DMARC), exposed end-of-life software. Failed checks add an information-security clause to the term sheet. | Shown in the illustrative case; live checks planned |
| 12 | **Shinrai Distress Model** | Our own LightGBM model trained on Indian registry data, predicting strike-off risk with SHAP explanations and a model card of real measured metrics. | Distress scores, percentiles and the NET_DISTRESS_HIGH rule shown in the illustrative case. The training pipeline is complete; the model card shows real metrics once trained on MCA data (a data.gov.in key is required) and says "not trained" until then. |
| 13 | **信頼スコア** | A 0–100 trust score with sub-scores, computed by a transparent rulebook. AI never decides a flag; every flag links to its source. | Live |

### Act: decide, protect, follow through

| # | Feature | What it does | Status |
|---|---|---|---|
| 14 | **Risk-driven contract clauses** | Each finding automatically adds a protective clause (audit rights, escrow, a GST condition precedent, director warranties, litigation indemnity), tagged "Added because" with the evidence. Export to Word. | Live |
| 15 | **Growth plan** | Phased growth models, an editable break-even scenario built from your own assumptions, and India-specific growth levers. | Live |
| 16 | **Key contacts** | JETRO, the Embassy and consulates, state Japan desks, chambers and associations (institutions only), plus partners Shinrai has already verified. | Live |
| 17 | **Genba Audit** | Orders an on-site audit with a checklist generated from the findings; GPS- and time-checked photos feed back into the score. | Live (request flow, field view, scoring); the sample completed audit is illustrative |
| 18 | **Reports** | A 稟議書 (internal approval document), a board-ready master report (統合レポート) covering everything, and per-module reports, in Japanese and English with full citations, exported as PDF. | Live |
| 19 | **Analytics** | Market explorer, partner portfolio, model cards and ground overview, built on McKinsey's open-source [Vizro](https://github.com/mckinsey/vizro). | Live |
| 20 | **Investigation Theater** | Watch the research happen live: research log, graph forming, findings streaming in, a score that settles with a 信頼 seal, and a fully replayable trace. | Live |

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

### 4. Add keys (optional, recommended)

```bash
cp .env.example .env
```

Everything runs without keys. A free [data.gov.in API key](https://data.gov.in) is strongly recommended: the shared public key is rate-limited, and the live registry lookup and the distress model depend on it. See [Configuration](#configuration).

### 5. Run

Open two terminals in the project root.

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

On Windows you can start both with `./dev.ps1`; on macOS or Linux, `make dev`.

### 6. Before a live presentation

```bash
cd backend
python -m scripts.record_scenarios
```

This runs the real-company scenarios once against the live public sources and stores every response, so the walkthrough still runs if the internet drops.

---

## Demo inputs

Open the **Demo** tab. It prepares a workspace for **Tanaka Seiko K.K.** (auto components; manufacture in India; ¥300M–1B; conservative) and shows the five scenarios. Type an input into the search box, or press **Run** on a card.

| | Scenario | Type exactly | What you will see | Data | Runtime |
|---|---|---|---|---|---|
| **A** | Clean, Japan-linked manufacturer | `L34103DL1981PLC011375` | **Low risk.** Maruti Suzuki India Limited: active since 1981, Suzuki Motor Corporation as parent, Manesar plant confirmed on satellite imagery and building footprints. | Real public records | ~35 s |
| **B** | Company in insolvency proceedings | `future retail` | **High risk.** IBBI public announcements of CIRP (23-07-2022) and liquidation (02-08-2024), cited and stated factually; litigation and insolvency clauses added to the term sheet. | Real public records; needs a data.gov.in key for the registry record | ~35 s |
| **C** | Mid-risk supplier | `kaveri precision` | **Standard.** Overdue filings, two pending cases as respondent, a director with 11 directorships; conditional approval. | Illustrative case | ~40 s |
| **D** | Brochure claims against the record | `sunrise auto components` with **Attach partner brochure** ticked | **High risk.** The brochure claims a 50,000 sq ft factory since 2005; satellite shows a 353 m² shed built in 2022. Seven risk-driven clauses, consented GST data, Genba Audit, 稟議書 "見送り / Do not proceed". | Illustrative case; financial data simulated | ~50 s |
| **E** | Market-entry plan for a new company | Press **Open analysis** on card E | **Advisor run** for Hokuriku Foods Co., Ltd. (food processing, export hub, ¥50–300M, aggressive, needs a port): 3D map, white space, entry route, compliance roadmap, growth plan, contacts. | Cited knowledge base | ~22 s |

- **Any other company:** type the name or CIN of any Indian company and Shinrai runs it live. Sources that cannot be reached show ✗ and "not checked".
- **Forgiving input:** names are case-insensitive and fuzzy-matched; a CIN or GSTIN typed into the search box is recognised automatically.
- **Labels:** illustrative cases and simulated data carry a small "Illustrative case" or "Simulated" label wherever they appear.
- **Reset:** press **Ctrl + Shift + R** on the Demo tab to start a clean workspace between sessions.

---

## Four-minute walkthrough

The Demo tab's "Run of show" panel links to each step.

| # | Time | Step |
|---|---|---|
| 1 | 15 s | Landing page and onboarding |
| 2 | 35 s | Advisor: the 3D map rises state by state; move a weight slider to re-rank; entry route and compliance roadmap |
| 3 | 10 s | Key contacts and verified partners |
| 4 | 60 s | Verify scenario D (Sunrise) in the Investigation Theater |
| 5 | 30 s | Ground Truth time-lapse, then the 3D flyover from Tokyo |
| 6 | 20 s | Term sheet: each clause tagged with the finding behind it |
| 7 | 15 s | Money check (simulated consent), then the 稟議書 |
| 8 | 15 s | Genba Audit: checklist from the findings and GPS-checked photos |
| 9 | 15 s | Analytics: model card and partner portfolio |
| 10 | 15 s | A company the audience names, then scenario A (Maruti Suzuki) |

Close with the **master report (統合レポート)**: a board-ready PDF in English, Japanese or both.

---

## Screens and routes

| Screen | Route | What it shows |
|---|---|---|
| Landing | `/` | Pitch, live 3D map of India for an example profile, the four evidence layers |
| Onboarding | `/onboarding` | Three-step profile wizard (JA / EN) |
| Advisor | `/advisor/:id` | 3D map with fit, white-space and support-coverage layers; weights; top 3; entry route; compliance Gantt; growth plan; contacts |
| Partners | `/partners/:id` | Add candidates (name, CIN, GSTIN, brochure) and start investigations |
| Investigation Theater | `/investigation/:id` | Live research log, network graph, ground-truth tab, findings and score |
| Partner report | `/report/:id` | Score, sub-scores, findings with evidence, claims, Ground Truth, cyber and model signals, money, term sheet, audit, trace |
| Compare | `/compare/:id` | Candidates ranked on a map and in a table |
| Analytics | `/intelligence/:id` | Vizro: market explorer, partner portfolio, model cards, ground overview |
| Master report | `/master-report/:id` | 統合レポート with contents and page numbers; PDF in EN, JA or both |
| 稟議書 | `/ringi/:id` | Internal approval document with stamp grid; PDF |
| Term sheet | `/termsheet/:id` | Base and risk-driven clauses; Word and PDF |
| Partner consent | `/consent/:token` | Account Aggregator consent screen (simulated) |
| Auditor field view | `/audit/:id/field` | Mobile checklist with photo upload and GPS check |
| Demo | `/demo` | The five scenarios, typed input, run of show |

---

## How decisions are made

- **No source, no finding.** Every flag and claim verdict links to a stored evidence record with its source, retrieval time and SHA-256.
- **Rules decide; AI does not.** Scores come from [`backend/app/rulebook.yaml`](backend/app/rulebook.yaml). Language models only extract claims and write cited prose; a post-check removes any uncited factual sentence.
- **Advice comes only from the cited knowledge base** in [`backend/app/advisor/kb/`](backend/app/advisor/kb/), never from model memory. Facts not yet confirmed against a primary document show "to be verified".
- **Unknown stays unknown.** Unverifiable claims show ❓; unreachable sources show "not checked"; without a registry check there is no score.
- **Models are signals.** A model affects the score only through a named rule, and its model card shows real measured metrics.
- **Every record shows its provenance:** LIVE (queried now), CACHED (a recorded real response) or ILLUSTRATIVE.

Shinrai is a decision-support tool, not legal advice.

---

## Validation

`python -m scripts.validate` (run from `backend/`) produces:

| Check | Result |
|---|---|
| Red-flag recall on labelled rule fixtures (15 cases) | 100% (target ≥ 90%) |
| False red-flag rate on clean fixtures (6 cases) | 0% (target ≤ 5%) |
| Illustrative case D (Sunrise) | 14 / 100, high risk, 17 findings, 6 contradicted claims |
| Illustrative case C (Kaveri) | 72 / 100, standard |
| Maruti Suzuki (recorded real data) | 100 / 100, low risk, no findings |
| Findings and claims linked to stored evidence | 100% |
| Master report export | about 12–14 s per language |

The fixtures are synthetic and test the rulebook, not real-world accuracy. A labelled set of real companies is the next validation step.

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

| Variable | Enables | Without it |
|---|---|---|
| `DATA_GOV_IN_KEY` | Live MCA registry lookups; distress-model training | Shared public key (often rate-limited) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claim extraction and the cited narrative | Deterministic cited templates |
| `GOOGLE_MAPS_KEY` | Google geocoding, imagery, photorealistic 3D tiles | OpenStreetMap, Esri imagery, imagery globe |
| `CESIUM_ION_TOKEN` | 3D terrain | Flat globe |
| `EE_PROJECT`, `EE_SERVICE_ACCOUNT_JSON` | Earth Engine building history and night lights | "Not checked" for real companies |
| `GST_PROVIDER`, `GST_API_KEY` | GST taxpayer status (Cashfree or Surepass) | "Not checked" for real companies |
| `DIRECTOR_PROVIDER`, `DIRECTOR_API_KEY` | Director network (Probe42) | "Not checked" for real companies |
| `IAF_CERTSEARCH_KEY` | Live certificate register | Recorded data or "not checked" |
| `FEATURE_DISTRESS_MODEL`, `FEATURE_CERT_CHECK` | Turn models on (`1`) or off (`0`) | On |

---

## Data sources

| Source | Used for |
|---|---|
| MCA company master data (data.gov.in) | Identity, status, capital, incorporation; distress-model training |
| IBBI public announcements | Insolvency and liquidation |
| GST portal (via provider) | Tax registration status |
| eCourts (optional `bharat-courts`) | Court cases |
| GDELT | News |
| Esri World Imagery, Copernicus Sentinel-2 (Microsoft Planetary Computer), OpenStreetMap | Satellite verification of sites |
| MoSPI Annual Survey of Industries 2022-23 | State manufacturing shares |
| JETRO / Embassy of Japan | Japanese company presence by state |
| DPIIT | FDI inflows by state; FDI policy |
| METI / DPIIT | Japan Industrial Townships |
| RBI, MCA, CBIC, DGFT | Entry routes and compliance steps |

---

## Architecture

```
frontend/  React 18 · Vite · TypeScript · Tailwind · three.js · CesiumJS · react-force-graph · Recharts
  src/pages/        Landing, Demo, Onboarding, Advisor, Partners, Investigation (Theater), Report,
                    Compare, Analytics, MasterReport, Ringi, TermSheet, Consent, AuditField
  src/components/   IndiaMap3D, GraphCanvas, GroundTruthPanel, SiteFlyover, ScoreDial, HankoSeal, …

backend/   Python · FastAPI · SQLite · Server-Sent Events · networkx · LightGBM · Vizro · Playwright
  app/adapters/     one module per source, each with LIVE → CACHED → ILLUSTRATIVE fallback
  app/engine/       investigation pipeline, graph analytics, rules, scoring, claims, ground truth, reports
  app/advisor/      cited knowledge base (kb/*.yaml), fit model, entry route, clause pack
  app/intel/        distress-model inference
  app/rulebook.yaml every rule, severity and deduction
  analytics/app.py  Vizro dashboards, served at /analytics
```

---

## Scripts

Run from `backend/`.

| Command | What it does |
|---|---|
| `python -m scripts.validate` | Labelled rule fixtures plus full pipeline runs: recall, false-flag rate, evidence coverage |
| `python -m scripts.record_scenarios` | Records the real-company scenarios for offline use |
| `python -m scripts.train_distress --fetch 200000` then `--train` | Downloads MCA records (needs `DATA_GOV_IN_KEY`) and trains the distress model |
| `python -m scripts.make_seed` | Rebuilds the illustrative case data and brochure |
| `python -m scripts.make_ground_seed` | Re-downloads satellite imagery for the seeded sites |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| A real company ends with "Insufficient data" | The shared data.gov.in key is rate-limited. Add your own `DATA_GOV_IN_KEY`, restart the backend, then run `python -m scripts.record_scenarios`. |
| PDF export fails | Run `python -m playwright install chromium` and keep the frontend running on port 5173. |
| Port 8000 or 5173 already in use | Stop the earlier server, or start the new one on another port. |
| The Analytics tab is blank | Start the backend from the `backend/` folder. |
| Windows blocks a compiled library ("Application Control policy") | For `python-box`, run `python -m pip install --force-reinstall --no-binary python-box python-box`. |

---

## Roadmap

- Live cyber-posture checks (TLS, SPF / DMARC, exposed software) for any partner domain
- Live regional-language press (Hindi, Marathi, Tamil, Gujarati) with translation
- Train the distress model on full MCA master data and publish its model card
- Earth Engine building history and night lights for every real company
- Continuous monitoring: weekly re-checks with alerts on status, GST or director changes
- Pilot with a JETRO business-matching desk

---

## Credits and licence

Built with FastAPI, React, three.js, CesiumJS, Leaflet, react-force-graph, Recharts, LightGBM, SHAP and [Vizro](https://github.com/mckinsey/vizro) (Apache-2.0). India state boundaries: [datta07/INDIAN-SHAPEFILES](https://github.com/datta07/INDIAN-SHAPEFILES) (MIT). Satellite imagery: Esri, Maxar, Earthstar Geographics; Copernicus Sentinel-2 via Microsoft Planetary Computer. Building footprints © OpenStreetMap contributors (ODbL).

Design and scope decisions: [DECISIONS.md](DECISIONS.md).
