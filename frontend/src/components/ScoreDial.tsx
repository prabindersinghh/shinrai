import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { BAND } from "../lib/visual";

interface Props {
  score: number | null;
  band: string | null;
  size?: number;
  final?: boolean;
  compact?: boolean;
}

const SWEEP = 270;

/** 0–100 dial: an ink track with a band-coloured arc that tweens as evidence arrives. */
export default function ScoreDial({ score, band, size = 200, final = false, compact = false }: Props) {
  const { lang } = useI18n();
  const value = useMotionValue(score ?? 0);
  const [display, setDisplay] = useState(score ?? 0);
  useEffect(() => {
    if (score == null) return;
    const controls = animate(value, score, { duration: 1.1, ease: [0.22, 1, 0.36, 1] });
    const unsub = value.on("change", (v) => setDisplay(Math.round(v)));
    return () => {
      controls.stop();
      unsub();
    };
  }, [score, value]);

  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const arcLen = (c * SWEEP) / 360;
  const dash = useTransform(value, (v) => `${(arcLen * Math.max(0, Math.min(100, v))) / 100} ${c}`);
  const meta = BAND[band ?? ""] ?? null;
  const color = meta?.color ?? "#141414";

  return (
    <div className="relative select-none" style={{ width: size, height: size }} aria-label={`信頼スコア ${score ?? "—"}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[225deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDEEF1" strokeWidth={compact ? 8 : 12}
          strokeDasharray={`${arcLen} ${c}`} strokeLinecap="round" />
        {Array.from({ length: 11 }).map((_, i) => {
          const a = ((-SWEEP / 2 + (SWEEP * i) / 10 - 90 + 225) * Math.PI) / 180;
          const r1 = r + (compact ? 7 : 10);
          const r2 = r1 + (i % 5 === 0 ? 7 : 4);
          return (
            <line key={i} x1={size / 2 + r1 * Math.cos(a)} y1={size / 2 + r1 * Math.sin(a)}
              x2={size / 2 + r2 * Math.cos(a)} y2={size / 2 + r2 * Math.sin(a)} stroke="#C9CCD3" strokeWidth={1} />
          );
        })}
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={compact ? 8 : 12}
          strokeLinecap="round" style={{ strokeDasharray: dash, opacity: score == null ? 0 : 1 }} animate={{ stroke: color }} transition={{ duration: 0.6 }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline gap-1">
          <span className="num leading-none text-ink" style={{ fontSize: size * (compact ? 0.34 : 0.36) }}>
            {score == null ? "—" : display}
          </span>
          {!compact && <span className="num text-lg text-muted">/100</span>}
        </div>
        {meta && (
          <motion.div key={band} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="jp mt-1 text-center font-bold" style={{ color, fontSize: compact ? 12 : 15 }}>
            {lang === "ja" ? meta.ja : meta.en}
            {!compact && <span className="ml-1.5 text-[11px] font-medium text-muted">{lang === "ja" ? meta.en : meta.ja}</span>}
          </motion.div>
        )}
        {!final && score != null && !compact && (
          <div className="mt-1 text-[10px] font-medium text-muted">{lang === "ja" ? "評価中" : "scoring…"}</div>
        )}
      </div>
    </div>
  );
}
