import { FileDown, Loader2, Printer } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Cited } from "../components/advisor/Cited";
import IndiaMapSvg from "../components/IndiaMapSvg";
import { LangToggle } from "../components/Shell";
import { useI18n } from "../i18n";
import { dataUrl } from "../lib/api";
import { BAND, FAMILY, SEVERITY, fmtInr } from "../lib/visual";

const PAGE_H = 1032; // A4 printable height at 96 dpi with 12 mm margins
const PAGE_W = 703;

type Lang = "en" | "ja" | "bi";

function T({ en, ja, mode }: { en: ReactNode; ja: ReactNode; mode: Lang }) {
  if (mode === "bi") return <>{ja}<span className="mt-0.5 block text-[0.86em] text-ink-3">{en}</span></>;
  return <>{mode === "ja" ? ja : en}</>;
}

function Section({ id, n, title, children }: { id: string; n: number; title: ReactNode; children: ReactNode }) {
  return (
    <section id={id} data-toc={id} className="mr-section print-break pt-2">
      <div className="mb-5 flex items-baseline gap-3 border-b-2 border-ink pb-2">
        <span className="num text-[26px] leading-none text-hinomaru">{String(n).padStart(2, "0")}</span>
        <h2 className="jp text-[20px] font-bold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const TITLES: Record<string, [string, string]> = {
  exec: ["Executive summary", "エグゼクティブサマリー"], profile: ["Company profile and objectives", "企業プロフィールと目的"],
  market: ["Market and location fit", "市場・立地の適合度"], whitespace: ["White space opportunities", "ホワイトスペース"],
  route: ["Entry route", "参入形態"], compliance: ["Compliance roadmap", "コンプライアンス工程"],
  partners: ["Partner verification", "パートナー検証"], compare: ["Partner comparison", "パートナー比較"],
  terms: ["Contract term sheet", "契約条件書"], growth: ["Growth plan", "成長戦略"],
  contacts: ["Key contacts and next steps", "主要窓口と次のステップ"], method: ["Methodology and sources", "方法論と出典"],
};
const ONLY: Record<string, string[]> = {
  market: ["exec", "profile", "market", "whitespace", "route"], compliance: ["route", "compliance"], growth: ["growth", "contacts"],
};

export default function MasterReport() {
  const { smeId } = useParams();
  const [params] = useSearchParams();
  const print = params.get("print") === "1";
  const only = params.get("only");
  const { lang } = useI18n();
  const mode: Lang = (params.get("lang") as Lang) || lang;
  const ja = mode === "ja";
  const [d, setD] = useState<any>(null);
  const [toc, setToc] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/sme/${smeId}/master`).then((r) => r.json()).then(setD);
  }, [smeId]);

  useLayoutEffect(() => {
    if (!d || !root.current) return;
    const t = setTimeout(() => {
      let page = 2; // page 1 is the cover with the contents
      const out: Record<string, number> = {};
      for (const el of Array.from(root.current!.querySelectorAll<HTMLElement>("[data-toc]"))) {
        out[el.dataset.toc!] = page;
        page += Math.max(1, Math.ceil(el.offsetHeight / PAGE_H));
      }
      setToc(out);
      setReady(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [d, mode]);

  if (!d) return <div className="grid h-screen place-items-center"><Loader2 className="animate-spin text-muted" /></div>;
  const show = (k: string) => !only || (ONLY[only] ?? []).includes(k);
  const keys = Object.keys(TITLES).filter(show);
  const num = (k: string) => keys.indexOf(k) + 1;
  const plan = d.plan;
  const cites = d.citations;
  const fitValues = Object.fromEntries(plan.states.map((s: any) => [s.state, s.fit]));
  const wsValues = Object.fromEntries(plan.states.filter((s: any) => s.is_white_space).map((s: any) => [s.state, s.white_space]));
  const pins = [...plan.support_network.offices.map((o: any) => ({ lat: o.lat, lon: o.lon, kind: o.kind })), ...plan.support_network.jits.map((j: any) => ({ lat: j.lat, lon: j.lon, kind: "jit" }))];
  const title = (k: string) => <T mode={mode} en={TITLES[k][0]} ja={TITLES[k][1]} />;
  const recColor = d.decision.id === "no_go" ? "#E3122B" : d.decision.id === "go" ? "#15803D" : "#D97706";

  const download = async (l: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/sme/${smeId}/master-report.pdf?lang=${l}`);
      if (!res.ok) throw new Error();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await res.blob());
      a.download = `shinrai_master_report_${smeId}_${l}.pdf`;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`min-h-screen bg-stage py-8 print:bg-white print:py-0 ${ja ? "jp" : ""}`}>
      <style>{`@media print { @page { size: A4 portrait; margin: 12mm; } }`}</style>
      {!print && (
        <div className="no-print mx-auto mb-5 flex max-w-[860px] flex-wrap items-center justify-between gap-2 px-4">
          <Link to={`/advisor/${smeId}`} className="text-[13px] text-ink-2 hover:text-hinomaru">{ja ? "← アドバイザーに戻る" : "← Back to advisor"}</Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <button className="btn-ghost" onClick={() => window.print()}><Printer size={15} /> {ja ? "印刷" : "Print"}</button>
            {(["en", "ja", "bi"] as const).map((l) => (
              <button key={l} className={l === "en" ? "btn-red" : "btn-ghost"} disabled={busy} onClick={() => download(l)}>
                {busy && l === "en" ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} PDF {l === "bi" ? "JA/EN" : l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
      <div ref={root} data-print-ready={ready ? "true" : "false"} className="mx-auto bg-paper px-10 py-10 shadow-lift print:px-0 print:py-0 print:shadow-none"
        style={{ width: print ? PAGE_W : 860 }}>
        {/* cover + contents */}
        <div className="flex min-h-[980px] flex-col">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-hinomaru text-[20px] font-bold text-white">信</span>
            <span className="num text-[26px] tracking-[0.08em]">SHINRAI</span><span className="jp text-[15px] font-bold text-ink-2">信頼</span>
          </div>
          <div className="mt-24">
            <div className="label">{ja ? "統合レポート" : mode === "bi" ? "統合レポート · Master report" : "Master report"}</div>
            <h1 className="mt-2 text-[34px] font-bold leading-tight tracking-tight">{ja ? d.sme.name_ja || d.sme.name : d.sme.name}</h1>
            <p className="mt-2 text-[15px] text-ink-2"><T mode={mode} en="India market entry and partner verification" ja="インド市場参入とパートナー検証" /></p>
            <div className="mt-4 flex gap-6 text-[12.5px] text-ink-3">
              <span>{ja ? "作成日" : "Date"}: {d.generated}</span><span>{ja ? "版" : "Version"}: {d.version}</span>
            </div>
          </div>
          <div className="mt-16">
            <div className="label mb-2"><T mode={mode} en="Contents" ja="目次" /></div>
            <ol className="divide-y divide-line border-y border-line">
              {keys.map((k) => (
                <li key={k} className="flex items-baseline gap-3 py-2 text-[13.5px]">
                  <span className="num w-6 text-[15px] text-hinomaru">{String(num(k)).padStart(2, "0")}</span>
                  <span className="flex-1">{title(k)}</span>
                  <span className="font-mono text-[12px] text-muted">{toc[k] ?? ""}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-auto pt-10 text-[10.5px] leading-relaxed text-muted">
            <T mode={mode} en="Shinrai provides decision support based on public sources. Confirm legal, tax and regulatory matters with qualified professionals."
              ja="Shinraiは公的情報に基づく意思決定支援を提供します。法務・税務・規制に関する事項は、資格を有する専門家に確認してください。" />
          </p>
        </div>

        {show("exec") && (
          <Section id="exec" n={num("exec")} title={title("exec")}>
            <div className="rounded-xl border-2 p-4" style={{ borderColor: recColor }}>
              <div className="label"><T mode={mode} en="Recommendation (rule-derived)" ja="推奨判断（ルールに基づく）" /></div>
              <div className="mt-1 text-[20px] font-bold" style={{ color: recColor }}><T mode={mode} en={d.decision.en} ja={d.decision.ja} /></div>
              <p className="mt-1 text-[13px] text-ink-2"><T mode={mode} en={d.decision.reason_en} ja={d.decision.reason_ja} /></p>
            </div>
            <ul className="mt-5 space-y-2.5 text-[14px] leading-relaxed">
              {d.executive_en.map((e: string, i: number) => (
                <li key={i} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-hinomaru" /><span><T mode={mode} en={e} ja={d.executive_ja[i]} /></span></li>
              ))}
            </ul>
          </Section>
        )}

        {show("profile") && (
          <Section id="profile" n={num("profile")} title={title("profile")}>
            <table className="w-full text-[13px]">
              <tbody>
                {[
                  [["Company", "企業名"], `${d.sme.name}${d.sme.name_ja ? ` · ${d.sme.name_ja}` : ""}`],
                  [["Industry and products", "業種・製品"], `${d.sme.industry} · ${d.sme.products || "—"}${d.sme.hs_chapter ? ` (HS ${d.sme.hs_chapter})` : ""}`],
                  [["Goal in India", "インドでの目的"], d.sme.goal], [["Investment band", "投資規模"], d.sme.investment_band],
                  [["Timeline and first-year headcount", "期間・初年度人員"], `${d.sme.timeline_months} months · ${d.sme.headcount_y1}`],
                  [["Preferred entry mode", "希望する参入形態"], d.sme.entry_mode], [["Risk appetite", "リスク許容度"], d.sme.risk_appetite],
                  [["Must-haves", "必須条件"], (d.sme.must_haves || []).join(", ") || "—"], [["Current export markets", "現在の輸出先"], (d.sme.export_markets || []).join(", ") || "—"],
                ].map(([k, v]: any) => (
                  <tr key={k[0]} className="border-b border-line"><th className="w-[38%] py-2 pr-4 text-left font-medium text-ink-3"><T mode={mode} en={k[0]} ja={k[1]} /></th><td className="py-2">{v}</td></tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {show("market") && (
          <Section id="market" n={num("market")} title={title("market")}>
            <div className="grid grid-cols-[300px_1fr] gap-6">
              <IndiaMapSvg values={fitValues} highlight={plan.top.map((t: any) => t.state)} width={300} />
              <div className="space-y-4">
                {plan.top.map((t: any, i: number) => (
                  <div key={t.state} className="avoid-break">
                    <div className="flex items-baseline gap-2"><span className="num text-[20px] text-hinomaru">{i + 1}</span><span className="text-[15px] font-semibold">{ja ? t.name_ja : t.state}</span><span className="ml-auto font-mono text-[12px] text-muted">fit {t.fit}</span></div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2"><Cited text={ja ? t.rationale_ja : t.rationale_en} citations={cites} /></p>
                    {mode === "bi" && <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3"><Cited text={t.rationale_en} citations={cites} /></p>}
                  </div>
                ))}
              </div>
            </div>
            <h3 className="mt-6 text-[13px] font-semibold"><T mode={mode} en="Weights used" ja="使用した重み" /></h3>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
              {Object.entries(plan.weights).map(([f, w]: any) => (
                <div key={f} className="flex justify-between rounded border border-line px-2 py-1"><span>{ja ? plan.factors[f].ja : plan.factors[f].en}</span><span className="font-mono">{Math.round(w * 100)}%</span></div>
              ))}
            </div>
            {plan.sensitivity.length > 0 && (
              <>
                <h3 className="mt-5 text-[13px] font-semibold"><T mode={mode} en="What would change this recommendation" ja="推奨が変わる条件" /></h3>
                <ul className="mt-1 text-[12.5px] text-ink-2">{plan.sensitivity.map((s: any) => <li key={s.factor}>· <T mode={mode} en={`More weight on ${s.label_en.toLowerCase()} → ${s.new_top} leads`} ja={`「${s.label_ja}」を重視すると${s.new_top}が首位`} /></li>)}</ul>
              </>
            )}
          </Section>
        )}

        {show("whitespace") && (
          <Section id="whitespace" n={num("whitespace")} title={title("whitespace")}>
            <div className="grid grid-cols-[260px_1fr] gap-6">
              <IndiaMapSvg values={wsValues} colour="whitespace" pins={pins} width={260} />
              <div className="space-y-3">
                <table className="w-full text-[12.5px]">
                  <thead className="text-left text-muted"><tr><th className="py-1"><T mode={mode} en="State" ja="州" /></th><th>Fit</th><th><T mode={mode} en="Support" ja="支援" /></th><th><T mode={mode} en="White space" ja="白地" /></th></tr></thead>
                  <tbody>{plan.states.map((s: any) => <tr key={s.state} className="border-t border-line"><td className="py-1">{ja ? s.name_ja : s.state}</td><td>{s.fit}</td><td>{s.support}</td><td className={s.is_white_space ? "font-semibold text-amber" : ""}>{s.white_space}</td></tr>)}</tbody>
                </table>
                {plan.white_space.map((w: any) => (
                  <div key={w.state} className="avoid-break rounded-lg border border-amber/40 bg-amber-soft/40 p-3 text-[12.5px]">
                    <div className="font-semibold">{ja ? w.name_ja : w.state}</div>
                    <p className="mt-1 text-ink-2"><T mode={mode} en={w.en} ja={w.ja} /></p>
                  </div>
                ))}
                <p className="text-[11px] text-muted"><T mode={mode} en="Shinrai complements JETRO's network; support scores reflect proximity to JETRO and consular offices, JITs, Japanese presence and state Japan desks." ja="ShinraiはJETROのネットワークを補完します。支援スコアはJETRO・領事館への近さ、JIT、日系企業の集積、州のジャパンデスクを反映します。" /></p>
              </div>
            </div>
          </Section>
        )}

        {show("route") && (
          <Section id="route" n={num("route")} title={title("route")}>
            <div className="text-[18px] font-bold">{ja ? plan.entry.route.name_ja : plan.entry.route.name}</div>
            <p className="mt-1 text-[13px] text-ink-2"><T mode={mode} en={plan.entry.advice_en} ja={plan.entry.advice_ja} /></p>
            <ul className="mt-3 text-[12.5px] text-ink-2">{plan.entry.reasons_en.map((r: string, i: number) => <li key={i}>· <Cited text={ja ? plan.entry.reasons_ja[i] : r} citations={cites} /></li>)}</ul>
            <div className="mt-4 grid grid-cols-2 gap-4 text-[12.5px]">
              <div><div className="font-semibold"><T mode={mode} en="Pros" ja="利点" /></div><ul className="mt-1">{plan.entry.route.pros.map((p: string) => <li key={p}>+ {p}</li>)}</ul></div>
              <div><div className="font-semibold"><T mode={mode} en="Cons" ja="留意点" /></div><ul className="mt-1">{plan.entry.route.cons.map((p: string) => <li key={p}>− {p}</li>)}</ul></div>
            </div>
            <p className="mt-4 text-[12.5px]"><span className="font-semibold"><T mode={mode} en="Alternative" ja="代替案" />:</span> {ja ? plan.entry.alternative.name_ja : plan.entry.alternative.name} · {plan.entry.alternative.entity}</p>
          </Section>
        )}

        {show("compliance") && (
          <Section id="compliance" n={num("compliance")} title={title("compliance")}>
            <div className="space-y-1">
              {plan.roadmap.map((s: any) => (
                <div key={s.id} className="grid grid-cols-[200px_1fr] items-center gap-3 text-[11.5px]">
                  <span className={`truncate ${s.critical ? "font-semibold text-hinomaru" : ""}`}>{ja ? s.name_ja : s.name}</span>
                  <div className="relative h-3 rounded bg-stage"><div className="absolute h-3 rounded bg-ink" style={{ left: `${(s.start / 180) * 100}%`, width: `${Math.max(2, (Math.min(s.days, 180 - s.start) / 180) * 100)}%` }} /></div>
                </div>
              ))}
              <div className="grid grid-cols-[200px_1fr] text-[10px] text-muted"><span /><div className="flex justify-between"><span>Day 0</span><span>60</span><span>120</span><span>180</span></div></div>
            </div>
            <table className="mt-5 w-full text-[11.5px]">
              <thead className="text-left text-muted"><tr><th className="py-1"><T mode={mode} en="Step" ja="手続き" /></th><th><T mode={mode} en="Authority / form" ja="機関・様式" /></th><th><T mode={mode} en="Deadline" ja="期限" /></th><th><T mode={mode} en="Owner" ja="担当" /></th></tr></thead>
              <tbody>
                {plan.roadmap.map((s: any) => (
                  <Fragment key={s.id}>
                    <tr className="border-t border-line align-top"><td className="py-1.5 pr-2 font-medium">{ja ? s.name_ja : s.name}</td><td className="pr-2">{s.authority} · {s.form}</td><td className="pr-2">{s.deadline}</td><td>{s.owner}</td></tr>
                    <tr><td colSpan={4} className="pb-1.5 text-[11px] text-ink-3">{ja ? s.why_ja : s.why_en} <span className="text-muted">({s.source_name}{s.verified_by_team ? "" : ja ? "・要確認" : ", to be verified"})</span></td></tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {show("partners") && (
          <Section id="partners" n={num("partners")} title={title("partners")}>
            {!d.partners.length && <p className="text-[13px] text-ink-3"><T mode={mode} en="No partner has been verified yet." ja="検証済みのパートナーはまだありません。" /></p>}
            {d.partners.map((p: any) => {
              const band = BAND[p.band] ?? BAND.insufficient;
              const g = p.ground || {};
              const series = g.buildings?.series ?? [];
              return (
                <div key={p.inv_id} className="mb-8 border-b border-line pb-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[17px] font-bold">{p.name}</div>
                      <div className="font-mono text-[11px] text-muted">CIN {p.company?.cin ?? "—"} · {p.mode.toUpperCase()}{p.illustrative ? ` · ${ja ? "説明用ケース" : "illustrative case"}` : ""}</div>
                    </div>
                    <div className="text-right"><div className="num text-[34px] leading-none" style={{ color: band.color }}>{p.score ?? "—"}</div><div className="text-[12px] font-semibold" style={{ color: band.color }}>{ja ? band.ja : band.en}</div></div>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1.5 text-[11px]">
                    {Object.entries(p.subscores).filter(([, v]) => v != null).map(([k, v]: any) => <div key={k} className="flex justify-between rounded bg-stage px-2 py-1"><span>{ja ? FAMILY[k]?.ja : FAMILY[k]?.en}</span><span className="font-mono">{v}</span></div>)}
                  </div>
                  <p className="mt-3 text-[12.5px] leading-relaxed">{(ja ? p.summary_ja : p.summary_en).replace(/\[(ev_[\d, ev_]+)\]/g, " [$1]")}</p>
                  <h4 className="mt-4 text-[12.5px] font-semibold"><T mode={mode} en="Key findings" ja="主な指摘" /></h4>
                  <ul className="mt-1 space-y-1 text-[12px]">
                    {p.flags.slice(0, 8).map((f: any, i: number) => (
                      <li key={i} className="flex gap-2"><span className="w-14 shrink-0 font-semibold" style={{ color: SEVERITY[f.severity as keyof typeof SEVERITY].color }}>{ja ? SEVERITY[f.severity as keyof typeof SEVERITY].ja : SEVERITY[f.severity as keyof typeof SEVERITY].en}</span><span>{ja ? f.text_ja : f.text_en} <span className="font-mono text-[10px] text-muted">[{f.evidence_ids.join(", ")}]</span></span></li>
                    ))}
                  </ul>
                  {p.claims.length > 0 && (
                    <>
                      <h4 className="mt-4 text-[12.5px] font-semibold"><T mode={mode} en="Claim checks" ja="主張の検証" /></h4>
                      <table className="mt-1 w-full text-[11.5px]"><tbody>{p.claims.map((c: any, i: number) => <tr key={i} className="border-t border-line"><td className="py-1 pr-2">“{c.text}”</td><td className={`pr-2 font-semibold ${c.verdict === "verified" ? "text-verified" : c.verdict === "contradicted" ? "text-hinomaru" : "text-muted"}`}>{c.verdict}</td><td className="font-mono text-[10px] text-muted">{c.evidence_ids.join(", ")}</td></tr>)}</tbody></table>
                    </>
                  )}
                  {g.site && (
                    <div className="avoid-break mt-4 grid grid-cols-[1fr_1fr] gap-4">
                      <div>
                        <h4 className="text-[12.5px] font-semibold"><T mode={mode} en="Ground truth" ja="現地確認" /></h4>
                        <div className="mt-1 grid grid-cols-2 gap-1.5">
                          {g.frames?.[0] && <figure><img src={dataUrl(g.frames[0].path)} alt="" className="aspect-square w-full rounded object-cover" /><figcaption className="text-[10px] text-muted">{g.frames[0].year} · Sentinel-2</figcaption></figure>}
                          {g.current && <figure><img src={dataUrl(g.current.path)} alt="" className="aspect-square w-full rounded object-cover" /><figcaption className="text-[10px] text-muted">{ja ? "現在" : "Today"} · Esri</figcaption></figure>}
                        </div>
                      </div>
                      {series.length > 0 && (
                        <div>
                          <h4 className="text-[12.5px] font-semibold"><T mode={mode} en="Built area (m²)" ja="建築面積（㎡）" /></h4>
                          <BarChart width={300} height={170} data={series} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="#EDEEF1" />
                            <XAxis dataKey="year" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 9 }} />
                            <Bar dataKey="built_area_m2" fill="#141414" isAnimationActive={false} />
                            {g.claimed?.area_m2 && <ReferenceLine y={g.claimed.area_m2} stroke="#E3122B" strokeDasharray="4 3" />}
                          </BarChart>
                          {g.nightlights?.activity_ratio != null && <p className="text-[11px] text-ink-3">{ja ? "夜間光の活動比率" : "Night-light activity ratio"} {g.nightlights.activity_ratio}</p>}
                        </div>
                      )}
                    </div>
                  )}
                  {(p.intel?.certificates ?? []).length > 0 && (
                    <p className="mt-3 text-[12px]"><span className="font-semibold"><T mode={mode} en="Certificate check" ja="認証の確認" />:</span> {p.intel.certificates.map((c: any) => `${c.claim}: ${c.reason}`).join("; ")}</p>
                  )}
                  {p.money?.status === "received" && (
                    <p className="mt-3 text-[12px]"><span className="font-semibold"><T mode={mode} en="Financial data (simulated)" ja="財務データ（シミュレーション）" />:</span> {fmtInr(p.money.declared_12m)} {ja ? "直近12か月の申告売上" : "declared over the last 12 filed months"} vs {fmtInr(p.money.claimed_turnover)} {ja ? "主張" : "claimed"} [{p.money.evidence_id}]</p>
                  )}
                  {p.audit?.status === "completed" && (
                    <p className="mt-2 text-[12px]"><span className="font-semibold"><T mode={mode} en="Field audit" ja="現地監査" />:</span> {p.audit.items.filter((i: any) => i.status === "fail").length} {ja ? "件不合格" : "items failed"}, {p.audit.items.filter((i: any) => i.status === "pass").length} {ja ? "件合格" : "passed"}, {p.audit.items.filter((i: any) => i.status === "unverified").length} {ja ? "件未検証" : "unverified"}</p>
                  )}
                  <p className="mt-3 text-[12.5px]"><span className="font-semibold"><T mode={mode} en="Partner recommendation" ja="パートナーの推奨判断" />:</span> <T mode={mode} en={p.recommendation.en} ja={p.recommendation.ja} /></p>
                </div>
              );
            })}
          </Section>
        )}

        {show("compare") && (
          <Section id="compare" n={num("compare")} title={title("compare")}>
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-muted"><tr><th className="py-1">#</th><th><T mode={mode} en="Partner" ja="候補企業" /></th><th><T mode={mode} en="Score" ja="スコア" /></th><th><T mode={mode} en="Band" ja="判定" /></th><th><T mode={mode} en="Fit" ja="適合度" /></th><th><T mode={mode} en="Flags" ja="指摘" /></th></tr></thead>
              <tbody>{d.partners.map((p: any, i: number) => <tr key={p.inv_id} className="border-t border-line"><td className="py-1.5">{i + 1}</td><td>{p.name}</td><td className="font-semibold">{p.score ?? "—"}</td><td>{ja ? BAND[p.band]?.ja : BAND[p.band]?.en}</td><td>{p.fit ?? "—"}</td><td>{p.flags.length}</td></tr>)}</tbody>
            </table>
            <p className="mt-4 text-[13px]"><span className="font-semibold"><T mode={mode} en="Recommended" ja="推奨" />:</span> <T mode={mode} en={d.decision.en} ja={d.decision.ja} /></p>
          </Section>
        )}

        {show("terms") && (
          <Section id="terms" n={num("terms")} title={title("terms")}>
            {d.partners.slice(0, 2).map((p: any) => (
              <div key={p.inv_id} className="mb-6">
                <div className="text-[14px] font-semibold">{p.name}</div>
                <ol className="mt-2 space-y-2">
                  {p.clauses.clauses.map((c: any, i: number) => (
                    <li key={c.id} className={`avoid-break rounded-lg border p-2.5 text-[12px] ${c.added_because.length ? "border-hinomaru/40 bg-hinomaru-wash/50" : "border-line"}`}>
                      <div className="font-semibold">{i + 1}. {ja ? c.title_ja : c.title_en}</div>
                      <p className="mt-0.5 text-ink-2">{ja ? c.text_ja : c.text_en}</p>
                      {c.added_because.map((b: any) => <p key={b.rule_id} className="mt-1 text-[11px] text-hinomaru">{ja ? "追加理由" : "Added because"}: {ja ? b.text_ja : b.text_en} ({b.rule_id}; {b.evidence_ids.join(", ")})</p>)}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[11px] text-muted">{ja ? p.clauses.disclaimer_ja : p.clauses.disclaimer_en}</p>
              </div>
            ))}
          </Section>
        )}

        {show("growth") && (
          <Section id="growth" n={num("growth")} title={title("growth")}>
            <div className="text-[15px] font-semibold">{ja ? plan.growth.playbook.name_ja : plan.growth.playbook.name_en}</div>
            <table className="mt-3 w-full text-[12px]">
              <thead className="text-left text-muted"><tr><th className="py-1"><T mode={mode} en="Phase" ja="段階" /></th><th><T mode={mode} en="Entry mode" ja="形態" /></th><th><T mode={mode} en="Channel" ja="チャネル" /></th><th>KPI</th><th><T mode={mode} en="Headcount" ja="人員" /></th></tr></thead>
              <tbody>{plan.growth.phases.map((ph: any) => <tr key={ph.when} className="border-t border-line align-top"><td className="py-1.5 pr-2 font-medium">{ph.when}</td><td className="pr-2">{ja ? ph.mode_name_ja : ph.mode_name}</td><td className="pr-2">{ja ? ph.channel_ja : ph.channel_en}</td><td className="pr-2">{ja ? ph.kpi_ja : ph.kpi_en}</td><td>{ph.headcount}</td></tr>)}</tbody>
            </table>
            <h3 className="mt-5 text-[13px] font-semibold"><T mode={mode} en="Growth levers" ja="成長レバー" /></h3>
            <ul className="mt-1 text-[12px] text-ink-2">{plan.growth.levers.map((l: any) => <li key={l.id}>· <span className="font-medium">{ja ? l.name_ja : l.name_en}</span>: {ja ? l.text_ja : l.text_en}</li>)}</ul>
            <p className="mt-3 rounded border border-line bg-wash px-3 py-2 text-[11px] text-ink-3"><T mode={mode} en="Scenario figures are an illustrative model built from the user's own assumptions (price, volume, margin, fixed costs); see the Advisor for the interactive version." ja="シナリオの数値は、利用者が入力した前提（単価・数量・粗利率・固定費）に基づく試算モデルです。対話型の試算はアドバイザー画面をご覧ください。" /></p>
          </Section>
        )}

        {show("contacts") && (
          <Section id="contacts" n={num("contacts")} title={title("contacts")}>
            <table className="w-full text-[12px]">
              <tbody>{plan.contacts.map((c: any) => <tr key={c.id} className="border-t border-line"><td className="py-1.5 pr-2 font-medium">{ja ? c.name_ja : c.name}</td><td className="pr-2 text-ink-2">{c.channel}</td><td className="font-mono text-[10.5px] text-muted">{c.source_url.replace(/^https?:\/\//, "")}</td></tr>)}</tbody>
            </table>
            <h3 className="mt-6 text-[13px] font-semibold"><T mode={mode} en="Next steps: 30 / 60 / 90 days" ja="次のステップ：30・60・90日" /></h3>
            <ol className="mt-2 space-y-1.5 text-[12.5px]">{d.next_steps.map((s: any, i: number) => <li key={i} className="flex gap-3"><span className="w-14 shrink-0 font-mono text-[11px] text-hinomaru">Day {s.when}</span><T mode={mode} en={s.en} ja={s.ja} /></li>)}</ol>
          </Section>
        )}

        {show("method") && (
          <Section id="method" n={num("method")} title={title("method")}>
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              <T mode={mode} en="Partner scores come from a deterministic rulebook: each rule names its evidence, deductions are capped per family, and any critical finding caps the overall score at 39. Language models extract claims and write prose from cited data only; they never decide flags, scores or recommendations. Advice draws only on the cited knowledge base and public datasets listed below."
                ja="パートナーのスコアは決定論的なルールブックに基づきます。各ルールは根拠となる証拠を示し、減点は項目ごとに上限があり、重大な指摘がある場合は総合スコアの上限を39とします。言語モデルは出典付きデータからの抽出と文章作成のみを行い、指摘・スコア・推奨判断は行いません。助言は下記の出典付きナレッジベースと公開データのみに基づきます。" />
            </p>
            <h3 className="mt-4 text-[13px] font-semibold"><T mode={mode} en="Rulebook" ja="ルールブック" /></h3>
            <div className="mt-1 columns-2 gap-6 text-[10.5px]">{d.methodology.rules.map((r: any) => <div key={r.id} className="break-inside-avoid font-mono">{r.id} · {r.family} · {r.severity} · −{r.deduction}</div>)}</div>
            <h3 className="mt-4 text-[13px] font-semibold"><T mode={mode} en="Model card: distress model" ja="モデルカード：経営悪化モデル" /></h3>
            <p className="mt-1 text-[12px] text-ink-2">{d.methodology.model_card.trained
              ? `${d.methodology.model_card.model} v${d.methodology.model_card.version} · ${d.methodology.model_card.n_rows} records · ROC-AUC ${d.methodology.model_card.roc_auc} · PR-AUC ${d.methodology.model_card.pr_auc} · Brier ${d.methodology.model_card.brier}`
              : (ja ? "未学習（実データでの学習後に指標を掲載）" : "Not yet trained; metrics are published once it is trained on real MCA records.")}</p>
            <h3 className="mt-4 text-[13px] font-semibold"><T mode={mode} en="Sources" ja="出典" /></h3>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[10.5px] text-ink-2">
              {d.methodology.sources.map((s: any) => <li key={s.url}>{s.name} · {s.url} · {s.as_of}{s.verified ? "" : ja ? "（要確認）" : " (to be verified)"}</li>)}
            </ol>
            <p className="mt-4 text-[11px] text-ink-3"><T mode={mode} en="Limitations: satellites show structures, not operations; registry data can lag; absence of a record is not proof of good standing. Illustrative cases and simulated data are labelled where they appear." ja="制約：衛星が示すのは構造物であり操業の有無ではありません。登記データには遅れが生じ得ます。記録がないことは健全性の証明ではありません。説明用ケースおよびシミュレーションデータは該当箇所に表示しています。" /></p>
          </Section>
        )}
      </div>
    </div>
  );
}
