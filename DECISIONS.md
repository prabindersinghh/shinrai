# Decisions

Choices made where the PRD, TRD and the addendum were ambiguous or conflicted. Each favours a demo that is
reliable, honest and visually strong.

## Product and design

- **White-first visual system, not dark.** The TRD asks for a dark command centre, and the addendum says "same dark
  visual system", but the product owner asked directly for *white as the main colour, then red, then black*. The
  pitch PDF uses that look too. Tokens: paper `#FFFFFF`, stage `#F6F7F9`, Hinomaru red `#E3122B`, sumi ink `#141414`,
  hairline `#E4E5E9`. Red is reserved for risk and the brand seal.
- **Signature element: the hanko seal.** When an investigation finishes, a red 信頼 seal carrying the band stamps
  onto the score. Everything else stays quiet.
- **Graph look borrowed from Sayari's Trellis** (white canvas, circular entity nodes with type glyphs, labels under
  nodes, thin directed edges), rendered with `react-force-graph-2d`. That library handles smooth incremental node
  insertion, which the Theater depends on; Trellis's lower-level renderer was too risky for a 30-hour build.
- **A Demo tab** runs the scripted pitch in one click: it creates Tanaka Seiko K.K., adds Sunrise (with brochure),
  Kaveri and Maruti, and links to each step of the demo script.

## Scoring

- **Claims count at most 10 points in the overall score** (family cap 30 still applies to the claims sub-score).
  With the TRD's literal cap of 30, Sunrise could not land in its 45–55 target. After the addendum added the
  ground (cap 20), money (cap 15) and audit (cap 15) families, Sunrise lands in the high-risk band, which matches
  the addendum's demo ("見送り / do not proceed").
- **ADDRESS_MISMATCH fires only for a claimed site in a state where the company has neither its registered office
  nor a GST registration.** Large companies legitimately operate in several states (Maruti: Delhi office, Haryana
  plants); firing on any multi-state footprint would be a false flag. When it fires, ID_STATE_MISMATCH is
  suppressed so the same finding is not counted twice.
- **Approximate pins (locality / PIN-code precision) cap ground rules at medium severity**, deduction at most 10.
- **No registry check means band "insufficient", not a score.** If MCA could not be reached, the score is shown
  but the band reads 確認不足 and ID_NOT_FOUND does not fire (only a *checked* empty result fires it).
- **Filing dates.** The data.gov.in dataset has no AGM or balance-sheet dates, so LIVE records omit those keys and
  CMP_FILING_OVERDUE reports "not checked" rather than inferring "never filed".

## Data and adapters

- **data.gov.in sample key by default.** The public sample key works for the company master API (rate-limited);
  set `DATA_GOV_IN_KEY` for production use. The resource has fields `CIN, CompanyName, CompanyStatus, …`.
- **Maruti Suzuki is a CACHED real record**: values from the live data.gov.in response (CIN, capital, address,
  registration date). Directors are listed by name only; DINs were not recorded, so no expansion. Its ground pin is
  the Manesar plant from OpenStreetMap. Nothing synthetic is attached to Maruti; checks that need Earth Engine show
  "not checked".
- **Sunrise, Kaveri and every director, linked company and case around them are fictional DEMO DATA**, labelled in
  the UI. Directors are named "Director A/B/C" to avoid resembling real people.
- **bharat-courts is optional.** Installing it was not possible in the build environment. The courts adapter
  imports it when present (`pip install bharat-courts`) and otherwise reports "not checked" with a seed fallback.
- **GST and director providers** (Cashfree, Surepass, Probe42) are wired by env key and skip cleanly without one.
- **Theater pacing**: `NODE_DELAY_MS=150`, `EDGE_DELAY_MS=70`, `DRAMA_DELAY_MS=650` (flags and claims), plus a
  deterministic 260–1160 ms "query" pause per source in SEED/CACHED mode. The latency shown in the log is the real
  latency; the pause is pacing only. LIVE runs at real speed.
- **Replay** re-streams the stored TraceEvents using their original timestamps (each gap capped at 1.5 s), so it
  reproduces the same animation.

## LLM

- Default model `claude-sonnet-5-5` (the TRD names "the latest Sonnet"); override with `ANTHROPIC_MODEL`.
- The TRD's "forced tool_choice + temperature 0" is rejected (400) by current models, so structured outputs
  (`output_config.format` with a JSON schema) are used instead. Determinism comes from caching every output by
  input hash in SQLite, as the TRD already requires.
- **Without an API key, everything still works**: claims come from transparent pattern rules, news tone from a
  keyword list, and the JA/EN narrative from a deterministic cited template. On a refusal or any API error the same
  fallback is used, which is a stronger "demo cannot fail" guarantee than a model fallback.
- Citation post-check: every sentence must cite only existing evidence IDs; uncited or wrongly cited sentences are
  dropped (count shown in the report).

## Addendum: where each module plugs in

| Module | Backend | Pipeline / events | UI |
|---|---|---|---|
| 1 Ground Truth | `adapters/geocode.py`, `imagery_current.py`, `imagery_timelapse.py`, `buildings_temporal.py` (+ `OsmBuildings`), `nightlights.py`; `engine/ground.py`; rules GROUND_* and ADDRESS_MISMATCH | new step **document** (claim extraction) → **ground** → **claims** (verification), since the claimed site comes from the brochure; `ground.ready` event; 🛰️ log lines | Ground Truth panel (report + Theater tab): pins map, time-lapse, built-area chart, night lights, verdicts; pin adjust → `POST /pin` → reassess |
| 2 3D Flyover | `/api/config/public` hands the browser its tile keys | none | `SiteFlyover.tsx` (CesiumJS): Tokyo → site flight, extruded measured footprint vs ghost claimed box; Esri globe fallback without a Google key |
| 3 Money (SIMULATED) | `adapters/aa_gst.py` (SEED only), consent routes, MONEY_TURNOVER_MISMATCH | consent approval → `reassess()` appends `money.received`, claim update, rules, score to the same trace | consent request, mock partner consent screen, turnover chart, `/verified/{id}` card |
| 4 稟議書 | `GET /ringi` (rule-derived recommendation), `GET /ringi.pdf` (Playwright) | none | `/ringi/{id}` printable page with 担当/課長/部長/社長 stamp grid |
| 5 Genba Audit | audit tables, checklist from flags and claims, EXIF GPS + time checks, sha256 evidence, AUDIT_ITEM_FAILED | audit completion → `reassess()` updates claims and score | wizard (type, checklist, schedule, auditor), field view `/audit/{id}/field`, Field evidence in report |

**Reassessment.** Consent approval, pin confirmation and audit completion all call `orchestrator.reassess()`. It
restores the saved pipeline snapshot, applies the new evidence, re-runs rules, scoring and narrative, and appends
the events to the same TraceEvent log, so replay shows the full history.

**Earth Engine.** It needs the owner's Google Cloud project, which could not be authenticated in the build
environment. The EE path is implemented and is used when `EE_PROJECT` is set. Until then:
- Open Buildings temporal falls back to **real** OpenStreetMap footprints (current area only, no years).
- Sentinel-2 yearly frames come from the Microsoft Planetary Computer render API (real, no key).
- Current imagery comes from Esri World Imagery (real, no key).
- For the fictional Sunrise and Kaveri only, the building-by-year and night-light series are labelled seed data.
  Sunrise's pin is a real small unnamed shed in a Chakan-area plot (OSM way 1474466040, 353 m²); no business name
  or signage is attached to it.

**Sentinel-2 framing.** Frames cover about 1 km around the pin. At 10 m resolution a 150 m buffer is only about
15 pixels, so the buffer circle and footprint are drawn on top of the wider frame.

## Security posture (hackathon scope)

The PRD puts user accounts and multi-tenant auth out of scope, so these are known production gaps, not oversights:
- **No authentication.** Any client that can reach the API can read any investigation. Production needs accounts,
  with every query scoped by the owning SME (investigation → partner → sme_id).
- **Consent is SIMULATED.** The requester's screen shows the partner's consent link, which is what makes the demo
  work. A real Account Aggregator flow delivers the request to the partner through the AA app, with the partner
  authenticating there; Shinrai would only receive the signed consent artefact.
- **Genba Audit evidence trusts EXIF.** GPS and timestamp checks catch honest mistakes, not a determined forger.
  Production needs per-audit auditor tokens and attested capture (a signed device nonce). Completed audits are
  already locked against changes.
- Hardening already in place: CORS limited to `FRONTEND_URL`; uploaded photos are re-encoded with an extension
  taken from the detected format; `/api/data` serves only PNG/JPEG with `nosniff`; the LLM writes only the cited
  summary (partner-document text is marked as quotation, not instruction), and suggestions come from a fixed
  playbook.

## Final addendum: integration plan

Navigation becomes **Onboarding → Advisor → Partners → Verify → Reports → Analytics**. The scripted run sheet moves
from the main nav to a presenter view at `/presenter`, so the product reads as a working product. Fictional companies
and simulated data keep a discreet label (PRD hard rule).

| Part | Plugs in at |
|---|---|
| Extended onboarding (§2) | `Sme` gains goal, products, HS chapter, investment band, headcount, timeline, entry mode, must-haves |
| Knowledge base (§3) | `backend/app/advisor/kb/*.yaml` + `data/*.csv`; `advisor/kb.py` loads and validates (id, source_name, source_url, as_of, verified_by_team); BM25 retrieval; `advisor/cite.py` post-check removes sentences with a number, deadline, fee or legal statement lacking a KB citation |
| Fit model + India map (§4.1, §4.6) | `advisor/fit.py` (deterministic, weights from goal/appetite, returned to the browser so sliders re-rank client-side); Advisor run streams over the same SSE/TraceEvent machinery; **3D extruded India map** in three.js (already a dependency via the 3D graph) |
| Entry route + compliance Gantt (§4.2) | `advisor/routes.py` decision table over `entry_routes.yaml`; Gantt built from `compliance_steps.yaml`; step status stored per SME |
| Clause pack (§4.3) | `advisor/clauses.py` reads the partner's Verify flags; every added clause carries the flag and evidence IDs; DOCX via python-docx, PDF via the existing Playwright printer |
| Contacts (§4.5) | `contacts.yaml` (institutions only) + partners already verified with a good band |
| QBDS (§1) | see below |
| Reports (§6) | Market Entry, Compliance Roadmap, Term Sheet, Growth Plan as React print pages + PDF |
| Distress model (§5.1) | `scripts/train_distress.py` → `models/distress/{model.txt,metrics.json}`; rule NET_DISTRESS_HIGH; FEATURE_DISTRESS_MODEL |
| Vizro (§7) | `backend/analytics/app.py` mounted at `/analytics` (WSGI) and shown in an Analytics tab iframe |
| Growth plan (§4.4) | `growth_playbooks.yaml` + a client-side scenario model with visible assumptions |

**Theme.** The addendum asks for a dark theme again; the product owner asked directly for white-first, so the white
system stays and QBDS tokens are mapped onto it.

**Cut order if time runs short (from the bottom of §9):** regional-language news and FinBERT/IndicTrans2 sentiment
first (they need PyTorch and multi-GB model downloads not available here; the feature flags stay off and the UI says
so), then the certificate check's live path (SEED only), then the Growth Plan scenario charts.

**Data honesty.** No KB number, deadline or fee is typed from memory. Facts come from documents fetched during the
build and carry their URL and `as_of`; anything not confirmed from a fetched source is `verified_by_team: false`
and shows a "to be verified" chip. The distress model trains only on real MCA records; with no data it reports
"not trained" and its rule cannot fire.

## Live cyber posture (`cyber_posture` adapter)

- **Passive only.** DNS TXT for SPF and DMARC, one TLS handshake for the certificate, one more with TLS 1.0/1.1 forced to see
  whether legacy versions are accepted, and one plain `GET /` to read `Server` / `X-Powered-By` banners. No port scan, no
  crawling, no redirects, no credentials. The report says so on its first card.
- **The domain is user input and this server connects to it, so SSRF is the main risk.** The name is validated as a public
  hostname, resolved through DNS-over-HTTPS (the system resolver stalled for 30 s on some names), refused unless every
  address is globally routable, and the connection is pinned to the address that was checked.
- **A check that cannot run is `na`, never `fail`.** A timeout proves nothing, so it is never reported as "refused"; only a
  server alert or reset is. Only `fail` feeds `CYB_WEAK_POSTURE`, so a flaky network cannot cost a partner points.
- **TLS probes use blocking sockets in threads.** asyncio's TLS shutdown took about 8 s to unwind after a failed certificate
  handshake and defeated any timeout. DoH is hedged across two resolvers (the second starts after 1.5 s).
- **Website source order:** the partner card field, then the registry email, then the brochure. A website typed on the card
  forces the live path even for a seed-mode demo company; illustrative cases keep their curated result.
- **End-of-life table is static** (dated 2026-10, `ponytail:` comment in the adapter). Swap for the endoflife.date API if it
  has to stay current.
- **Report UI.** `CyberDissection` pins the stage with GSAP ScrollTrigger and drives a plain `{x, y, scale}` camera object:
  GSAP's `svgOrigin` resolves through the element's screen position and drifts once the stage is pinned. Snap stops are the
  settled frames only, with `inertia: false` so a hard flick cannot skip a floor. Reduced motion and print render the static
  checklist. The rest of the site keeps its current look; the comic treatment is scoped to this section.
