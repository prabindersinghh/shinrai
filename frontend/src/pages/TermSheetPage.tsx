import { FileDown, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { LangToggle } from "../components/Shell";
import TermSheet from "../components/TermSheet";
import { useI18n } from "../i18n";
import { api } from "../lib/api";

export default function TermSheetPage() {
  const { id } = useParams();
  const invId = Number(id);
  const [params] = useSearchParams();
  const print = params.get("print") === "1";
  const { lang } = useI18n();
  const ja = lang === "ja";
  const [co, setCo] = useState<any>(null);
  useEffect(() => {
    api.clauses(invId).then((p) => setCo({ ...p.company, is_demo: p.is_demo }));
  }, [invId]);
  return (
    <div className="min-h-screen bg-stage py-8 print:bg-white print:py-0">
      {!print && (
        <div className="no-print mx-auto mb-5 flex max-w-[860px] items-center justify-between px-4">
          <Link to={`/report/${invId}`} className="text-[13px] text-ink-2 hover:text-hinomaru">{ja ? "← レポートに戻る" : "← Back to report"}</Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <button className="btn-ghost" onClick={() => window.print()}><Printer size={15} /> {ja ? "印刷" : "Print"}</button>
            <a className="btn-red" href={`/api/investigations/${invId}/termsheet.docx?lang=${lang}`}><FileDown size={15} /> DOCX</a>
          </div>
        </div>
      )}
      <article data-print-ready={co ? "true" : "false"} className="mx-auto max-w-[860px] bg-paper px-12 py-12 shadow-lift print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-ink pb-5">
          <div>
            <div className="label">{ja ? "契約条件書（タームシート）" : "Partner term sheet"}</div>
            <h1 className="mt-1 text-[26px] font-bold tracking-tight">{co?.name ?? "…"}</h1>
            <div className="mt-1 font-mono text-[12px] text-muted">CIN {co?.cin ?? "—"}</div>
          </div>
          {co?.is_demo && <span className="chip bg-stage text-ink-3 ring-1 ring-line">{ja ? "説明用ケース" : "Illustrative case"}</span>}
        </div>
        <div className="mt-6"><TermSheet invId={invId} printable /></div>
      </article>
    </div>
  );
}
