import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Building2, ExternalLink, Layers, Loader2, MapPin, Play, RotateCcw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Cited, Disclaimer, SourceChip, type Citation } from "../components/advisor/Cited";
import ComplianceGantt, { type Step } from "../components/advisor/ComplianceGantt";
import GrowthPlan from "../components/advisor/GrowthPlan";
import IndiaMap3D, { type MapLayer, type MapState, type SupportPin } from "../components/IndiaMap3D";
import Shell, { rememberSme } from "../components/Shell";
import { useI18n } from "../i18n";
import { api } from "../lib/api";

interface StateRow {
  state: string;
  name_ja: string;
  id: string;
  factors: Record<string, number>;
  has_data: Record<string, boolean>;
  raw: Record<string, number | null>;
  fit: number;
  support: number;
  white_space: number;
  is_white_space: boolean;
  rank: number;
  support_detail: { score: number; parts: Record<string, number>; nearest_office: string; nearest_km: number };
}

const GOAL = { sell: ["Sell in India", "インドで販売"], manufacture: ["Manufacture in India", "インドで製造"], source: ["Source from India", "インドから調達"], export_hub: ["Export hub (China+1)", "輸出拠点（China+1）"] } as const;
const BAND = { lt50m: "< ¥50M", "50m_300m": "¥50–300M", "300m_1b": "¥300M–1B", gt1b: "> ¥1B" } as const;
const INDUSTRY: Record<string, [string, string]> = { auto_parts: ["Auto components", "自動車部品"], electronics: ["Electronics", "電子部品"], food: ["Food processing", "食品加工"], machinery: ["Machinery", "機械"] };

function recompute(rows: StateRow[], w: Record<string, number>): StateRow[] {
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const scored = rows.map((r) => {
    const fit = Object.entries(w).reduce((s, [f, v]) => s + (v / total) * r.factors[f], 0) * 100;
    const sup = r.support / 100;
    return { ...r, fit: Math.round(fit * 10) / 10, white_space: Math.round(fit * (1 - sup) * 10) / 10 };
  });
  scored.sort((a, b) => b.fit - a.fit);
  scored.forEach((r, i) => (r.rank = i + 1));
  const median = [...scored].sort((a, b) => a.fit - b.fit)[Math.floor(scored.length / 2)].fit;
  const ws = new Set([...scored].filter((r) => r.fit >= median).sort((a, b) => b.white_space - a.white_space).slice(0, 2).map((r) => r.state));
  return scored.map((r) => ({ ...r, is_white_space: ws.has(r.state) }));
}

export default function Advisor() {
  const { smeId } = useParams();
  const id = Number(smeId);
  const { lang } = useI18n();
  const ja = lang === "ja";
  const [plan, setPlan] = useState<any>(null);
  const [log, setLog] = useState<{ icon: string; text: string; cite?: Citation }[]>([]);
  const [live, setLive] = useState<Record<string, StateRow>>({});
  const [running, setRunning] = useState(false);
  const [layer, setLayer] = useState<MapLayer>("fit");
  const [weights, setWeights] = useState<Record<string, number> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [section, setSection] = useState<"route" | "compliance" | "growth" | "contacts">("route");
  const logBox = useRef<HTMLDivElement>(null);
  const stream = useRef<EventSource | null>(null);

  useEffect(() => {
    rememberSme(id);
  }, [id]);

  const run = useCallback(() => {
    setRunning(true);
    setPlan(null);
    setLive({});
    setLog([]);
    setSelected(null);
    stream.current?.close();
    const es = new EventSource(`/api/advisor/${id}/stream`);
    stream.current = es;
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data);
      if (ev.type === "log") setLog((l) => [...l, ev]);
      if (ev.type === "advisor.started") setWeights(ev.weights);
      if (ev.type === "state.scored") setLive((s) => ({ ...s, [ev.state.state]: ev.state }));
      if (ev.type === "advisor.done") {
        setPlan(ev.plan);
        setWeights(ev.plan.weights);
        setRunning(false);
      }
    };
    es.addEventListener("end", () => es.close());
    es.onerror = () => {
      es.close();
      setRunning(false);
      api.advisor(id).then((p) => { setPlan(p); setWeights(p.weights); });
    };
  }, [id]);

  useEffect(() => {
    run();
    return () => stream.current?.close();
  }, [run]);
  useEffect(() => {
    logBox.current?.scrollTo({ top: 1e6, behavior: "smooth" });
  }, [log]);

  const rows: StateRow[] = useMemo(() => {
    const base: StateRow[] = plan ? plan.states : Object.values(live);
    return plan && weights ? recompute(base, weights) : base;
  }, [plan, live, weights]);
  const scores: Record<string, MapState> = useMemo(() => Object.fromEntries(rows.map((r) => [r.state, r])), [rows]);
  const pins: SupportPin[] = useMemo(() => {
    if (!plan) return [];
    const sn = plan.support_network;
    return [
      ...sn.offices.map((o: any) => ({ id: o.id, name: o.name, kind: o.kind === "jetro" ? "jetro" : "consulate", lat: o.lat, lon: o.lon })),
      ...sn.jits.map((j: any) => ({ id: j.id, name: j.name, kind: "jit", lat: j.lat, lon: j.lon })),
    ];
  }, [plan]);

  const cites: Record<string, Citation> = plan?.citations ?? {};
  const top3 = rows.slice(0, 3);
  const sel = rows.find((r) => r.state === selected);
  const profile = plan?.profile;

  const setStatus = async (stepId: string, status: Step["status"]) => {
    await api.advisorStep(id, stepId, status);
    setPlan((p: any) => ({ ...p, roadmap: p.roadmap.map((s: Step) => (s.id === stepId ? { ...s, status } : s)) }));
  };

  return (
    <Shell wide>
      <div className="mx-auto max-w-[1600px] px-4 pb-20 pt-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="label">{ja ? "Shinrai Advisor · 市場・立地" : "Shinrai Advisor · Market & location"}</div>
            <h1 className="jp mt-1 text-[30px] font-bold tracking-tight">{ja ? "どこで、どの規模で、どう参入するか" : "Where to enter India, at what scale, and how"}</h1>
            {profile && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
                <span className="chip bg-ink text-white">{ja ? profile.name_ja || profile.name : profile.name}</span>
                <span className="chip bg-stage text-ink-2 ring-1 ring-line">{INDUSTRY[profile.industry]?.[ja ? 1 : 0] ?? profile.industry}</span>
                <span className="chip bg-stage text-ink-2 ring-1 ring-line">{GOAL[profile.goal as keyof typeof GOAL]?.[ja ? 1 : 0]}</span>
                <span className="chip bg-stage text-ink-2 ring-1 ring-line">{BAND[profile.investment_band as keyof typeof BAND]}</span>
                <span className="chip bg-stage text-ink-2 ring-1 ring-line">{profile.risk_appetite}</span>
                <span className="chip bg-stage text-ink-2 ring-1 ring-line">{profile.timeline_months} {ja ? "か月" : "months"}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Link to={`/onboarding?edit=${id}`} className="btn-ghost">{ja ? "プロフィールを編集" : "Edit profile"}</Link>
            <Link to={`/master-report/${id}`} className="btn-ghost">{ja ? "統合レポート" : "Full report · 統合レポート"}</Link>
            <button className="btn-ink" onClick={run} disabled={running}>{running ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />} {ja ? "再分析" : "Re-run analysis"}</button>
            <Link to={`/partners/${id}`} className="btn-red">{ja ? "候補企業を検証" : "Verify partners"} <ArrowRight size={15} /></Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[300px_1fr_320px]">
          {/* run log */}
          <section className="panel flex max-h-[640px] flex-col">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold">{ja ? "分析ログ" : "Analysis log"}</h2>
              {running ? <Loader2 size={14} className="animate-spin text-muted" /> : <span className="chip bg-verified-soft text-verified">{ja ? "完了" : "Complete"}</span>}
            </div>
            <div ref={logBox} className="flex-1 space-y-1 overflow-y-auto px-3 py-2 font-mono text-[11.5px] scrollbar-thin">
              <AnimatePresence initial={false}>
                {log.map((l, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2 py-0.5 text-ink-2">
                    <span className="w-4 shrink-0 text-center">{l.icon}</span>
                    <span className="min-w-0 break-words">
                      {l.text}
                      {l.cite && (
                        <a href={l.cite.source_url.startsWith("http") ? l.cite.source_url : undefined} target="_blank" rel="noreferrer"
                          className="ml-1 font-sans text-[10px] text-muted underline decoration-line-strong underline-offset-2 hover:text-hinomaru">source</a>
                      )}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {plan && (
              <div className="border-t border-line p-3">
                <div className="label mb-2">{ja ? "推奨立地 トップ3" : "Top 3 locations"}</div>
                <ol className="space-y-1.5">
                  {top3.map((r) => (
                    <li key={r.state}>
                      <button onClick={() => setSelected(r.state)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-wash">
                        <span className="num text-[20px] leading-none text-hinomaru">{r.rank}</span>
                        <span className="flex-1 text-[13px] font-semibold">{ja ? r.name_ja : r.state}</span>
                        <span className="num text-[18px] leading-none">{r.fit}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          {/* 3D map */}
          <section className="panel relative overflow-hidden">
            <div className="absolute left-3 top-3 z-10 flex rounded-lg bg-paper/95 p-0.5 text-[12px] font-semibold shadow-card ring-1 ring-line backdrop-blur" role="group">
              {([["fit", ja ? "適合度" : "Fit"], ["whitespace", ja ? "ホワイトスペース" : "White space"], ["support", ja ? "支援カバー" : "Support coverage"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setLayer(k)} aria-pressed={layer === k} className={`rounded-md px-3 py-1.5 ${layer === k ? "bg-ink text-white" : "text-ink-2"}`}>{l}</button>
              ))}
            </div>
            <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-paper/95 px-3 py-2 text-[11px] text-ink-2 shadow-card ring-1 ring-line backdrop-blur">
              {layer === "fit" && <div className="flex items-center gap-2"><span className="h-2.5 w-16 rounded-sm bg-gradient-to-r from-[#DCE3EC] to-[#1E3A5F]" /> {ja ? "高さ＝適合度" : "Height = fit score"}<span className="ml-2 h-2.5 w-2.5 border-2 border-hinomaru" /> {ja ? "トップ3" : "Top 3"}</div>}
              {layer === "whitespace" && <div className="flex items-center gap-2"><span className="h-2.5 w-16 rounded-sm bg-gradient-to-r from-[#FBE7CF] to-[#D97706]" /> {ja ? "適合度が高く、日本側支援が手薄な州" : "High fit, thin Japanese support"}</div>}
              {layer === "support" && <div className="flex items-center gap-3"><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-hinomaru" />JETRO</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-ink" />{ja ? "大使館・領事館" : "Embassy / consulates"}</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rotate-45 bg-[#2BB3A3]" />JIT</span></div>}
              <div className="mt-1 text-[10px] text-muted">{ja ? "Shinraiは JETRO のネットワークを補完します" : "Shinrai complements JETRO's network"} · {ja ? "灰色＝未分析の州" : "grey = not yet profiled"}</div>
            </div>
            <IndiaMap3D scores={scores} layer={layer} pins={pins} selected={selected} onSelect={setSelected} height={640} />
          </section>

          {/* weights */}
          <section className="panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold">{ja ? "評価の重み" : "Weights"}</h2>
              {plan && <button className="text-[11px] text-muted hover:text-ink" onClick={() => setWeights(plan.weights)}>{ja ? "リセット" : "Reset"}</button>}
            </div>
            <p className="mt-1 text-[11.5px] text-muted">{ja ? "目的とリスク許容度から設定。動かすと即座に再ランキングします。" : "Set from your goal and risk appetite. Move a slider to re-rank instantly."}</p>
            <div className="mt-3 space-y-3">
              {weights && plan && Object.entries(plan.factors as Record<string, { en: string; ja: string }>).map(([f, lab]) => (
                <label key={f} className="block">
                  <div className="flex justify-between text-[12px]"><span>{ja ? lab.ja : lab.en}</span><span className="font-mono text-muted">{Math.round((weights[f] / Object.values(weights).reduce((a, b) => a + b, 0)) * 100)}%</span></div>
                  <input type="range" min={0} max={0.5} step={0.01} value={weights[f]} onChange={(e) => setWeights((w) => ({ ...w!, [f]: Number(e.target.value) }))} className="w-full accent-[#141414]" />
                </label>
              ))}
              {!plan && <div className="h-40 animate-pulse rounded-lg bg-stage" />}
            </div>
            {plan?.sensitivity?.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <div className="label">{ja ? "推奨が変わる条件" : "What would change this"}</div>
                <ul className="mt-1.5 space-y-1 text-[12px] text-ink-2">
                  {plan.sensitivity.map((s: any) => (
                    <li key={s.factor}>{ja ? `「${s.label_ja}」を重視すると ${s.new_top} が首位` : `More weight on ${s.label_en.toLowerCase()} → ${s.new_top} leads`}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        {plan && (
          <>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {plan.top.map((t: any, i: number) => (
                <div key={t.state} className="panel p-5">
                  <div className="flex items-baseline justify-between">
                    <span className="num text-[30px] leading-none text-hinomaru">{i + 1}</span>
                    <span className="text-[12px] text-muted">{ja ? "適合度" : "Fit"} <span className="num text-[22px] text-ink">{t.fit}</span></span>
                  </div>
                  <div className="jp mt-1 text-[18px] font-bold">{ja ? t.name_ja : t.state}</div>
                  <p className={`mt-2 text-[13px] leading-relaxed text-ink-2 ${ja ? "jp" : ""}`}><Cited text={ja ? t.rationale_ja : t.rationale_en} citations={cites} /></p>
                  {(ja ? t.tradeoffs_ja : t.tradeoffs_en).map((x: string) => <p key={x} className="mt-1.5 text-[12px] text-muted">{x}</p>)}
                  <button className="mt-3 text-[12px] font-medium text-ink hover:text-hinomaru" onClick={() => setSelected(t.state)}>{ja ? "州の詳細" : "State details"} →</button>
                </div>
              ))}
            </div>

            {plan.white_space.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber/40 bg-amber-soft/40 p-5">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-amber"><Sparkles size={15} /> {ja ? "ホワイトスペース（機会が大きく、支援が手薄）" : "White space: strong fit, thinner support"}</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {plan.white_space.map((w: any) => (
                    <div key={w.state} className="rounded-lg bg-paper p-4">
                      <div className="flex items-baseline justify-between"><span className="jp text-[15px] font-semibold">{ja ? w.name_ja : w.state}</span><span className="font-mono text-[11px] text-muted">fit {w.fit} · support {w.support}</span></div>
                      <p className={`mt-1.5 text-[12.5px] leading-relaxed text-ink-2 ${ja ? "jp" : ""}`}>{ja ? w.ja : w.en}</p>
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-white">{ja ? w.recommendation_ja : w.recommendation_en}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex gap-1 border-b border-line">
              {([["route", ja ? "参入形態と規模" : "Entry route & scale"], ["compliance", ja ? "コンプライアンス工程" : "Compliance roadmap"], ["growth", ja ? "成長戦略" : "Growth plan"], ["contacts", ja ? "主要窓口" : "Key contacts"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setSection(k)} className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-semibold ${section === k ? "border-hinomaru text-ink" : "border-transparent text-muted hover:text-ink"}`}>{l}</button>
              ))}
            </div>
            <div className="pt-6">
              {section === "route" && (
                <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
                  <div className="panel p-5">
                    <div className="label">{ja ? "推奨する参入形態" : "Recommended entry route"}</div>
                    <div className="jp mt-1 text-[22px] font-bold">{ja ? plan.entry.route.name_ja : plan.entry.route.name}</div>
                    <p className={`mt-2 text-[13.5px] text-ink-2 ${ja ? "jp" : ""}`}>{ja ? plan.entry.advice_ja : plan.entry.advice_en}</p>
                    <ul className="mt-3 space-y-1 text-[12.5px] text-ink-2">
                      {(ja ? plan.entry.reasons_ja : plan.entry.reasons_en).map((r: string) => <li key={r}>· <Cited text={r} citations={cites} /></li>)}
                    </ul>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div><div className="label">{ja ? "利点" : "Pros"}</div><ul className="mt-1 space-y-1 text-[12.5px]">{plan.entry.route.pros.map((p: string) => <li key={p} className="text-verified">+ <span className="text-ink-2">{p}</span></li>)}</ul></div>
                      <div><div className="label">{ja ? "留意点" : "Cons"}</div><ul className="mt-1 space-y-1 text-[12.5px]">{plan.entry.route.cons.map((p: string) => <li key={p} className="text-hinomaru">− <span className="text-ink-2">{p}</span></li>)}</ul></div>
                    </div>
                    <div className="mt-4 text-[12px] text-muted">{plan.entry.route.approvals}</div>
                    <div className="mt-3"><SourceChip url={plan.entry.route.source_url} asOf={plan.entry.route.as_of} verified={plan.entry.route.verified_by_team} /></div>
                  </div>
                  <div className="space-y-4">
                    <div className="panel p-5">
                      <div className="label">{ja ? "代替案" : "Alternative"}</div>
                      <div className="jp mt-1 text-[17px] font-semibold">{ja ? plan.entry.alternative.name_ja : plan.entry.alternative.name}</div>
                      <p className="mt-1 text-[12.5px] text-ink-2">{plan.entry.alternative.entity}</p>
                    </div>
                    {plan.entry.sector && (
                      <div className="panel p-5">
                        <div className="label">{ja ? "業種の規制" : "Sector rules"}</div>
                        <div className="jp mt-1 text-[15px] font-semibold">{ja ? plan.entry.sector.name_ja : plan.entry.sector.name}</div>
                        <div className="mt-2 text-[12.5px] text-ink-2">FDI: {plan.entry.sector.fdi_route} · {plan.entry.sector.fdi_cap_pct}%<Cited text={`[kb:${plan.entry.sector.id}]`} citations={cites} /></div>
                        <div className="mt-1 text-[12.5px] text-ink-2">PLI: {plan.entry.sector.pli}</div>
                        <div className="mt-1 text-[12px] text-muted">{plan.entry.sector.regulators.join(" · ")}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {section === "compliance" && (
                <>
                  <ComplianceGantt steps={plan.roadmap} onStatus={setStatus} />
                  <Disclaimer ja={ja} />
                </>
              )}
              {section === "growth" && (
                <>
                  <GrowthPlan growth={plan.growth} />
                  <Disclaimer ja={ja} />
                </>
              )}
              {section === "contacts" && (
                <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {plan.contacts.map((c: any) => (
                      <a key={c.id} href={c.source_url} target="_blank" rel="noreferrer" className="panel group block p-4 hover:border-line-strong">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted"><Building2 size={13} /> {c.kind.replace("_", " ")}</div>
                        <div className="jp mt-1.5 text-[14px] font-semibold group-hover:text-hinomaru">{ja ? c.name_ja : c.name}</div>
                        <p className="mt-1 text-[12px] text-ink-2">{c.channel}</p>
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-muted">{c.source_url.replace(/^https?:\/\//, "").replace(/\/$/, "")} <ExternalLink size={11} /></div>
                      </a>
                    ))}
                  </div>
                  <div className="panel h-fit p-5">
                    <div className="text-[14px] font-semibold">{ja ? "評価対象となる検証済みパートナー" : "Verified partners to evaluate"}</div>
                    <p className="mt-1 text-[12px] text-muted">{ja ? "Shinrai Verify で良好な判定を受けた候補企業" : "Candidates already checked by Shinrai Verify with a good band"}</p>
                    <div className="mt-3 space-y-2">
                      {plan.verified_partners.map((v: any) => (
                        <Link key={v.inv_id} to={`/report/${v.inv_id}`} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 hover:bg-wash">
                          <span className="text-[13px] font-medium">{v.name}</span>
                          <span className="flex items-center gap-2 text-[11px] text-muted">{v.state}<span className="num text-[18px] text-verified">{v.score}</span></span>
                        </Link>
                      ))}
                      {!plan.verified_partners.length && <p className="text-[12.5px] text-ink-3">{ja ? "まだありません。候補企業を検証すると表示されます。" : "None yet. Verify a partner and it appears here."}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {sel && (
          <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[420px] flex-col border-l border-line bg-paper shadow-lift">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div><div className="label">{ja ? "州の詳細" : "State"}</div><div className="jp text-[18px] font-bold">{ja ? sel.name_ja : sel.state}</div></div>
              <button className="btn-ghost !p-1.5" onClick={() => setSelected(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-thin">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-stage p-2"><div className="num text-[24px]">{sel.fit}</div><div className="label">{ja ? "適合度" : "Fit"}</div></div>
                <div className="rounded-lg bg-stage p-2"><div className="num text-[24px]">{sel.support}</div><div className="label">{ja ? "支援" : "Support"}</div></div>
                <div className="rounded-lg bg-stage p-2"><div className="num text-[24px]">{sel.white_space}</div><div className="label">{ja ? "白地" : "White space"}</div></div>
              </div>
              <div>
                <div className="label mb-2 flex items-center gap-1"><Layers size={12} /> {ja ? "要因の内訳" : "Factor breakdown"}</div>
                {plan && Object.entries(plan.factors as Record<string, { en: string; ja: string }>).map(([f, lab]) => (
                  <div key={f} className="mb-2">
                    <div className="flex justify-between text-[12px]"><span>{ja ? lab.ja : lab.en}</span><span className="font-mono text-muted">{sel.has_data[f] ? sel.raw[f] ?? "" : ja ? "データなし（中立）" : "no data (neutral)"}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-ink" style={{ width: `${sel.factors[f] * 100}%`, opacity: sel.has_data[f] ? 1 : 0.3 }} /></div>
                  </div>
                ))}
              </div>
              <div>
                <div className="label mb-1 flex items-center gap-1"><MapPin size={12} /> {ja ? "日本側の支援" : "Japanese support"}</div>
                <p className="text-[12.5px] text-ink-2">{ja ? `最寄り：${sel.support_detail.nearest_office}（約${sel.support_detail.nearest_km}km）` : `Nearest: ${sel.support_detail.nearest_office} (~${sel.support_detail.nearest_km} km)`}</p>
              </div>
              <Link to={`/partners/${id}`} className="btn-red w-full"><Play size={14} /> {ja ? "この州の候補企業を検証" : "Verify partners in this state"}</Link>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </Shell>
  );
}
