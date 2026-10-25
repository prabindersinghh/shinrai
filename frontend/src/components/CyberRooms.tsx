/* Isometric kit and the four cutaway rooms for CyberDissection.
   Conventions follow wheresryan22/anatomy: solids are filled and drawn back to front, three face tones, every line ends on
   a face or a terminal dot. The comic look is inked outlines, halftone on the shaded faces and hard-shadow captions.
   World units are 1 SVG unit; x runs right-down, y runs left-down, z is up. */
import type { ReactNode } from "react";

export type Status = "pass" | "warn" | "fail" | "na";
export interface Check { check: string; result: string; result_ja?: string; status: Status }
type V = [number, number, number];

const C = Math.cos(Math.PI / 6);
const r2 = (n: number) => Math.round(n * 100) / 100;
export const P = (x: number, y: number, z = 0): [number, number] => [r2((x - y) * C), r2((x + y) / 2 - z)];
const pts = (v: V[]) => v.map(([x, y, z]) => P(x, y, z).join(",")).join(" ");

export const INK = "#141414";
export const ACCENT: Record<Status, { solid: string; soft: string; mid: string }> = {
  pass: { solid: "#15803D", soft: "#E9F7EE", mid: "#BFE5CC" },
  warn: { solid: "#D97706", soft: "#FEF5E6", mid: "#F8D9A8" },
  fail: { solid: "#E3122B", soft: "#FDECEE", mid: "#F6B3BB" },
  na: { solid: "#7A808C", soft: "#F1F2F5", mid: "#D6D8DD" },
};
const TONE = { top: "#FFFFFF", left: "#E6E8ED", right: "#C3C7D0" };
const INKP = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: "round", strokeLinecap: "round" } as const;
const FONT = "Inter, 'Noto Sans JP', sans-serif";

export const W = 150, D = 150, T = 12, H = 84, WT = 6;

export function RoomDefs() {
  return (
    <defs>
      <pattern id="cy-ht" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
        <circle cx="2.5" cy="2.5" r="1.05" fill={INK} />
      </pattern>
      <pattern id="cy-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0V5" stroke={INK} strokeWidth="1" />
      </pattern>
    </defs>
  );
}

interface BoxP { x: number; y: number; z?: number; w: number; d: number; h: number; top?: string; left?: string; right?: string; ghost?: boolean }

/** Visible faces of a box seen from the front: front-left (y+d plane), front-right (x+w plane, halftoned) and top. */
export function Box({ x, y, z = 0, w, d, h, top = TONE.top, left = TONE.left, right = TONE.right, ghost }: BoxP) {
  const L = pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]);
  const R = pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]);
  const Tp = pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]);
  if (ghost) {
    return (
      <g strokeDasharray="3.2 3" opacity=".7">
        <polygon points={L} fill="#fff" fillOpacity=".5" />
        <polygon points={R} fill="#fff" fillOpacity=".5" />
        <polygon points={Tp} fill="#fff" fillOpacity=".7" />
      </g>
    );
  }
  return (
    <g>
      <polygon points={L} fill={left} />
      <polygon points={R} fill={right} />
      <polygon points={R} fill="url(#cy-ht)" stroke="none" opacity=".42" />
      <polygon points={Tp} fill={top} />
    </g>
  );
}

/** A flat drawing surface in 3D: axis "y" is a wall or face with y fixed (u runs along x), "x" has x fixed (u runs along y),
 *  "z" is a floor (u along x, v along y). v is screen-down on walls, so z = -v. */
export function Plane({ axis, at, children }: { axis: "x" | "y" | "z"; at: V; children: ReactNode }) {
  const [sx, sy] = P(...at);
  const m = axis === "y" ? [C, 0.5, 0, 1] : axis === "x" ? [-C, 0.5, 0, 1] : [C, 0.5, -C, 0.5];
  return <g transform={`translate(${sx} ${sy}) matrix(${m.join(" ")} 0 0)`}>{children}</g>;
}

/** A piece that slides apart from the rest when the room is dissected (dx, dy are screen units). */
function Part({ dx, dy, children }: { dx: number; dy: number; children: ReactNode }) {
  return <g className="cy-part" data-dx={dx} data-dy={dy}>{children}</g>;
}

/** Hard-shadow caption that ends on a terminal dot placed on the object. */
export function Tag({ at, text, dx, dy, color = INK }: { at: V; text: string; dx: number; dy: number; color?: string }) {
  const [sx, sy] = P(...at);
  const w = [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 9.6 : 5.5), 13);
  return (
    <g className="cy-tag" transform={`translate(${sx} ${sy})`} stroke={INK} strokeLinecap="round">
      <path d={`M0 0 L${dx} ${dy}`} strokeWidth="1.2" fill="none" />
      <circle r="2.3" fill={INK} stroke="none" />
      <g transform={`translate(${dx} ${dy})`}>
        <rect x={-w / 2 + 2} y={-6} width={w} height="16" rx="2.5" fill={INK} stroke="none" />
        <rect x={-w / 2} y={-8} width={w} height="16" rx="2.5" fill="#fff" strokeWidth="1.4" />
        <text y="3.4" textAnchor="middle" fontSize="9.4" fontWeight="800" fill={color} stroke="none" fontFamily={FONT}>{text}</text>
      </g>
    </g>
  );
}

function RoomShell({ s, children }: { s: Status; children: ReactNode }) {
  const a = ACCENT[s];
  return (
    <g {...INKP}>
      <Box x={-WT} y={-WT} z={-T} w={W + WT} d={D + WT} h={T} />
      <polygon points={pts([[0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0]])} fill={a.soft} stroke="none" />
      <g strokeWidth=".7" opacity=".18">
        {[30, 60, 90, 120].map((k) => (
          <g key={k}>
            <path d={`M${P(k, 0).join(" ")} L${P(k, D).join(" ")}`} />
            <path d={`M${P(0, k).join(" ")} L${P(W, k).join(" ")}`} />
          </g>
        ))}
      </g>
      <polygon points={pts([[-WT, D, -T], [W, D, -T], [W, D, -T + 4.5], [-WT, D, -T + 4.5]])} fill={a.solid} />
      <polygon points={pts([[W, -WT, -T], [W, D, -T], [W, D, -T + 4.5], [W, -WT, -T + 4.5]])} fill={a.solid} />
      <Box x={-WT} y={-WT} w={W + WT} d={WT} h={H} />
      <Box x={-WT} y={0} w={WT} d={D} h={H} />
      {children}
    </g>
  );
}

const crack = (s: Status) => s === "fail";

export function CertRoom({ s, note }: { s: Status; note: string }) {
  const a = ACCENT[s];
  const open = s !== "pass";
  return (
    <RoomShell s={s}>
      <Part dx={-22} dy={13}>
        <Plane axis="y" at={[0, 0, 0]}>
          <rect x="26" y="-86" width="98" height="66" rx="2.5" fill="#fff" />
          <rect x="31" y="-81" width="88" height="56" fill="none" strokeWidth=".9" strokeDasharray="3 2.2" />
          <rect x="45" y="-77" width="60" height="6" fill={INK} stroke="none" />
          <path d="M40 -64 H110 M40 -58 H110 M40 -52 H94" strokeWidth="1.2" opacity=".5" fill="none" />
          {crack(s) && <path className="cy-draw" pathLength={1} d="M26 -58 L49 -50 L41 -40 L65 -31 L57 -20" stroke={a.solid} strokeWidth="2.6" fill="none" />}
        </Plane>
      </Part>
      <Part dx={-6} dy={16}>
        <Plane axis="y" at={[0, 0, 0]}>
          <path d="M68 -33 L62 -15 L70 -19 L76 -11 L80 -31 Z" fill={a.mid} />
          <path d="M82 -33 L88 -15 L80 -19 L74 -11 L70 -31 Z" fill={a.solid} />
          <circle cx="75" cy="-37" r="13" fill={a.solid} />
          <circle cx="75" cy="-37" r="8.6" fill="none" stroke="#fff" strokeWidth="1.5" />
          {s === "pass" ? <path d="M70 -37 L74 -33 L81 -41" stroke="#fff" fill="none" strokeWidth="2.2" />
            : s === "na" ? <text x="75" y="-33" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" stroke="none" fontFamily={FONT}>?</text>
            : <path d="M70.5 -41.5 L79.5 -32.5 M79.5 -41.5 L70.5 -32.5" stroke="#fff" fill="none" strokeWidth="2.2" />}
        </Plane>
      </Part>
      <Box x={58} y={72} w={34} d={30} h={24} top={a.soft} left={a.mid} right={a.solid} />
      <Plane axis="y" at={[0, 102, 0]}>
        <circle cx="75" cy="-13" r="3.2" fill={INK} stroke="none" />
        <rect x="74" y="-13" width="2" height="8" fill={INK} stroke="none" />
      </Plane>
      <Part dx={0} dy={-9}>
        <Plane axis="y" at={[0, 87, 0]}>
          <path d={open ? "M66 -24 V-38 A9 9 0 0 1 84 -38 V-31" : "M66 -24 V-38 A9 9 0 0 1 84 -38 V-24"} fill="none" stroke={INK} strokeWidth="6" />
          <path d={open ? "M66 -24 V-38 A9 9 0 0 1 84 -38 V-31" : "M66 -24 V-38 A9 9 0 0 1 84 -38 V-24"} fill="none" stroke="#fff" strokeWidth="2.4" />
        </Plane>
      </Part>
      <Tag at={[92, 87, 14]} text={note} dx={48} dy={36} color={a.solid} />
    </RoomShell>
  );
}

export function ProtoRoom({ s, legacy, best }: { s: Status; legacy: "open" | "closed" | "unknown"; best: string }) {
  const a = ACCENT[s];
  const heights = [34, 44, 58, 72];
  const names = ["1.0", "1.1", "1.2", "1.3"];
  return (
    <RoomShell s={s}>
      <Plane axis="z" at={[0, 0, 0]}>
        <text x="16" y="128" fontSize="17" fontWeight="900" opacity=".2" fill={INK} stroke="none" fontFamily={FONT}>TLS</text>
      </Plane>
      {heights.map((h, i) => {
        const x = 14 + i * 30, y = 62, w = 22, d = 22;
        const old = i < 2;
        const label = (
          <Plane axis="y" at={[0, y + d, 0]}>
            <text x={x + w / 2} y={-h / 2 + 3} textAnchor="middle" fontSize="9.5" fontWeight="900" fill={INK} stroke="none" fontFamily={FONT}>{names[i]}</text>
          </Plane>
        );
        if (old && legacy === "closed") {
          return (
            <Part key={i} dx={(i - 1.5) * 10} dy={-8}>
              <Box x={x} y={y} w={w} d={d} h={h} ghost />
              <Plane axis="y" at={[0, y + d, 0]}>
                <path d={`M${x + 6} ${-h / 2 - 5} l10 10 m0 -10 l-10 10`} stroke={INK} strokeWidth="2" fill="none" />
              </Plane>
            </Part>
          );
        }
        const t = old ? (legacy === "open" ? ACCENT.fail : ACCENT.na) : ACCENT.pass;
        const isBest = !old && best.endsWith(names[i]);
        const [sx, sy] = P(x + w / 2, y + d / 2, h + 11);
        return (
          <Part key={i} dx={(i - 1.5) * 10} dy={-(8 + i * 4)}>
            <Box x={x} y={y} w={w} d={d} h={h} top={t.soft} left={old ? t.mid : TONE.left} right={old ? t.solid : TONE.right} />
            {!old && <Box x={x} y={y} z={h} w={w} d={d} h={4} top={t.soft} left={t.mid} right={t.solid} />}
            {label}
            {isBest && <path d={`M${sx} ${sy - 7} l2.1 4.6 5 .6 -3.7 3.4 1 5 -4.4 -2.5 -4.4 2.5 1 -5 -3.7 -3.4 5 -.6 z`} fill={a.solid} transform="translate(0 -4)" />}
            {old && legacy === "open" && <path d={`M${sx} ${sy - 10} l7 12 h-14 z`} fill="#fff" strokeWidth="1.5" />}
            {old && legacy === "open" && <path d={`M${sx} ${sy - 6} v5 M${sx} ${sy - 2.4} v.01`} strokeWidth="1.6" fill="none" />}
          </Part>
        );
      })}
      <Tag at={[14 + 3 * 30 + 11, 62 + 11, 58]} text={best || "TLS"} dx={64} dy={-46} color={a.solid} />
    </RoomShell>
  );
}

type Shield = "ok" | "weak" | "missing";

function ShieldMark({ u, label, state }: { u: number; label: string; state: Shield }) {
  const fill = state === "ok" ? ACCENT.pass.soft : state === "weak" ? ACCENT.warn.soft : "none";
  const col = state === "ok" ? ACCENT.pass.solid : state === "weak" ? ACCENT.warn.solid : ACCENT.fail.solid;
  return (
    <Plane axis="y" at={[0, 0, 0]}>
      <g transform={`translate(${u} -78)`}>
        <path d="M0 0 H30 V19 C30 29 23 34 15 38 C7 34 0 29 0 19 Z" fill={fill} strokeDasharray={state === "missing" ? "3.4 2.6" : undefined} />
        <text x="15" y="12.5" textAnchor="middle" fontSize="7.4" fontWeight="900" fill={INK} stroke="none" fontFamily={FONT}>{label}</text>
        {state === "ok" && <path d="M9.5 23 L13.6 27 L21 19" stroke={col} fill="none" strokeWidth="2.6" />}
        {state === "weak" && <path d="M15 17 v7 M15 28 v.01" stroke={col} fill="none" strokeWidth="2.8" />}
        {state === "missing" && <path d="M9.5 18.5 L20.5 29.5 M20.5 18.5 L9.5 29.5" stroke={col} fill="none" strokeWidth="2.8" />}
      </g>
    </Plane>
  );
}

export function MailRoom({ s, spf, dmarc, policy, fakeLabel }: { s: Status; spf: Shield; dmarc: Shield; policy: string; fakeLabel: string }) {
  const a = ACCENT[s];
  const fake = spf === "missing" || dmarc === "missing";
  const [ex, ey] = P(115, 100, 62);
  return (
    <RoomShell s={s}>
      <Part dx={-20} dy={11}><ShieldMark u={30} label="SPF" state={spf} /></Part>
      <Part dx={-20} dy={11}><ShieldMark u={88} label="DMARC" state={dmarc} /></Part>
      <Box x={96} y={84} w={38} d={32} h={34} top={a.soft} left={TONE.left} right={TONE.right} />
      <Box x={92} y={80} z={34} w={46} d={40} h={6} />
      <Plane axis="y" at={[0, 116, 0]}>
        <rect x="104" y="-26" width="22" height="3.6" rx="1.2" fill={INK} stroke="none" />
      </Plane>
      <Box x={134} y={98} w={4} d={4} h={46} left={a.mid} right={a.solid} top={a.soft} />
      <Part dx={-40} dy={-6}>
        <g transform={`translate(${ex} ${ey}) rotate(-10)`}>
          <rect x="-17" y="-11" width="34" height="22" rx="2" fill={fake ? ACCENT.fail.soft : "#fff"} />
          <path d="M-17 -11 L0 3 L17 -11" fill="none" />
          {fake && <text y="9.4" textAnchor="middle" fontSize="6.8" fontWeight="900" fill={ACCENT.fail.solid} stroke="none" fontFamily={FONT}>{fakeLabel}</text>}
        </g>
      </Part>
      {policy && <Tag at={[103, 0, 44]} text={policy} dx={22} dy={42} color={a.solid} />}
    </RoomShell>
  );
}

export function SoftRoom({ s, product, banner, eolLabel }: { s: Status; product: string; banner: string; eolLabel: string }) {
  const a = ACCENT[s];
  const [dx, dy] = P(79, 73, 112);
  const rows = [14, 32, 50, 68];
  return (
    <RoomShell s={s}>
      <Box x={52} y={52} w={56} d={48} h={80} />
      {rows.map((z, k) => {
        const hot = k === 2;
        const drawer = (
          <Plane axis="y" at={[0, 100, 0]}>
            <rect x="58" y={-z - 7} width="44" height="14" rx="1.5" fill={hot ? a.soft : "#fff"} />
            <path d={`M62 ${-z - 2} h20 M62 ${-z + 2.5} h14`} strokeWidth=".9" opacity=".5" fill="none" />
            <circle cx="96" cy={-z} r="2.6" fill={hot ? a.solid : ACCENT.pass.solid} />
          </Plane>
        );
        return hot ? <Part key={z} dx={-17} dy={10}>{drawer}</Part> : <g key={z}>{drawer}</g>;
      })}
      <Box x={76} y={70} z={80} w={6} d={6} h={18} />
      <Plane axis="x" at={[79, 0, 0]}>
        <ellipse cx="73" cy="-103" rx="17" ry="17" fill="#fff" />
        <ellipse cx="73" cy="-103" rx="9" ry="9" fill="none" strokeWidth="1" />
        <path d="M73 -103 L86 -112" fill="none" />
        <circle cx="86" cy="-112" r="2.6" fill={a.solid} />
      </Plane>
      <g className="cy-pulse" fill="none" stroke={s === "pass" ? INK : a.solid} strokeWidth="2.2">
        <path d={`M${dx + 14} ${dy - 22} q9 -3 13 5`} />
        <path d={`M${dx + 17} ${dy - 29} q14 -4 20 8`} />
        <path d={`M${dx + 20} ${dy - 36} q19 -5 27 11`} />
      </g>
      <Tag at={[52, 100, 50]} text={product || banner || "—"} dx={-52} dy={22} color={a.solid} />
      {s === "warn" && <Tag at={[108, 52, 70]} text={eolLabel} dx={40} dy={-20} color={ACCENT.fail.solid} />}
    </RoomShell>
  );
}
