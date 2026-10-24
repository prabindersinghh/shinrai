import { FileDown, FileSignature, Loader2, Plane, RotateCcw } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import AuditPanel from "../components/AuditPanel";
import { EvidenceDrawer, NodeDrawer } from "../components/Drawers";
import { SignalCard, VerdictBadge } from "../components/FindingCards";
import GraphCanvas from "../components/GraphCanvas";
import HankoSeal from "../components/HankoSeal";
import IndiaMapSvg from "../components/IndiaMapSvg";
import MoneyPanel from "../components/MoneyPanel";
import { CitedText, FlagRow, Section, SubscoreBars, SubscoreRadar, TraceTimeline } from "../components/ReportParts";
import ScoreDial from "../components/ScoreDial";
import Shell from "../components/Shell";
import TermSheet from "../components/TermSheet";
import { useI18n } from "../i18n";
import { api, type Report as ReportT } from "../lib/api";
import type { VizLink, VizNode } from "../lib/stream";
import { MODE } from "../lib/visual";

const GroundTruthPanel = lazy(() => import("../components/GroundTruthPanel"));
const SiteFlyover = lazy(() => import("../components/SiteFlyover"));

function Layer({ kanji, label, state, tone }: { kanji: string; label: string; state: string; tone: "ok" | "bad" | "pending" | "sim" }) {
  const color = { ok: "#15803D", bad: "#E3122B", pending: "#7A808C", sim: "#D97706" }[tone];
  return (
    <div className="flex items-center gap-3 bg-paper px-4 py-3">
      <span className="jp text-[26px] font-bold leading-none" style={{ color }}>{kanji}</span>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold">{label}</div>
        <div className="truncate text-[11.5px] text-muted">{state}</div>
      </div>
    </div>
  );
}

export default function Report() {
  const { id } = useParams();
  const invId = Number(id);
  const [params] = useSearchParams();
  const print = params.get("print") === "1";
  const bilingual = params.get("lang") === "bi";
  const { t, lang, pick } = useI18n();
  const [r, setR] = useState<ReportT | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ev, setEv] = useState<string | null>(null);
  const [node, setNode] = useState<VizNode | null>(null);
  const [sumLang, setSumLang] = useState<"ja" | "en">(lang);
  const [flyover, setFlyover] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const ja = lang === "ja";

  const load = useCallback(() => api.report(invId).then(setR).catch((e) => setErr(e.message)), [invId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => setSumLang(lang), [lang]);
  useEffect(() => {
    if (r && window.location.hash) setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView({ behavior: "smooth" }), 400);
  }, [r]);

  const graph = useMemo(() => {
    const nodes = new Map<string, VizNode>();
    const links: VizLink[] = [];
    if (!r) return { nodes, links };
    for (const n of r.graph.nodes) nodes.set(n.id, { ...n, addedAt: -1e9, degree: 0 });
    for (const e of r.graph.edges) {
      if (!nodes.has(e.src) || !nodes.has(e.dst)) continue;
      links.push({ source: e.src, target: e.dst, type: e.type });
      nodes.get(e.src)!.degree++;
      nodes.get(e.dst)!.degree++;
    }
    return { nodes, links };
  }, [r]);

  if (err) return <Shell><p className="mx-auto max-w-xl p-10 text-hinomaru">{err}</p></Shell>;
  if (!r) return <Shell><div className="grid h-[60vh] place-items-center"><Loader2 className="animate-spin text-muted" /></div></Shell>;

  const inv = r.investigation;
  const co = inv.company ?? {};
  const mode = MODE[inv.mode_used] ?? MODE.seed;
  const flags = [...r.flags].sort((a, b) => ["critical", "high", "medium", "low"].indexOf(a.severity) - ["critical", "high", "medium", "low"].indexOf(b.severity));
  const narrative = inv.narrative ?? {};
  const paperSources = Object.entries(inv.coverage ?? {}).filter(([k]) => ["mca_ogd", "gst", "mca_directors", "courts", "ibbi", "news", "strikeoff"].includes(k));
  const groundFlags = r.flags.filter((f) => f.family === "ground").length;
  const audited = r.audit?.status === "completed";
  const fit = inv.fit_detail ?? {};

  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      const res = await fetch(`/api/investigations/${invId}/pdf?lang=${lang}`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `shinrai_report_${invId}.pdf`;
      a.click();
    } catch {
      window.print();
    } finally {
      setPdfBusy(false);
    }
  };

  const content = (
    <div className="mx-auto max-w-[1240px] px-4 pb-20 sm:px-6" data-print-ready="true">
      {/* hero */}
      <section className="grid gap-8 pb-10 pt-10 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {inv.is_demo && <span className="chip bg-stage text-ink-3 ring-1 ring-line">{ja ? "説明用ケース" : "Illustrative case"}</span>}
            <span className={`chip ${mode.cls}`}>{mode.label}</span>
            {audited && <span className="chip bg-verified text-white">{ja ? "監査済み" : "Audited"}</span>}
            {r.money?.status === "received" && <span className="chip bg-amber text-white">{ja ? "資金確認（SIMULATED）" : "Money (SIMULATED)"}</span>}
            <span className="text-[12px] text-muted">{ja ? "信頼レポート" : "Trust report"} #{invId} · {inv.finished_at ? new Date(inv.finished_at).toLocaleString() : ""} · {((inv.duration_ms ?? 0) / 1000).toFixed(1)}s</span>
          </div>
          <h1 className="mt-3 text-[34px] font-bold leading-tight tracking-tight sm:text-[40px]">{co.name ?? r.partner.input_name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-ink-3">
            {co.cin && <span>CIN {co.cin}</span>}
            {co.state && <span className="font-sans">{co.state}</span>}
            {co.status && <span className="font-sans">{ja ? "ステータス" : "Status"}: {co.status}</span>}
            {co.date_of_incorporation && <span className="font-sans">{ja ? "設立" : "Inc."} {co.date_of_incorporation}</span>}
          </div>
          <p className="jp mt-3 text-[13px] text-muted">{ja ? `${r.sme.name_ja || r.sme.name} 様向け` : `Prepared for ${r.sme.name}`}</p>
          {!print && (
            <div className="no-print mt-6 flex flex-wrap gap-2">
              <Link to={`/ringi/${invId}`} className="btn-red"><FileSignature size={15} /> {t("report.ringi")}</Link>
              <Link to={`/master-report/${r.sme.id}`} className="btn-ghost">{ja ? "統合レポート" : "Full report · 統合レポート"}</Link>
              <button className="btn-ink" onClick={() => setFlyover(true)} disabled={!r.ground?.site}><Plane size={15} /> {t("report.flyover")}</button>
              <button className="btn-ghost" onClick={exportPdf} disabled={pdfBusy}>{pdfBusy ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} {t("report.export")}</button>
              <Link to={`/investigation/${invId}?replay=1`} className="btn-ghost"><RotateCcw size={15} /> {t("report.replay")}</Link>
            </div>
          )}
          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            <Layer kanji="書類" label="Paper" tone={paperSources.some(([, s]) => s === "failed") ? "pending" : "ok"}
              state={`${paperSources.filter(([, s]) => s === "ok" || s === "empty").length}/${paperSources.length} ${ja ? "情報源を確認" : "sources checked"}`} />
            <Layer kanji="現地" label="Ground" tone={!r.ground?.site ? "pending" : groundFlags ? "bad" : "ok"}
              state={!r.ground?.site ? (ja ? "未確認" : "not checked") : groundFlags ? `${groundFlags} ${ja ? "件の指摘" : "findings"}` : ja ? "拠点を確認" : "site verified"} />
            <Layer kanji="資金" label="Money" tone={r.money?.status === "received" ? "sim" : "pending"}
              state={r.money?.status === "received" ? (ja ? "受領済み（シミュレーション）" : "received (simulated)") : ja ? "同意待ち" : "awaiting consent"} />
            <Layer kanji="行動" label="Action" tone={audited ? "ok" : "pending"}
              state={audited ? (ja ? "現地監査済み" : "audit completed") : ja ? "稟議書・監査" : "ringi-sho · audit"} />
          </div>
        </div>
        <div className="relative flex flex-col items-center">
          <ScoreDial score={inv.overall_score} band={inv.band} final size={230} />
          <div className="absolute -left-10 top-[150px]"><HankoSeal band={inv.band} size={92} stamped={!print} delay={0.3} /></div>
          {co.state && (
            <div className="mt-3 w-[230px] rounded-lg border border-line p-3">
              <div className="label mb-1">{ja ? "所在地" : "Location"}</div>
              <IndiaMapSvg values={{ [co.state]: 80 }} highlight={[co.state, ...(r.ground?.addresses ?? []).map((a) => a.state ?? "")].filter(Boolean)}
                pins={(r.ground?.addresses ?? []).map((a) => ({ lat: a.lat, lon: a.lon, kind: a.role === "claimed_site" ? "jetro" : "consulate" }))} width={204} />
              <div className="mt-1 text-[11px] text-muted">{co.state}{r.ground?.site && r.ground.site.state !== co.state ? ` · ${ja ? "主張拠点" : "claimed site"}: ${r.ground.site.state}` : ""}</div>
            </div>
          )}
          {inv.fit_score != null && (
            <div className="mt-2 w-[230px] rounded-lg border border-line p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-semibold">{t("report.fit")}</span>
                <span className="num text-[24px] leading-none">{inv.fit_score}</span>
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-1 text-center text-[10.5px] text-muted">
                <div><div className="num text-[15px] text-ink">{fit.sector}/40</div>{ja ? "業種" : "sector"}</div>
                <div><div className="num text-[15px] text-ink">{fit.state}/30</div>{ja ? "州" : "state"}</div>
                <div><div className="num text-[15px] text-ink">{fit.scale}/30</div>{ja ? "規模" : "scale"}</div>
              </div>
              <div className="jp mt-1.5 text-[10.5px] text-muted">{ja ? `リスク許容度（${fit.appetite}）で信頼スコアを加味` : `weighted by ${fit.appetite} risk appetite`}</div>
            </div>
          )}
        </div>
      </section>

      <Section title={t("report.summary")} kicker={narrative.method === "llm" ? (ja ? "LLM作成・全文に出典" : "Written by the LLM · every sentence cited") : ja ? "テンプレート作成・全文に出典" : "Template · every sentence cited"}
        right={!print && (
          <div className="no-print flex rounded-lg bg-stage p-0.5 text-xs font-semibold ring-1 ring-line">
            {(["ja", "en"] as const).map((l) => <button key={l} onClick={() => setSumLang(l)} className={`rounded-md px-3 py-1 ${sumLang === l ? "bg-paper shadow-card" : "text-muted"}`}>{l === "ja" ? "日本語" : "English"}</button>)}
          </div>
        )}>
        <div className="max-w-[60rem] space-y-4">
          {(bilingual || sumLang === "ja") && narrative.summary_ja && <CitedText text={narrative.summary_ja} onEvidence={setEv} ja />}
          {(bilingual || sumLang === "en") && narrative.summary_en && <CitedText text={narrative.summary_en} onEvidence={setEv} />}
          {!!narrative.dropped_sentences && <p className="text-[11px] text-muted">{narrative.dropped_sentences} {ja ? "文を出典確認で削除" : "sentence(s) removed by the citation check"}</p>}
        </div>
      </Section>

      <Section title={t("report.subscores")}>
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
          <SubscoreRadar subscores={inv.subscores} />
          <SubscoreBars subscores={inv.subscores} />
        </div>
      </Section>

      <Section title={t("report.flags")} kicker={`${flags.length} ${ja ? "件 · すべて出典付き" : "flags · every one with evidence"}`}>
        <div className="space-y-2.5">
          {flags.map((f, i) => <FlagRow key={i} flag={f} invId={invId} onEvidence={setEv} />)}
          {!flags.length && <p className="text-[14px] text-verified">{ja ? "ルールに該当する指摘はありません。" : "No rule fired."}</p>}
        </div>
      </Section>

      {r.claims.length > 0 && (
        <Section title={t("report.claims")} kicker={r.partner.doc_name ?? undefined}>
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-wash text-[11px] text-muted">
                <tr><th className="w-[30%] px-4 py-2 font-medium">{ja ? "主張" : "Claim"}</th><th className="w-[130px] px-4 py-2 font-medium">{ja ? "判定" : "Verdict"}</th><th className="px-4 py-2 font-medium">{ja ? "根拠" : "Why"}</th><th className="w-[120px] px-4 py-2 font-medium">{ja ? "証拠" : "Evidence"}</th></tr>
              </thead>
              <tbody>
                {r.claims.map((c, i) => (
                  <tr key={i} className="border-t border-line align-top avoid-break">
                    <td className="px-4 py-3 font-medium">“{c.text}”<div className="font-mono text-[10px] font-normal text-muted">{c.field}</div></td>
                    <td className="px-4 py-3"><VerdictBadge verdict={c.verdict} /></td>
                    <td className={`px-4 py-3 text-[12.5px] leading-relaxed text-ink-2 ${ja ? "jp" : ""}`}>{pick(c.explanation_ja, c.explanation_en)}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{c.evidence_ids.map((e) => <button key={e} onClick={() => setEv(e)} className="rounded border border-line px-1 font-mono text-[10px] hover:text-hinomaru">{e}</button>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <section id="ground" className="scroll-mt-20 border-t border-line py-10">
        {r.ground?.site ? (
          <Suspense fallback={<Loader2 className="animate-spin text-muted" />}>
            <GroundTruthPanel invId={invId} ground={r.ground} flags={r.flags} claims={r.claims} onEvidence={setEv} onUpdated={load} />
          </Suspense>
        ) : (
          <><h2 className="jp text-[22px] font-bold">{t("ground.header")}</h2><p className="mt-2 text-sm text-muted">{ja ? "住所を特定できなかったため未実施です。" : "Not run: no address could be geocoded."}</p></>
        )}
      </section>

      <Section id="money" title={t("money.header")} kicker={ja ? "アカウント・アグリゲーター経由のGST申告" : "GST returns via Account Aggregator"}>
        <MoneyPanel invId={invId} money={r.money} consent={r.consent} onEvidence={setEv} onUpdated={load} />
      </Section>

      <Section id="audit" title={t("audit.header")} kicker={ja ? "現地の監査人による写真検証" : "Photo verification by a local auditor"}>
        <AuditPanel invId={invId} audit={r.audit} onUpdated={load} onEvidence={setEv} isDemo={inv.is_demo} />
      </Section>

      <Section id="termsheet" title={ja ? "契約条件書（リスク連動）" : "Partner term sheet"} kicker={ja ? "検証結果に連動した契約条項" : "Clauses linked to this partner's findings"}>
        <TermSheet invId={invId} onEvidence={setEv} />
      </Section>

      <Section title={t("report.suggestions")}>
        <div className="grid gap-8 lg:grid-cols-2">
          <ol className="space-y-3">
            {(narrative.suggestions ?? []).map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="num text-[20px] leading-none text-hinomaru">{String(i + 1).padStart(2, "0")}</span>
                <div><div className="jp text-[14px] leading-snug">{s.ja}</div><div className="text-[12px] text-muted">{s.en}</div></div>
              </li>
            ))}
          </ol>
          <div>
            <h3 className="jp text-[15px] font-semibold">{t("report.questions")}</h3>
            <ul className="mt-3 space-y-2.5">
              {(narrative.meeting_questions ?? []).map((q, i) => (
                <li key={i} className="border-l-2 border-ink pl-3"><div className="jp text-[13.5px]">{q.ja}</div><div className="text-[12px] text-muted">{q.en}</div></li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {inv.outlook?.length > 0 && (
        <Section title={t("report.outlook")} kicker={ja ? "予測ではなく兆候です" : "Signals, not predictions"}>
          <div className="grid gap-3 md:grid-cols-2">{inv.outlook.map((s) => <SignalCard key={s.id} s={s} onEvidence={setEv} />)}</div>
        </Section>
      )}

      <Section title={t("report.graph")} kicker={`${r.graph.nodes.length} ${ja ? "ノード" : "nodes"} · ${r.graph.edges.length} ${ja ? "エッジ" : "edges"}`}>
        <div className="h-[520px] overflow-hidden rounded-xl border border-line">
          <GraphCanvas nodes={graph.nodes} links={graph.links} version={r.graph.nodes.length} running={false} onSelect={setNode} staticMode showControls={!print} />
        </div>
      </Section>

      <Section title={t("report.trace")} kicker={`${r.trace_count} ${ja ? "件のイベント・再生可能" : "events · replayable"}`}
        right={!print && <Link to={`/investigation/${invId}?replay=1`} className="btn-ghost no-print"><RotateCcw size={14} /> {t("report.replay")}</Link>}>
        <TraceTimeline invId={invId} />
      </Section>

      <footer className="border-t border-line pt-6 text-[11.5px] leading-relaxed text-muted">
        <p className="jp">{t("report.disclaimer")}</p>
        {lang === "ja" && <p className="mt-1">Shinrai is a due-diligence aid, not a legal opinion.</p>}
        {inv.is_demo && <p className="mt-1">{ja ? "説明用ケース：この会社と関係者は架空です。衛星画像は実在の公開データです。" : "Illustrative case: this company and the people around it are fictional; satellite imagery is real public data."}</p>}
      </footer>
    </div>
  );

  return (
    <>
      {print ? content : <Shell>{content}</Shell>}
      <EvidenceDrawer invId={invId} evId={ev} onClose={() => setEv(null)} />
      <NodeDrawer node={node} onClose={() => setNode(null)} onEvidence={(e) => { setNode(null); setEv(e); }} />
      {flyover && r.ground?.site && (
        <Suspense fallback={null}><SiteFlyover ground={r.ground} flagged={groundFlags > 0} onClose={() => setFlyover(false)} /></Suspense>
      )}
    </>
  );
}
