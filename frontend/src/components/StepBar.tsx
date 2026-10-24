import { useI18n } from "../i18n";
import type { StepState } from "../lib/stream";

/** The pipeline as a row of segments in the black command bar. */
export default function StepBar({ steps }: { steps: StepState[] }) {
  const { lang } = useI18n();
  const active = steps.find((s) => s.status === "active");
  const done = steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-1 gap-[3px]" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}>
        {steps.map((s, i) => (
          <div key={s.id} className="group relative flex-1">
            <div
              className={`h-[5px] rounded-full transition-colors duration-500 ${
                s.status === "done" ? "bg-white" : s.status === "skipped" ? "bg-white/25" : s.status === "active"
                  ? "bg-[linear-gradient(90deg,#E3122B,#ff5a6c,#E3122B)] bg-[length:200%_100%] animate-shimmer" : "bg-white/12"
              }`}
              style={s.status === "pending" ? { background: "rgba(255,255,255,0.12)" } : undefined}
            />
            <div className="pointer-events-none absolute left-1/2 top-3 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded bg-white px-2 py-1 text-[11px] text-ink shadow-lift group-hover:block">
              {String(i + 1).padStart(2, "0")} · {lang === "ja" ? s.ja : s.en}
              {s.summary && <span className="ml-1 text-muted">· {s.summary}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="w-[190px] shrink-0 truncate text-right text-[12px] text-white/80">
        {active ? (
          <>
            <span className="num mr-1.5 text-[15px] text-hinomaru">{String(steps.indexOf(active) + 1).padStart(2, "0")}</span>
            {lang === "ja" ? active.ja : active.en}
          </>
        ) : (
          <span className="num text-[15px] text-white">{done}/{steps.length || 16}</span>
        )}
      </div>
    </div>
  );
}
