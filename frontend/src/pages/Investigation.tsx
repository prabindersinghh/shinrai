import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Network, Satellite } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { EvidenceDrawer, NodeDrawer } from "../components/Drawers";
import { ClaimCard, FlagCard, SignalCard } from "../components/FindingCards";
import GraphCanvas from "../components/GraphCanvas";
import HankoSeal from "../components/HankoSeal";
import ResearchLog from "../components/ResearchLog";
import ScoreDial from "../components/ScoreDial";
import { LangToggle, Wordmark } from "../components/Shell";
import StepBar from "../components/StepBar";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { useInvestigationStream, type VizNode } from "../lib/stream";
import { FAMILY, MODE, RADAR_FAMILIES } from "../lib/visual";

const GroundTruthPanel = lazy(() => import("../components/GroundTruthPanel"));

function useElapsed(running: boolean, startedKey: unknown) {
  const [start, setStart] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => setStart(Date.now()), [startedKey]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);
  return Math.max(0, (now - start) / 1000);
}

export default function Investigation() {
  const { id } = useParams();
  const invId = Number(id);
  const [params] = useSearchParams();
  const { t, lang } = useI18n();
  const { state, graph, replay, replaying } = useInvestigationStream(invId, { replay: params.get("replay") === "1" });
  const [meta, setMeta] = useState<any>(null);
  const [tab, setTab] = useState<"graph" | "ground">("graph");
  const [node, setNode] = useState<VizNode | null>(null);
  const [ev, setEv] = useState<string | null>(null);
  const running = state.started && !state.done;
  const elapsed = useElapsed(running, replaying ? state.started : invId);

  useEffect(() => {
    api.investigation(invId).then(setMeta).catch(() => setMeta(null));
  }, [invId, state.done]);

  const counts = useMemo(() => {
    const q = state.log.filter((l) => l.kind === "query");
    return { total: q.length, ok: q.filter((l) => l.status === "ok").length, failed: q.filter((l) => l.status === "failed").length };
  }, [state.log]);

  const company = meta?.company?.name || meta?.partner?.input_name || "…";
  const modeChip = MODE[meta?.mode_used ?? state.mode] ?? MODE.seed;
  const feed = [...state.flags].reverse();
  const claims = [...state.claims].reverse();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-paper">
      {/* command bar */}
      <header className="no-print shrink-0 bg-ink text-white">
        <div className="flex h-14 items-center gap-5 px-5">
          <Wordmark invert />
          <div className="h-6 w-px bg-white/15" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-semibold">{company}</span>
              {(state.demo || meta?.is_demo) && <span className="chip bg-white/15 text-white/85">{lang === "ja" ? "説明用ケース" : "Illustrative case"}</span>}
              <span className={`chip ${modeChip.cls}`}>{modeChip.label}</span>
              {replaying && <span className="chip bg-white/15 text-white">{lang === "ja" ? "再生中" : "REPLAY"}</span>}
            </div>
            <div className="text-[11px] text-white/55">
              {lang === "ja" ? "調査シアター" : "Investigation Theater"} · #{invId}
              {state.reassess && <span className="ml-2 text-hinomaru">● {state.reassess}</span>}
            </div>
          </div>
          <div className="ml-4 min-w-0 flex-1"><StepBar steps={state.steps} /></div>
          <div className="num w-[64px] text-right text-[22px] leading-none text-white">{elapsed.toFixed(1)}<span className="text-sm text-white/50">s</span></div>
          <LangToggle invert />
          <Link to={`/report/${invId}`} className={`btn ${state.done ? "bg-hinomaru text-white hover:bg-hinomaru-deep" : "pointer-events-none bg-white/10 text-white/40"}`}>
            {t("theater.open_report")} <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[26%_48%_26%]">
        {/* research log */}
        <section className="flex min-h-0 flex-col border-r border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] font-semibold">{t("theater.log")}</h2>
            <div className="flex gap-2 font-mono text-[10.5px] text-muted">
              <span>{counts.total} q</span><span className="text-verified">✓ {counts.ok}</span>
              {counts.failed > 0 && <span className="text-hinomaru">✗ {counts.failed}</span>}
            </div>
          </div>
          <div className="min-h-0 flex-1"><ResearchLog log={state.log} steps={state.steps} onEvidence={setEv} /></div>
        </section>

        {/* stage */}
        <section className="relative flex min-h-0 flex-col">
          <div className="flex items-center gap-1 border-b border-line px-3 py-1.5">
            {([["graph", t("theater.graph"), Network], ["ground", t("theater.ground"), Satellite]] as const).map(([k, label, Icon]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium ${tab === k ? "bg-ink text-white" : "text-ink-2 hover:bg-stage"}`}>
                <Icon size={14} /> {label}
                {k === "ground" && state.ground && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-hinomaru" />}
              </button>
            ))}
            <div className="ml-auto font-mono text-[10.5px] text-muted">
              {graph.nodes.size} {lang === "ja" ? "ノード" : "nodes"} · {graph.links.length} {lang === "ja" ? "エッジ" : "edges"}
              {state.communities > 0 && ` · ${state.communities} ${lang === "ja" ? "コミュニティ" : "communities"}`}
            </div>
          </div>
          <div className="min-h-0 flex-1">
            {tab === "graph" ? (
              <GraphCanvas nodes={graph.nodes} links={graph.links} version={graph.version} running={running} onSelect={setNode} onReplay={state.done ? replay : undefined} />
            ) : state.ground ? (
              <div className="h-full overflow-y-auto p-4 scrollbar-thin">
                <Suspense fallback={<div className="p-6 text-sm text-muted">{t("common.loading")}</div>}>
                  <GroundTruthPanel invId={invId} ground={state.ground} flags={state.flags} claims={state.claims} onEvidence={setEv} compact />
                </Suspense>
              </div>
            ) : (
              <div className="grid h-full place-items-center stage-grid">
                <div className="max-w-sm text-center">
                  <Satellite className="mx-auto text-ink-3" size={28} />
                  <p className="mt-3 text-sm text-ink-2">{lang === "ja" ? "現地確認ステップで衛星データを取得します。" : "Satellite checks run in the ground-truth step."}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* findings */}
        <section className="flex min-h-0 flex-col border-l border-line bg-wash">
          <div className="relative border-b border-line bg-paper px-4 pb-3 pt-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[13px] font-semibold">{t("report.score")}</h2>
                <div className="text-[11px] text-muted">{t("theater.findings")} · {state.flags.length} {lang === "ja" ? "件の指摘" : "flags"} · {state.claims.length} {lang === "ja" ? "件の主張" : "claims"}</div>
              </div>
            </div>
            <div className="relative mx-auto mt-1 w-fit">
              <ScoreDial score={state.score.overall} band={state.score.band} final={state.score.final} size={176} />
              <AnimatePresence>
                {state.done && state.score.final && (
                  <div className="absolute -right-[84px] top-6"><HankoSeal band={state.score.band} size={80} delay={0.25} /></div>
                )}
              </AnimatePresence>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-x-2 gap-y-1">
              {RADAR_FAMILIES.map((f) => {
                const v = state.score.subscores[f];
                return (
                  <div key={f} className="min-w-0">
                    <div className="flex items-baseline justify-between">
                      <span className="truncate text-[10px] text-muted">{lang === "ja" ? FAMILY[f].ja : FAMILY[f].en}</span>
                      <span className="num text-[13px] leading-none">{v ?? "—"}</span>
                    </div>
                    <div className="mt-0.5 h-[3px] rounded-full bg-line">
                      <motion.div className="h-full rounded-full" style={{ background: v == null ? "transparent" : v >= 80 ? "#15803D" : v >= 50 ? "#D97706" : "#E3122B" }}
                        animate={{ width: `${v ?? 0}%` }} transition={{ duration: 0.8 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin">
            <AnimatePresence initial={false}>
              {state.done && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg bg-ink p-3 text-white">
                  <div className="text-[12px] text-white/70">{lang === "ja" ? "調査完了" : "Investigation complete"} · {((state.durationMs ?? elapsed * 1000) / 1000).toFixed(1)}s</div>
                  <Link to={`/report/${invId}`} className="mt-1 flex items-center justify-between text-[14px] font-semibold hover:text-hinomaru-soft">
                    {lang === "ja" ? "信頼レポートを開く" : "Open the trust report"} <ArrowRight size={16} />
                  </Link>
                </motion.div>
              )}
              {feed.map((f, i) => <FlagCard key={`f${state.flags.length - i}`} flag={f} onEvidence={setEv} />)}
              {claims.map((c) => <ClaimCard key={`c${c.node ?? c.text}`} claim={c} onEvidence={setEv} />)}
              {state.done && state.outlook.map((s) => <SignalCard key={s.id} s={s} onEvidence={setEv} />)}
            </AnimatePresence>
            {state.error && <div className="rounded-lg border border-hinomaru bg-hinomaru-wash p-3 text-sm text-hinomaru">{state.error}</div>}
            {!state.flags.length && !state.claims.length && !state.error && (
              <p className="px-1 py-6 text-center text-[12px] text-muted">{lang === "ja" ? "指摘はルール判定のステップで表示されます。" : "Flags appear when the rulebook runs."}</p>
            )}
          </div>
        </section>
      </div>

      <NodeDrawer node={node} onClose={() => setNode(null)} onEvidence={(e) => { setNode(null); setEv(e); }} />
      <EvidenceDrawer invId={invId} evId={ev} onClose={() => setEv(null)} />
    </div>
  );
}
