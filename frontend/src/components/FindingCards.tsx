import { motion } from "framer-motion";
import { CircleCheck, CircleHelp, CircleX } from "lucide-react";
import { useI18n } from "../i18n";
import type { ClaimT, FlagT, Signal } from "../lib/api";
import { FAMILY, SEVERITY } from "../lib/visual";

export function EvidenceChips({ ids, onEvidence }: { ids: string[]; onEvidence?: (ev: string) => void }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {ids.map((id) => (
        <button key={id} onClick={() => onEvidence?.(id)}
          className="rounded border border-line bg-paper px-1.5 py-[1px] font-mono text-[10px] text-ink-2 hover:border-hinomaru hover:text-hinomaru">
          {id}
        </button>
      ))}
    </div>
  );
}

export function FlagCard({ flag, onEvidence, animate = true }: { flag: FlagT; onEvidence?: (ev: string) => void; animate?: boolean }) {
  const { lang, pick } = useI18n();
  const sev = SEVERITY[flag.severity];
  const fam = FAMILY[flag.family];
  return (
    <motion.div layout initial={animate ? { opacity: 0, x: 28, scale: 0.98 } : false} animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="relative overflow-hidden rounded-lg border border-line bg-paper py-2.5 pl-4 pr-3 shadow-card avoid-break">
      <span className="absolute inset-y-0 left-0 w-[4px]" style={{ background: sev.color }} />
      <div className="flex items-center gap-1.5">
        <span className="chip" style={{ background: sev.soft, color: sev.color }}>{lang === "ja" ? sev.ja : sev.en}</span>
        <span className="text-[11px] text-muted">{lang === "ja" ? fam?.ja : fam?.en}</span>
        {flag.approximate && <span className="chip bg-amber-soft text-amber">{lang === "ja" ? "概略位置" : "approx. pin"}</span>}
        <span className="ml-auto font-mono text-[10px] text-muted">−{flag.deduction}</span>
      </div>
      <p className={`mt-1 text-[13px] leading-snug text-ink ${lang === "ja" ? "jp" : ""}`}>{pick(flag.text_ja, flag.text_en)}</p>
      <div className="mt-0.5 font-mono text-[10px] text-muted">{flag.rule_id}</div>
      <EvidenceChips ids={flag.evidence_ids} onEvidence={onEvidence} />
    </motion.div>
  );
}

const VERDICT = {
  verified: { icon: CircleCheck, color: "#15803D", ja: "確認済み", en: "Verified" },
  contradicted: { icon: CircleX, color: "#E3122B", ja: "矛盾", en: "Contradicted" },
  unverifiable: { icon: CircleHelp, color: "#7A808C", ja: "確認不能", en: "Unverifiable" },
  pending: { icon: CircleHelp, color: "#7A808C", ja: "確認中", en: "Pending" },
} as const;

export function VerdictBadge({ verdict }: { verdict: ClaimT["verdict"] }) {
  const { lang } = useI18n();
  const v = VERDICT[verdict] ?? VERDICT.pending;
  const Icon = v.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: v.color }}>
      <Icon size={15} strokeWidth={2.4} /> {lang === "ja" ? v.ja : v.en}
    </span>
  );
}

export function ClaimCard({ claim, onEvidence, animate = true }: { claim: ClaimT; onEvidence?: (ev: string) => void; animate?: boolean }) {
  const { lang, pick } = useI18n();
  return (
    <motion.div layout initial={animate ? { opacity: 0, x: 28 } : false} animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="rounded-lg border border-line bg-paper px-3 py-2.5 shadow-card avoid-break">
      <div className="flex items-center justify-between gap-2">
        <VerdictBadge verdict={claim.verdict} />
        <span className="font-mono text-[10px] text-muted">{claim.field}</span>
      </div>
      <p className="mt-1 text-[13px] font-medium leading-snug text-ink">“{claim.text}”</p>
      <p className={`mt-1 text-[12px] leading-snug text-ink-3 ${lang === "ja" ? "jp" : ""}`}>{pick(claim.explanation_ja, claim.explanation_en)}</p>
      {claim.evidence_ids.length > 0 && <EvidenceChips ids={claim.evidence_ids} onEvidence={onEvidence} />}
    </motion.div>
  );
}

export function SignalCard({ s, onEvidence }: { s: Signal; onEvidence?: (ev: string) => void }) {
  const { lang, pick } = useI18n();
  const color = s.level === "high" ? "#E3122B" : s.level === "med" ? "#D97706" : "#5C616C";
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-wash px-3 py-2.5 avoid-break">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} /> {lang === "ja" ? "兆候" : "Signal"} · {s.id.replace(/_/g, " ").toLowerCase()}
      </div>
      <p className={`mt-1 text-[12.5px] leading-snug text-ink ${lang === "ja" ? "jp" : ""}`}>{pick(s.text_ja, s.text_en)}</p>
      <EvidenceChips ids={s.evidence_ids} onEvidence={onEvidence} />
    </div>
  );
}
