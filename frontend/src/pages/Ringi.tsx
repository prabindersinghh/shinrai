import { FileDown, Loader2, Printer } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { FAMILY, SEVERITY } from "../lib/visual";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="border-b border-ink/70 align-top">
      <th className="w-[112px] border-r border-ink/70 bg-wash px-3 py-3 text-left text-[13px] font-bold">{label}</th>
      <td className="px-4 py-3 text-[13px] leading-[1.85]">{children}</td>
    </tr>
  );
}

/** 稟議書: the internal approval document, in standard Japanese layout. A4 portrait for print. */
export default function Ringi() {
  const { id } = useParams();
  const invId = Number(id);
  const [params] = useSearchParams();
  const print = params.get("print") === "1";
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.ringi(invId).then(setD);
  }, [invId]);

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/investigations/${invId}/ringi.pdf`);
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
    <div className="jp min-h-screen bg-stage py-8 print:bg-white print:py-0">
      <style>{`@media print { @page { size: A4 portrait; margin: 12mm; } }`}</style>
      {!print && (
        <div className="no-print mx-auto mb-5 flex max-w-[820px] items-center justify-between px-4">
          <Link to={`/report/${invId}`} className="text-[13px] text-ink-2 hover:text-hinomaru">← レポートに戻る / Back to report</Link>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => window.print()}><Printer size={15} /> 印刷</button>
            <button className="btn-red" onClick={download} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} PDF</button>
          </div>
        </div>
      )}
      <article data-print-ready="true" className="mx-auto max-w-[820px] bg-paper px-12 py-12 shadow-lift print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[12px] text-ink-3">{d.company_ja}</div>
            <h1 className="mt-1 text-[30px] font-bold tracking-[0.4em]">稟議書</h1>
            {d.is_demo && <div className="mt-1 inline-block rounded bg-hinomaru px-2 py-0.5 text-[10px] font-bold text-white">DEMO DATA</div>}
          </div>
          <table className="border-collapse text-center text-[11px]" aria-label="承認印">
            <tbody>
              <tr>{d.stamps.map((s: string) => <th key={s} className="w-[70px] border border-ink px-1 py-1 font-medium">{s}</th>)}</tr>
              <tr>{d.stamps.map((s: string) => <td key={s} className="h-[70px] border border-ink" />)}</tr>
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-between text-[12.5px]">
          <span>起案者：{d.drafter}</span>
          <span>起案日：{d.date}</span>
        </div>
        <table className="mt-3 w-full border-collapse border-y-2 border-ink">
          <tbody>
            <Row label="件名"><span className="font-bold">{d.subject}</span></Row>
            <Row label="目的">{d.purpose}</Row>
            <Row label="概要">{d.overview.map((o: string, i: number) => <p key={i}>{o}</p>)}</Row>
            <Row label="調査結果">
              <div className="flex items-baseline gap-3">
                <span>信頼スコア</span><span className="num text-[34px] leading-none">{d.score}</span><span className="text-ink-3">/ 100</span>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-x-3 text-[12px]">
                {Object.entries(d.subscores).filter(([, v]) => v != null).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-line"><span>{FAMILY[k]?.ja ?? k}</span><span className="font-mono">{v as number}</span></div>
                ))}
              </div>
              <ul className="mt-3 space-y-1">
                {d.findings.map((f: any, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 font-bold" style={{ color: SEVERITY[f.severity as keyof typeof SEVERITY].color }}>【{SEVERITY[f.severity as keyof typeof SEVERITY].ja}】</span>
                    <span>{f.text_ja}<span className="ml-1 font-mono text-[10px] text-ink-3">[{f.evidence_ids.join(", ")}]</span></span>
                  </li>
                ))}
              </ul>
              {d.money_simulated && <p className="mt-2 text-[11px] text-amber">※ 資金データはハッカソン用のシミュレーションです。</p>}
            </Row>
            <Row label="リスクと対策">
              <ol className="list-decimal space-y-1 pl-5">{d.measures.map((m: any, i: number) => <li key={i}>{m.ja}</li>)}</ol>
            </Row>
            <Row label="推奨判断">
              <div className="flex items-center gap-4">
                <span className="rounded-md border-2 px-4 py-1.5 text-[20px] font-bold" style={{ borderColor: recColor, color: recColor }}>{rec.ja}</span>
                <span className="text-[12.5px]">{rec.reason_ja}<br /><span className="text-[11px] text-ink-3">（判断はShinraiのルールエンジンによる。LLMは関与しない）</span></span>
              </div>
            </Row>
            <Row label="添付資料">
              <div className="columns-2 gap-6 text-[11px] leading-[1.6]">
                {d.attachments.map((a: any) => (
                  <div key={a.ev_id} className="break-inside-avoid"><span className="font-mono">{a.ev_id}</span> {a.source}（{a.mode.toUpperCase()}）：{a.summary}</div>
                ))}
              </div>
            </Row>
          </tbody>
        </table>
        <p className="mt-6 text-[10.5px] leading-relaxed text-ink-3">
          本書はShinraiの信用調査レポート #{invId} に基づき作成されました。Shinraiはデューデリジェンスの補助ツールであり、法的意見ではありません。各指摘は添付資料の証拠IDに対応しています。
        </p>
      </article>
    </div>
  );
}
