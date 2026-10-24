import { motion } from "framer-motion";
import { BAND } from "../lib/visual";

interface Props {
  band: string | null;
  size?: number;
  delay?: number;
  stamped?: boolean;
}

/** The 信頼 seal: stamps onto the score when an investigation finishes. Ink texture via an SVG filter. */
export default function HankoSeal({ band, size = 96, delay = 0, stamped = true }: Props) {
  const meta = BAND[band ?? ""];
  if (!meta) return null;
  const color = band === "low" ? "#15803D" : band === "standard" ? "#141414" : "#E3122B";
  return (
    <motion.div
      initial={stamped ? { scale: 2.1, opacity: 0, rotate: -18 } : false}
      animate={{ scale: 1, opacity: 1, rotate: -8 }}
      transition={{ delay, type: "spring", stiffness: 420, damping: 16, mass: 0.9 }}
      style={{ width: size, height: size }}
      className="pointer-events-none"
      aria-label={`判定 ${meta.ja}`}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <filter id={`ink-${band}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.45" result="mask" />
            <feComposite in="SourceGraphic" in2="mask" operator="in" />
          </filter>
        </defs>
        <g filter={`url(#ink-${band})`}>
          <rect x="5" y="5" width="90" height="90" rx="14" fill="none" stroke={color} strokeWidth="6" />
          <rect x="13" y="13" width="74" height="74" rx="8" fill="none" stroke={color} strokeWidth="1.6" />
          <text x="50" y="44" textAnchor="middle" fontFamily="Noto Sans JP" fontWeight="700" fontSize="25" fill={color}>
            信頼
          </text>
          <line x1="22" y1="53" x2="78" y2="53" stroke={color} strokeWidth="1.6" />
          <text x="50" y="75" textAnchor="middle" fontFamily="Noto Sans JP" fontWeight="700"
            fontSize={meta.ja.length > 3 ? 15 : 18} fill={color}>
            {meta.ja}
          </text>
        </g>
      </svg>
    </motion.div>
  );
}
