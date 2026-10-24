You are building **Shinrai 信頼**, a hackathon product for the Thapar Japan Hackathon (JETRO problem statement 01JETRO-PS-01). We have about 30 hours. Read `PRD.md` and `TRD.md` in this repo fully before writing any code. They are the source of truth. If something is ambiguous, pick the option that makes the live demo more reliable and more visually impressive, and note it in `DECISIONS.md`.

## What we're building (in one paragraph)
A Japanese SME onboards and adds Indian companies it's considering as partners (name, CIN or GSTIN, plus an optional brochure). Shinrai runs a live, animated investigation. A research log shows every source query, a knowledge graph of the company, its directors, their other companies, cases and news forms on screen in real time (dark theme, community colors, red risk nodes), and findings stream in. A deterministic rulebook then produces flags and a 0–100 信頼スコア with six sub-scores. Claims from the partner's own brochure are verified ✅ / ❌ / ❓ against official records. The output is a cited bilingual (Japanese/English) report with suggestions, risk signals and a full replayable trace.

## Hard rules
1. **No source, no flag.** Every flag and claim verdict must reference stored Evidence rows.
2. **The LLM never decides flags or scores.** It only extracts claims, classifies news, and writes the narrative from the JSON of flags and evidence. Post-check and remove any sentence citing a non-existent evidence ID.
3. **The demo cannot fail.** Every adapter supports LIVE → CACHED → SEED fallback, never throws into the orchestrator, and writes every LIVE response to the cache. Show the mode (LIVE / CACHED / SEED) on every log line and record.
4. **Synthetic demo companies are visibly labelled "DEMO DATA".**
5. **Visual quality is a top priority.** The Investigation Theater is what wins the judges. It must look like a polished dark command center: smooth incremental graph growth, glowing new nodes, edge particles, an animated score dial, and cards that slide in. No default-looking UI.

## Stack (do not change without a reason in DECISIONS.md)
Backend: Python 3.11, FastAPI, SQLModel + SQLite, SSE, networkx, rapidfuzz, pypdf, the anthropic SDK, httpx, bharat-courts (courts adapter), Playwright (PDF export).
Frontend: React 18, Vite, TypeScript, Tailwind, shadcn/ui, react-force-graph-2d/3d, framer-motion, recharts, @fontsource (Inter, Noto Sans JP, JetBrains Mono, Bebas Neue), and a simple i18n setup with ja/en JSON files.

## Work plan: build in this order and commit after each step
1. Scaffold `backend/` and `frontend/`, a `.env.example`, and a `Makefile` with `make dev` (runs both) and `make seed`.
2. Models and schemas (TRD §3, §5 event schema). Write the seed files in TRD §9 first, including a generated `sunrise_brochure.pdf` (use reportlab) with the listed claims.
3. Adapter base plus `mca_ogd` (data.gov.in, LIVE with cache) plus SEED loaders for all other adapters, plus local GSTIN validation (state code, embedded PAN, checksum).
4. The orchestrator pipeline (TRD §5), emitting and storing TraceEvents and streaming over SSE, with theater pacing in SEED/CACHED mode.
5. **Investigation Theater UI** (TRD §8), wired to SSE. Make it beautiful now, not later. Test with Sunrise until the graph grows smoothly to about 40 nodes in 30–45 seconds.
6. `rulebook.yaml` plus the rules engine plus scoring (TRD §6), including the critical cap and the bands. Push the risk colors back to the graph via `node.updated`.
7. Claim extraction and verification, then the LLM narrative (JA + EN, cited), with LLM output cached by input hash.
8. Report page, onboarding wizard, compare page, replay from the trace.
9. PDF export, 3D toggle, then the LIVE adapters for courts (bharat-courts, 20 s timeout), IBBI scrape, GDELT news and GST (provider via env; skip cleanly if no key).
10. A `scripts/validate.py` that runs the labelled set and prints recall, false-flag rate, evidence coverage and latency. Then run the acceptance criteria in TRD §13 and fix failures.

## Working style
- After each step, run the app and check it yourself. For the frontend, take Playwright screenshots of the Theater and the Report and inspect them for visual polish before moving on.
- Keep functions small and typed. No dead code. No TODO stubs in demo paths.
- Never block the UI on a slow source. Show a spinner in the log line and continue with the other steps in parallel where the pipeline allows.
- When a step is done, print a 3-line summary: what works, what's mocked, what's next.

Start now with step 1. Then continue through the plan without waiting for me unless you hit a decision that changes the product.
