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
