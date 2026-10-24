# Shinrai 信頼

**Shinrai is an AI-driven partner-verification platform that maps Indian companies, the people behind them and the
ground they stand on, so Japanese SMEs can trust a partner before they sign.**

Thapar Japan Hackathon 2026 · JETRO problem statement 01JETRO-PS-01.

| Layer | | What it proves |
|---|---|---|
| **書類 Paper** | registry, GST, courts, insolvency, news | The company is real and compliant, and who is behind it |
| **現地 Ground** | satellite imagery, building history, night lights, 3D site view | The claimed factory exists, how big it is, since when |
| **資金 Money** | GST returns shared with consent (Account Aggregator, **simulated**) | Real turnover against claimed turnover |
| **行動 Action** | 稟議書 export, Genba on-site audit | What the SME does next |

## Run it

Requirements: Python 3.11+ and Node 18+. Chromium for PDF export comes from Playwright (`python -m playwright install chromium`).

```bash
pip install -r backend/requirements.txt
cd frontend && npm install && cd ..

# Windows (PowerShell)
./dev.ps1            # backend on :8000, frontend on :5173
# macOS / Linux
make dev
```

Open http://localhost:5173 and click **● デモ / Demo**. The demo tab sets up Tanaka Seiko K.K. with three candidate
partners and walks the 3-minute script step by step, with a button for every step.

Seed data is committed. To rebuild it (this re-downloads the real satellite imagery): `./dev.ps1 seed` or `make seed`.
Validation: `./dev.ps1 validate` or `make validate`.

Everything works with no API keys. Keys switch on more live sources; see `.env.example`.

## What is live, cached, seeded or simulated

Every source shows its mode (LIVE / CACHED / SEED) on every log line and evidence record.

| Source | Without keys | With keys |
|---|---|---|
| MCA company master (data.gov.in) | **LIVE** with the public sample key | your `DATA_GOV_IN_KEY` |
| IBBI insolvency announcements | **LIVE** scrape | — |
| Satellite imagery (Esri), Sentinel-2 yearly frames (Planetary Computer), OSM footprints, geocoding (Nominatim) | **LIVE** | Google geocoding and imagery via `GOOGLE_MAPS_KEY` |
| Open Buildings temporal, VIIRS night lights | not checked (SEED for demo companies) | `EE_PROJECT` (Earth Engine) |
| GST taxpayer status, director DIN network | SEED for demo companies | `GST_PROVIDER` / `DIRECTOR_PROVIDER` keys |
| eCourts | SEED for demo companies | `pip install bharat-courts` |
| News (GDELT) | LIVE; unreachable from some networks, shown as ✗ | — |
| LLM (claims, news tone, JA/EN summary) | deterministic rules and templates, still cited | `ANTHROPIC_API_KEY` |
| Account Aggregator GST returns | **SIMULATED** sandbox data, labelled on every screen | production needs a regulated bank/NBFC partner |

**Demo companies.** Sunrise Auto Components and Kaveri Precision, and every director, linked company and case around
them, are fictional and labelled **DEMO DATA**. Sunrise's satellite imagery is real public data for an unnamed shed in
a Chakan-area plot. Maruti Suzuki India Ltd is a real company recorded from the live MCA API (CACHED).

**A LIVE company with no paid keys** is checked against MCA, IBBI and the ground sources only. The report says
"n/7 sources checked" in the Paper layer, so treat a high score in that case as a partial check, not a clean bill.

## Principles (enforced in code)

1. **No source, no flag.** A rule hit without stored evidence is dropped. Every flag and claim verdict links to an
   Evidence row with its raw payload, retrieval time and SHA-256.
2. **The LLM never decides.** Flags and scores come from `backend/app/rulebook.yaml`. The LLM only extracts claims,
   classifies headlines and writes the cited summary; sentences citing unknown evidence IDs are removed.
3. **The demo cannot fail.** Each adapter falls back LIVE → CACHED → SEED with a hard deadline and never raises into
   the pipeline. Failed sources show ✗ and "not checked".
4. **Honest uncertainty.** Unverifiable claims are ❓. With no registry check the band is 確認不足 and no score is shown.

## Layout

```
backend/app/adapters/   one file per source (+ ground: geocode, imagery, buildings, night lights; aa_gst)
backend/app/engine/     orchestrator (SSE + trace), graph, rules, scoring, claims, ground, report, llm
backend/app/rulebook.yaml
backend/scripts/        make_seed, make_ground_seed, validate, run_one
frontend/src/pages/     Landing, Demo, Onboarding, Partners, Investigation (Theater), Report, Compare,
                        Ringi, Consent, Verified, AuditField
frontend/src/components GraphCanvas, ResearchLog, ScoreDial, HankoSeal, GroundTruthPanel, SiteFlyover, ...
```

Design and scope decisions, including where the addendum modules plug in and the security posture, are in
[DECISIONS.md](DECISIONS.md).

Shinrai is a due-diligence aid, not a legal opinion.
