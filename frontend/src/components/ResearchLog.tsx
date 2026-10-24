import { motion } from "framer-motion";
import { Check, Loader2, Minus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { LogLine, StepState } from "../lib/stream";
import { ADAPTER_LABEL, MODE } from "../lib/visual";

interface Props {
  log: LogLine[];
  steps: StepState[];
  onEvidence?: (ev: string) => void;
}

function queryText(q?: Record<string, unknown>): string {
  if (!q) return "";
  const parts = Object.entries(q)
    .filter(([k]) => !["site", "years", "half_m", "target"].includes(k))
    .map(([k, v]) => {
      const val = Array.isArray(v) ? `[${v.length}]` : typeof v === "number" ? v.toFixed?.(4) ?? v : String(v);
      return `${k}=${val.length > 42 ? val.slice(0, 40) + "…" : val}`;
    });
  return parts.join(" ");
}

function StatusIcon({ status }: { status: LogLine["status"] }) {
  if (status === "running") return <Loader2 size={13} className="animate-spin text-ink-3" />;
  if (status === "ok") return <Check size={13} className="text-verified" strokeWidth={3} />;
  if (status === "empty") return <Minus size={13} className="text-ink-3" strokeWidth={3} />;
  if (status === "failed") return <X size={13} className="text-hinomaru" strokeWidth={3} />;
  return <Minus size={13} className="text-muted" />;
}

/** Monospace research log grouped by pipeline step; auto-scrolls unless the reader scrolled up. */
export default function ResearchLog({ log, steps, onEvidence }: Props) {
  const { lang } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);
  useEffect(() => {
    if (stick && box.current) box.current.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [log, stick]);
  const stepLabel = (id: string) => {
    const s = steps.find((x) => x.id === id);
    return s ? (lang === "ja" ? s.ja : s.en) : id;
  };
  const stepIndex = (id: string) => steps.findIndex((x) => x.id === id) + 1;

  return (
    <div
      ref={box}
      onScroll={(e) => {
        const el = e.currentTarget;
        setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
      }}
      className="h-full overflow-y-auto px-3 pb-6 font-mono text-[11.5px] leading-[1.55] scrollbar-thin"
      role="log"
      aria-live="polite"
    >
      {log.length === 0 && <div className="px-1 py-6 font-sans text-sm text-muted">{lang === "ja" ? "最初の情報源を待っています…" : "Waiting for the first source…"}</div>}
      {log.map((l) => {
        if (l.level === "header") {
          return (
            <motion.div key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="sticky top-0 z-[1] -mx-3 mt-3 flex items-center gap-2 border-b border-line bg-paper/95 px-3 py-1.5 font-sans backdrop-blur first:mt-0">
              <span className="num text-[15px] leading-none text-hinomaru">{String(stepIndex(l.step)).padStart(2, "0")}</span>
              <span className="text-[12px] font-semibold text-ink">{stepLabel(l.step)}</span>
            </motion.div>
          );
        }
        if (l.kind === "note") {
          const tone = l.level === "warn" ? "text-caution" : l.level === "error" ? "text-hinomaru" : "text-ink-3";
          return (
            <motion.div key={l.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className={`flex gap-2 py-0.5 pl-1 ${tone}`}>
              <span className="w-4 shrink-0 text-center">{l.icon ?? "›"}</span>
              <span className="break-words">{l.text}</span>
            </motion.div>
          );
        }
        const mode = MODE[l.mode ?? "none"] ?? MODE.none;
        return (
          <motion.div key={l.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
            className={`group my-0.5 rounded-md px-1 py-1 ${l.status === "failed" ? "bg-hinomaru-wash" : "hover:bg-wash"}`}>
            <div className="flex items-center gap-1.5">
              <span className="w-4 shrink-0 text-center">{l.icon ?? <StatusIcon status={l.status} />}</span>
              <span className="shrink-0 rounded bg-ink px-1.5 py-[1px] text-[10px] font-medium text-white">{ADAPTER_LABEL[l.adapter ?? ""] ?? l.adapter}</span>
              <span className="min-w-0 flex-1 truncate font-sans text-[12px] font-medium text-ink">{l.label || l.source}</span>
              <span className={`shrink-0 rounded px-1 py-[1px] text-[9.5px] font-semibold ${mode.cls}`}>{mode.label}</span>
            </div>
            <div className="ml-[22px] mt-0.5 flex flex-wrap items-center gap-x-2 text-ink-3">
              <span className="truncate text-[10.5px] text-muted">{queryText(l.query)}</span>
              {l.status !== "running" && (
                <>
                  {l.icon && <StatusIcon status={l.status} />}
                  <span className={l.status === "failed" ? "text-hinomaru" : "text-ink-2"}>→ {l.summary}</span>
                  {l.latency != null && <span className="text-muted">{l.latency} ms</span>}
                  {l.evidence_id && (
                    <button onClick={() => onEvidence?.(l.evidence_id!)} className="rounded px-1 text-[10px] text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-hinomaru">
                      {l.evidence_id}
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
