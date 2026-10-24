import { FileDown, FileText, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { api } from "../lib/api";

interface Clause {
  id: string;
  title_en: string;
  title_ja: string;
  text_en: string;
  text_ja: string;
  law: string;
  source_url: string;
  as_of: string;
  base: boolean;
  added_because: { rule_id: string; text_en: string; text_ja: string; evidence_ids: string[] }[];
}

/** Base clauses for the partner type plus risk-driven clauses tied to this partner's Verify flags. */
export default function TermSheet({ invId, onEvidence, compact = false, printable = false }: { invId: number; onEvidence?: (ev: string) => void; compact?: boolean; printable?: boolean }) {
  const { lang } = useI18n();
  const ja = lang === "ja";
  const [pack, setPack] = useState<any>(null);
  useEffect(() => {
    api.clauses(invId).then(setPack);
  }, [invId]);
  if (!pack) return <div className="h-32 animate-pulse rounded-xl bg-stage" />;
  const clauses: Clause[] = pack.clauses;
  const risk = clauses.filter((c) => c.added_because.length);
  const base = clauses.filter((c) => !c.added_because.length);
  const row = (c: Clause, i: number) => (
    <div key={c.id} className={`rounded-xl border p-4 avoid-break ${c.added_because.length ? "border-hinomaru/30 bg-hinomaru-wash/60" : "border-line bg-paper"}`}>
      <div className="flex items-baseline gap-3">
        <span className="num text-[18px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <div className="jp text-[14px] font-semibold">{ja ? c.title_ja : c.title_en}</div>
          <p className={`mt-1 text-[13px] leading-relaxed text-ink-2 ${ja ? "jp" : ""}`}>{ja ? c.text_ja : c.text_en}</p>
          {c.added_because.map((b) => (
            <div key={b.rule_id} className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px]">
              <span className="inline-flex items-center gap-1 rounded-md bg-hinomaru px-2 py-0.5 font-semibold text-white"><Link2 size={11} /> {ja ? "追加理由" : "Added because"}</span>
              <span className={`text-ink-2 ${ja ? "jp" : ""}`}>{ja ? b.text_ja : b.text_en}</span>
              <span className="font-mono text-[10px] text-muted">{b.rule_id}</span>
              {b.evidence_ids.map((e) => (
                <button key={e} onClick={() => onEvidence?.(e)} className="rounded border border-line bg-paper px-1 font-mono text-[10px] text-ink-2 hover:text-hinomaru">{e}</button>
              ))}
            </div>
          ))}
          <div className="mt-2 text-[10.5px] text-muted">{c.law}</div>
        </div>
      </div>
    </div>
  );
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-[13px] text-ink-2 ${ja ? "jp" : ""}`}>
          {ja ? `基本条項${base.length}件に加え、この相手の検証結果から${risk.length}件のリスク対応条項を追加しました。`
            : `${base.length} base clauses for a ${pack.partner_type.replace("_", " ")} agreement, plus ${risk.length} risk-driven clauses added from this partner's Verify findings.`}
        </p>
        {!printable && (
          <div className="no-print flex gap-2">
            <Link to={`/termsheet/${invId}`} className="btn-ghost text-xs"><FileText size={14} /> {ja ? "契約条件書を開く" : "Open term sheet"}</Link>
            <a href={`/api/investigations/${invId}/termsheet.docx?lang=${lang}`} className="btn-ghost text-xs"><FileDown size={14} /> DOCX</a>
          </div>
        )}
      </div>
      {risk.length > 0 && (
        <>
          <div className="label mt-5">{ja ? "リスク対応条項（検証結果に連動）" : "Risk-driven clauses (linked to Verify)"}</div>
          <div className="mt-2 space-y-2.5">{risk.map(row)}</div>
        </>
      )}
      {!compact && (
        <>
          <div className="label mt-6">{ja ? "基本条項" : "Base clauses"}</div>
          <div className="mt-2 space-y-2.5">{base.map((c, i) => row(c, i + risk.length))}</div>
        </>
      )}
      <p className="mt-4 rounded-lg border border-line bg-wash px-3 py-2 text-[11.5px] text-ink-3">{ja ? pack.disclaimer_ja : pack.disclaimer_en}</p>
    </div>
  );
}
