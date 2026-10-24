import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { useI18n } from "../i18n";
import { api, type FlagT, type Subscores } from "../lib/api";
import { FAMILY, RADAR_FAMILIES, SEVERITY } from "../lib/visual";
import { EvidenceChips } from "./FindingCards";

export function Section({ id, title, kicker, children, right }: { id?: string; title: ReactNode; kicker?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line py-10 avoid-break">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          {kicker && <div className="label mb-1">{kicker}</div>}
          <h2 className="jp text-[22px] font-bold tracking-tight">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Renders narrative text with [ev_x] citations as clickable evidence chips. */
export function CitedText({ text, onEvidence, ja }: { text: string; onEvidence: (ev: string) => void; ja?: boolean }) {
  const parts = text.split(/(\[ev_\d+(?:\s*,\s*ev_\d+)*\])/g);
  return (
    <p className={`text-[15px] leading-[1.9] text-ink ${ja ? "jp" : ""}`}>
      {parts.map((p, i) => {
        const m = p.match(/^\[(.+)\]$/);
        if (!m) return <span key={i}>{p}</span>;
        return (
          <span key={i} className="mx-0.5 inline-flex gap-0.5 align-[2px]">
            {m[1].split(",").map((e) => e.trim()).map((e) => (
              <button key={e} onClick={() => onEvidence(e)} className="rounded bg-stage px-1 font-mono text-[10px] text-ink-2 ring-1 ring-line hover:text-hinomaru hover:ring-hinomaru">{e}</button>
            ))}
          </span>
        );
      })}
    </p>
  );
}

export function SubscoreRadar({ subscores }: { subscores: Subscores }) {
  const { lang } = useI18n();
  const data = RADAR_FAMILIES.map((f) => ({ family: lang === "ja" ? FAMILY[f].ja : FAMILY[f].en, value: subscores[f] ?? 0, checked: subscores[f] != null }));
  return (
    <div className="h-[280px]">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="74%">
          <PolarGrid stroke="#E4E5E9" />
          <PolarAngleAxis dataKey="family" tick={{ fontSize: 11, fill: "#3A3D45", fontFamily: "Noto Sans JP" }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="value" stroke="#E3122B" fill="#E3122B" fillOpacity={0.14} strokeWidth={2} dot={{ r: 3, fill: "#E3122B" }} isAnimationActive />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SubscoreBars({ subscores, deductions }: { subscores: Subscores; deductions?: Record<string, number> }) {
  const { lang } = useI18n();
  const fams = [...RADAR_FAMILIES, "money", "audit"].filter((f) => f in subscores);
  return (
    <div className="space-y-2.5">
      {fams.map((f) => {
        const v = subscores[f];
        const color = v == null ? "#C9CCD3" : v >= 80 ? "#15803D" : v >= 50 ? "#D97706" : "#E3122B";
        return (
          <div key={f}>
            <div className="flex items-baseline justify-between text-[12.5px]">
              <span className="jp font-medium">{lang === "ja" ? FAMILY[f].ja : FAMILY[f].en} <span className="text-[11px] font-normal text-muted">{lang === "ja" ? FAMILY[f].en : FAMILY[f].ja}</span></span>
              <span className="num text-[18px] leading-none" style={{ color }}>{v ?? (lang === "ja" ? "未確認" : "not checked")}{deductions?.[f] ? <span className="ml-1 font-mono text-[10px] text-muted">−{deductions[f]}</span> : null}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-line"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${v ?? 0}%`, background: color }} /></div>
          </div>
        );
      })}
    </div>
  );
}

export function FlagRow({ flag, onEvidence, invId }: { flag: FlagT; onEvidence: (ev: string) => void; invId: number }) {
  const { lang, pick } = useI18n();
  const [open, setOpen] = useState(false);
  const [payloads, setPayloads] = useState<any[] | null>(null);
  const sev = SEVERITY[flag.severity];
  useEffect(() => {
    if (open && !payloads) Promise.all(flag.evidence_ids.slice(0, 3).map((e) => api.evidence(invId, e))).then(setPayloads);
  }, [open, payloads, flag.evidence_ids, invId]);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper avoid-break">
      <button className="flex w-full items-start gap-4 p-4 text-left hover:bg-wash" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="mt-0.5 w-[62px] shrink-0 rounded-md py-1 text-center text-[11px] font-bold" style={{ background: sev.soft, color: sev.color }}>{lang === "ja" ? sev.ja : sev.en}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-[14px] leading-snug ${lang === "ja" ? "jp" : ""}`}>{pick(flag.text_ja, flag.text_en)}</p>
          <p className={`mt-0.5 text-[12px] text-muted ${lang === "ja" ? "" : "jp"}`}>{lang === "ja" ? flag.text_en : flag.text_ja}</p>
          <div className="mt-1.5 flex items-center gap-3 font-mono text-[10.5px] text-muted">
            <span>{flag.rule_id}</span><span>{lang === "ja" ? FAMILY[flag.family]?.ja : FAMILY[flag.family]?.en}</span><span>−{flag.deduction}</span>
            {flag.approximate && <span className="font-sans text-amber">{lang === "ja" ? "概略位置のため重大度を制限" : "severity capped: approximate pin"}</span>}
          </div>
        </div>
        <ChevronDown size={16} className={`mt-1 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-line bg-wash p-4">
          <EvidenceChips ids={flag.evidence_ids} onEvidence={onEvidence} />
          {payloads?.map((p) => (
            <div key={p.ev_id} className="mt-3">
              <div className="text-[12px] font-semibold">{p.ev_id} · {p.source_name} <span className="font-normal text-muted">· {p.mode.toUpperCase()} · {new Date(p.retrieved_at).toLocaleString()}</span></div>
              <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-line bg-paper p-2.5 font-mono text-[10.5px] text-ink-2 scrollbar-thin">
                {JSON.stringify(p.payload?.records ?? p.payload, (k, v) => (k === "footprint" ? "[…]" : v), 2).slice(0, 2400)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TraceTimeline({ invId }: { invId: number }) {
  const { lang } = useI18n();
  const [events, setEvents] = useState<any[]>([]);
  const [step, setStep] = useState<string>("all");
  useEffect(() => {
    api.trace(invId).then(setEvents);
  }, [invId]);
  const steps = useMemo(() => Array.from(new Set(events.filter((e) => e.step).map((e) => e.step))), [events]);
  const shown = events.filter((e) => step === "all" || e.step === step);
  const t0 = events[0] ? new Date(events[0].ts).getTime() : 0;
  const describe = (e: any): string => {
    switch (e.type) {
      case "step.started": return `▶ ${e.label_en ?? e.step}`;
      case "step.finished": return `■ ${e.step}${e.summary ? ` · ${e.summary}` : ""}`;
      case "query.finished": return `${e.source}: ${e.summary} [${e.evidence_id}] · ${e.mode?.toUpperCase()} · ${e.latency_ms} ms`;
      case "log.note": return e.text;
      case "flag.raised": return `FLAG ${e.flag.rule_id} (${e.flag.severity}, −${e.flag.deduction}) [${e.flag.evidence_ids.join(", ")}]`;
      case "claim.checked": return `CLAIM ${e.claim.verdict.toUpperCase()}: “${e.claim.text}”`;
      case "score.updated": return `SCORE ${e.overall} (${e.band})${e.final ? " · final" : ""}`;
      case "reassess.started": return `REASSESS · ${e.reason}`;
      case "money.received": return "Money data received (SIMULATED)";
      case "done": return `DONE · ${e.overall ?? ""}`;
      default: return e.type;
    }
  };
  return (
    <div>
      <div className="no-print mb-3 flex flex-wrap gap-1.5">
        {["all", ...steps].map((s) => (
          <button key={s} onClick={() => setStep(s)} className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium ${step === s ? "bg-ink text-white" : "bg-stage text-ink-2"}`}>
            {s === "all" ? (lang === "ja" ? "すべて" : "All") : s}
          </button>
        ))}
        <span className="ml-auto self-center font-mono text-[11px] text-muted">{events.length} events</span>
      </div>
      <div className="max-h-[440px] overflow-auto rounded-xl border border-line scrollbar-thin print:max-h-none">
        {shown.map((e) => (
          <div key={e.seq} className={`grid grid-cols-[52px_70px_1fr] gap-3 border-b border-line px-3 py-1.5 font-mono text-[11px] last:border-0 ${e.type === "flag.raised" ? "bg-hinomaru-wash" : e.type === "step.started" ? "bg-wash font-semibold" : ""}`}>
            <span className="text-muted">#{e.seq}</span>
            <span className="text-muted">+{((new Date(e.ts).getTime() - t0) / 1000).toFixed(2)}s</span>
            <span className="break-words text-ink-2">{describe(e)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
