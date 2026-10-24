import { FileDown, Loader2, Printer } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { LangToggle } from "../components/Shell";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { FAMILY, SEVERITY } from "../lib/visual";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="border-b border-ink/70 align-top">
      <th className="w-[124px] border-r border-ink/70 bg-wash px-3 py-3 text-left text-[13px] font-bold">{label}</th>
      <td className="px-4 py-3 text-[13px] leading-[1.85]">{children}</td>
    </tr>
  );
}

const LABELS = {
  ja: { title: "稟議書", drafter: "起案者", date: "起案日", subject: "件名", purpose: "目的", overview: "概要", findings: "調査結果",
        score: "信頼スコア", measures: "リスクと対策", decision: "推奨判断", attachments: "添付資料", back: "← レポートに戻る", print: "印刷",
        simulated: "※ 資金データはハッカソン用のシミュレーションです。", rule: "（判断はShinraiのルールエンジンによる。LLMは関与しない）",
        stamps: ["担当", "課長", "部長", "社長"],
        footer: (id: number) => `本書はShinraiの信用調査レポート #${id} に基づき作成されました。Shinraiはデューデリジェンスの補助ツールであり、法的意見ではありません。各指摘は添付資料の証拠IDに対応しています。` },
  en: { title: "Ringi-sho", drafter: "Drafted by", date: "Date", subject: "Subject", purpose: "Purpose", overview: "Overview", findings: "Findings",
        score: "Trust score", measures: "Risks and measures", decision: "Recommendation", attachments: "Attachments", back: "← Back to report", print: "Print",
        simulated: "Note: financial data is simulated for the hackathon.", rule: "(Decided by Shinrai's rule engine; the LLM plays no part.)",
        stamps: ["Staff", "Section mgr", "Dept head", "President"],
        footer: (id: number) => `Prepared from Shinrai due-diligence report #${id}. Shinrai is a due-diligence aid, not a legal opinion. Each finding cites its evidence ID in the attachments.` },
};

/** 稟議書: the internal approval document Japanese companies use, in its standard layout. A4 portrait for print. */
export default function Ringi() {
  const { id } = useParams();
  const invId = Number(id);
  const [params] = useSearchParams();
  const print = params.get("print") === "1";
  const { lang } = useI18n();
  const L = LABELS[lang];
  const ja = lang === "ja";
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.ringi(invId).then(setD);
  }, [invId]);

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/investigations/${invId}/ringi.pdf?lang=${lang}`);
      if (!res.ok) throw new Error();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await res.blob());
      a.download = `ringi_${invId}.pdf`;
      a.click();
    } catch {
      window.print();
    } finally {
      setBusy(false);
    }
  };

  if (!d) return <div className="grid h-screen place-items-center"><Loader2 className="animate-spin text-muted" /></div>;
  const rec = d.recommendation;
  const recColor = rec.id === "decline" ? "#E3122B" : rec.id === "approve" ? "#15803D" : "#D97706";

  return (
    <div className={`min-h-screen bg-stage py-8 print:bg-white print:py-0 ${ja ? "jp" : ""}`}>
      <style>{`@media print { @page { size: A4 portrait; margin: 12mm; } }`}</style>
      {!print && (
        <div className="no-print mx-auto mb-5 flex max-w-[820px] items-center justify-between px-4">
          <Link to={`/report/${invId}`} className="text-[13px] text-ink-2 hover:text-hinomaru">{L.back}</Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <button className="btn-ghost" onClick={() => window.print()}><Printer size={15} /> {L.print}</button>
            <button className="btn-red" onClick={download} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} PDF</button>
          </div>
        </div>
      )}
      <article data-print-ready="true" className="mx-auto max-w-[820px] bg-paper px-12 py-12 shadow-lift print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[12px] text-ink-3">{ja ? d.company_ja : d.company_en}</div>
            <h1 className={`mt-1 text-[30px] font-bold ${ja ? "tracking-[0.4em]" : "tracking-tight"}`}>{L.title}</h1>
            {!ja && <div className="text-[12px] text-ink-3"><span className="jp">稟議書</span> · internal approval request</div>}
            {d.is_demo && <div className="mt-1 inline-block rounded bg-stage px-2 py-0.5 text-[10px] font-medium text-ink-3 ring-1 ring-line">{ja ? "説明用ケース" : "Illustrative case"}</div>}
          </div>
          <table className="border-collapse text-center text-[11px]" aria-label="Approval stamps">
            <tbody>
              <tr>{L.stamps.map((s) => <th key={s} className="w-[74px] border border-ink px-1 py-1 font-medium">{s}</th>)}</tr>
              <tr>{L.stamps.map((s) => <td key={s} className="h-[70px] border border-ink" />)}</tr>
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-between text-[12.5px]">
          <span>{L.drafter}: {ja ? d.drafter : "Overseas Business Dept."}</span>
          <span>{L.date}: {d.date}</span>
        </div>
        <table className="mt-3 w-full border-collapse border-y-2 border-ink">
          <tbody>
            <Row label={L.subject}><span className="font-bold">{ja ? d.subject : d.subject_en}</span></Row>
            <Row label={L.purpose}>{ja ? d.purpose : d.purpose_en}</Row>
            <Row label={L.overview}>{(ja ? d.overview : d.overview_en).map((o: string, i: number) => <p key={i}>{o}</p>)}</Row>
            <Row label={L.findings}>
              <div className="flex items-baseline gap-3">
                <span>{L.score}</span><span className="num text-[34px] leading-none">{d.score ?? "—"}</span><span className="text-ink-3">/ 100</span>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-x-3 text-[12px]">
                {Object.entries(d.subscores).filter(([, v]) => v != null).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-line"><span>{ja ? FAMILY[k]?.ja : FAMILY[k]?.en ?? k}</span><span className="font-mono">{v as number}</span></div>
                ))}
              </div>
              <ul className="mt-3 space-y-1">
                {d.findings.map((f: any, i: number) => {
                  const sev = SEVERITY[f.severity as keyof typeof SEVERITY];
                  return (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 font-bold" style={{ color: sev.color }}>{ja ? `【${sev.ja}】` : `[${sev.en}]`}</span>
                      <span>{ja ? f.text_ja : f.text_en}<span className="ml-1 font-mono text-[10px] text-ink-3">[{f.evidence_ids.join(", ")}]</span></span>
                    </li>
                  );
                })}
              </ul>
              {d.money_simulated && <p className="mt-2 text-[11px] text-amber">{L.simulated}</p>}
            </Row>
            <Row label={L.measures}>
              <ol className="list-decimal space-y-1 pl-5">{d.measures.map((m: any, i: number) => <li key={i}>{ja ? m.ja : m.en}</li>)}</ol>
            </Row>
            <Row label={L.decision}>
              <div className="flex items-center gap-4">
                <span className="whitespace-nowrap rounded-md border-2 px-4 py-1.5 text-[20px] font-bold" style={{ borderColor: recColor, color: recColor }}>
                  {ja ? rec.ja : rec.en}
                  {!ja && <span className="jp ml-2 text-[13px]">{rec.ja}</span>}
                </span>
                <span className="text-[12.5px]">{ja ? rec.reason_ja : rec.reason_en}<br /><span className="text-[11px] text-ink-3">{L.rule}</span></span>
              </div>
            </Row>
            <Row label={L.attachments}>
              <div className="columns-2 gap-6 text-[11px] leading-[1.6]">
                {d.attachments.map((a: any) => (
                  <div key={a.ev_id} className="break-inside-avoid"><span className="font-mono">{a.ev_id}</span> {a.source} ({a.mode.toUpperCase()}): {a.summary}</div>
                ))}
              </div>
            </Row>
          </tbody>
        </table>
        <p className="mt-6 text-[10.5px] leading-relaxed text-ink-3">{L.footer(invId)}</p>
      </article>
    </div>
  );
}
