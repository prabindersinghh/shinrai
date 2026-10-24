import { ChevronDown, CircleAlert } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../i18n";
import { SourceChip } from "./Cited";

export interface Step {
  id: string;
  name: string;
  name_ja: string;
  authority: string;
  form: string;
  trigger: string;
  deadline: string;
  start: number;
  days: number;
  owner: string;
  why_en: string;
  why_ja: string;
  docs: string[];
  critical?: boolean;
  source_name: string;
  source_url: string;
  as_of: string;
  verified_by_team: boolean;
  status: "not_started" | "in_progress" | "done";
}

const STATUS = {
  not_started: { en: "Not started", ja: "未着手", cls: "bg-stage text-ink-2", bar: "#C9CCD3" },
  in_progress: { en: "In progress", ja: "対応中", cls: "bg-amber-soft text-amber", bar: "#D97706" },
  done: { en: "Done", ja: "完了", cls: "bg-verified-soft text-verified", bar: "#15803D" },
} as const;
const NEXT = { not_started: "in_progress", in_progress: "done", done: "not_started" } as const;
const SPAN = 180;

export default function ComplianceGantt({ steps, onStatus }: { steps: Step[]; onStatus: (id: string, s: Step["status"]) => void }) {
  const { lang } = useI18n();
  const ja = lang === "ja";
  const [open, setOpen] = useState<string | null>(null);
  const done = steps.filter((s) => s.status === "done").length;
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-[minmax(240px,1.1fr)_2fr] border-b border-line bg-wash text-[11px] text-muted">
        <div className="px-4 py-2">{ja ? "手続き" : "Step"} · {done}/{steps.length} {ja ? "完了" : "done"}</div>
        <div className="relative h-8">
          {[0, 30, 60, 90, 120, 150, 180].map((d) => (
            <span key={d} className="absolute top-2 -translate-x-1/2 font-mono" style={{ left: `${(d / SPAN) * 100}%` }}>
              {d === 0 ? "Day 0" : d}
            </span>
          ))}
        </div>
      </div>
      {steps.map((s) => {
        const st = STATUS[s.status];
        const left = (s.start / SPAN) * 100;
        const width = Math.max(2.5, (Math.min(s.days, SPAN - s.start) / SPAN) * 100);
        const isOpen = open === s.id;
        return (
          <div key={s.id} className="border-b border-line last:border-0">
            <div className="grid grid-cols-[minmax(240px,1.1fr)_2fr] items-center hover:bg-wash">
              <button className="flex min-w-0 items-center gap-2 px-4 py-2.5 text-left" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
                <ChevronDown size={14} className={`shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                    {s.critical && <CircleAlert size={13} className="shrink-0 text-hinomaru" />}
                    <span className="truncate">{ja ? s.name_ja : s.name}</span>
                  </div>
                  <div className="truncate text-[11px] text-muted">{s.authority} · {s.form}</div>
                </div>
              </button>
              <div className="relative h-10 border-l border-line">
                {[30, 60, 90, 120, 150].map((d) => <span key={d} className="absolute inset-y-0 w-px bg-line/70" style={{ left: `${(d / SPAN) * 100}%` }} />)}
                <div className={`absolute top-2.5 h-5 rounded-md ${s.critical ? "ring-2 ring-hinomaru/50" : ""}`}
                  style={{ left: `${left}%`, width: `${width}%`, background: st.bar }} />
                <div className="absolute top-2.5 flex h-5 items-center gap-1.5 whitespace-nowrap pl-2 text-[10.5px] text-ink-2"
                  style={{ left: `${Math.min(left + width, 72)}%` }}>
                  <span className="font-medium">{s.deadline}</span>
                  <span className="rounded bg-stage px-1 text-[10px]">{s.owner}</span>
                  <button onClick={() => onStatus(s.id, NEXT[s.status])} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                    {ja ? st.ja : st.en}
                  </button>
                </div>
              </div>
            </div>
            {isOpen && (
              <div className="grid gap-4 bg-wash px-10 py-4 text-[12.5px] md:grid-cols-[1.4fr_1fr]">
                <div>
                  <div className="label">{ja ? "なぜ重要か" : "Why it matters"}</div>
                  <p className={`mt-1 leading-relaxed text-ink-2 ${ja ? "jp" : ""}`}>{ja ? s.why_ja : s.why_en}</p>
                  <div className="label mt-3">{ja ? "きっかけ・期限" : "Trigger and deadline"}</div>
                  <p className="mt-1 text-ink-2">{s.trigger} · <span className="font-semibold">{s.deadline}</span></p>
                </div>
                <div>
                  <div className="label">{ja ? "準備する書類" : "What to prepare"}</div>
                  <ul className="mt-1 list-disc pl-4 text-ink-2">{s.docs.map((d) => <li key={d}>{d}</li>)}</ul>
                  <div className="mt-3"><SourceChip url={s.source_url} asOf={s.as_of} verified={s.verified_by_team} label={s.source_name} /></div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
