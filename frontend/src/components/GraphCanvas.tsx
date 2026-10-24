import { Box, Maximize2, RotateCcw, Square } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useI18n } from "../i18n";
import type { VizLink, VizNode } from "../lib/stream";
import { communityColor, RED, riskIsRed } from "../lib/visual";

const ForceGraph3D = lazy(() => import("react-force-graph-3d"));

interface Props {
  nodes: Map<string, VizNode>;
  links: VizLink[];
  version: number;
  running: boolean;
  onSelect?: (n: VizNode) => void;
  onReplay?: () => void;
  height?: number;
  showControls?: boolean;
  staticMode?: boolean;
}

const TYPE_LABEL: Record<string, { ja: string; en: string }> = {
  company: { ja: "法人", en: "Company" },
  person: { ja: "人物", en: "Person" },
  address: { ja: "住所", en: "Address" },
  gstin: { ja: "GSTIN", en: "GSTIN" },
  case: { ja: "訴訟・倒産", en: "Case" },
  news: { ja: "報道", en: "News" },
  doc_claim: { ja: "主張", en: "Claim" },
};

function radius(n: VizNode): number {
  if (n.attrs?.target) return 13;
  const base = { company: 7, person: 7.5, address: 6, gstin: 5, case: 5.5, news: 4.5, doc_claim: 5 }[n.type] ?? 5;
  return base + Math.min(6, Math.sqrt(n.degree) * 1.3);
}

function fillFor(n: VizNode): string {
  if (riskIsRed(n.risk)) return RED;
  if (n.type === "doc_claim") {
    if (n.attrs?.verdict === "verified") return "#15803D";
    if (n.attrs?.verdict === "unverifiable") return "#AEB3BD";
  }
  return communityColor(n.community);
}

/** Small vector glyphs drawn inside each node (white on the node colour). */
function glyph(ctx: CanvasRenderingContext2D, n: VizNode, x: number, y: number, r: number) {
  const s = r * 0.55;
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(0.6, r * 0.12);
  switch (n.type) {
    case "company":
      ctx.fillRect(x - s * 0.7, y - s * 0.6, s * 1.4, s * 1.3);
      ctx.fillStyle = fillFor(n);
      for (const dx of [-0.35, 0.15])
        for (const dy of [-0.3, 0.15]) ctx.fillRect(x + dx * s, y + dy * s, s * 0.22, s * 0.22);
      break;
    case "person":
      ctx.beginPath();
      ctx.arc(x, y - s * 0.35, s * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y + s * 0.75, s * 0.72, Math.PI, 0);
      ctx.fill();
      break;
    case "address":
      if (n.attrs?.satellite) {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - s * 0.95, y - s * 0.18, s * 0.45, s * 0.36);
        ctx.fillRect(x + s * 0.5, y - s * 0.18, s * 0.45, s * 0.36);
      } else {
        ctx.beginPath();
        ctx.arc(x, y - s * 0.2, s * 0.45, Math.PI, 0);
        ctx.lineTo(x, y + s * 0.8);
        ctx.closePath();
        ctx.fill();
      }
      break;
    default: {
      const ch = { gstin: "₹", case: "§", news: "N", doc_claim: "”" }[n.type as string] ?? "•";
      ctx.font = `700 ${r * 1.05}px Inter`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ch, x, y + r * 0.05);
    }
  }
  ctx.restore();
}

export default function GraphCanvas({ nodes, links, version, running, onSelect, onReplay, height, showControls = true, staticMode = false }: Props) {
  const { lang } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const fg = useRef<any>(null);
  const [size, setSize] = useState({ w: 600, h: height ?? 500 });
  const [mode3d, setMode3d] = useState(false);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [hover, setHover] = useState<VizNode | null>(null);

  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: height ?? e.contentRect.height }));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [height]);

  const data = useMemo(() => {
    const visible = Array.from(nodes.values()).filter((n) => n.community == null || !hidden.has(n.community));
    const ids = new Set(visible.map((n) => n.id));
    const idOf = (v: string | VizNode) => (typeof v === "string" ? v : v.id);
    return { nodes: visible, links: links.filter((l) => ids.has(idOf(l.source)) && ids.has(idOf(l.target))) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, hidden]);

  const communities = useMemo(() => {
    const counts = new Map<number, number>();
    for (const n of nodes.values()) if (n.community != null) counts.set(n.community, (counts.get(n.community) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    const g = fg.current;
    if (!g || mode3d) return;
    g.d3Force("charge")?.strength(-150).distanceMax(380);
    g.d3Force("link")?.distance((l: any) => (l.type === "director_of" ? 52 : l.type === "claims" ? 38 : 44));
  }, [mode3d]);

  const fit = () => fg.current?.zoomToFit(600, 50);
  useEffect(() => {
    if (staticMode) {
      const t = setTimeout(fit, 900);
      return () => clearTimeout(t);
    }
    if (!running) return;
    const t = setTimeout(fit, 400);
    return () => clearTimeout(t);
  }, [Math.floor(nodes.size / 6), running, staticMode]); // refit as the graph grows

  const draw = (node: any, ctx: CanvasRenderingContext2D, scale: number) => {
    const n = node as VizNode;
    if (n.x == null || n.y == null) return;
    const now = performance.now();
    const age = (now - n.addedAt) / 1000;
    const grow = Math.min(1, age / 0.45);
    const r = radius(n) * (0.4 + 0.6 * (1 - Math.pow(1 - grow, 3)));
    const fill = fillFor(n);
    if (age < 1.6) {
      const g = ctx.createRadialGradient(n.x, n.y, r * 0.6, n.x, n.y, r * 3.2);
      g.addColorStop(0, fill + "55");
      g.addColorStop(1, fill + "00");
      ctx.fillStyle = g;
      ctx.globalAlpha = 1 - age / 1.6;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (riskIsRed(n.risk) || (n.pulseAt && now - n.pulseAt < 2400)) {
      const t = ((now - (n.pulseAt ?? 0)) % 1600) / 1600;
      ctx.strokeStyle = RED;
      ctx.globalAlpha = riskIsRed(n.risk) ? 0.45 * (1 - t) : 0.6 * (1 - t);
      ctx.lineWidth = 1.6 / scale;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * (1.25 + t * 1.4), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.shadowColor = "rgba(20,20,20,0.18)";
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1.2, 2 / scale);
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    if (n.attrs?.target) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    if (n.risk === "med") {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = "#D97706";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    glyph(ctx, n, n.x, n.y, r);
    const important = n.attrs?.target || n.type === "person" || n.type === "address" || (riskIsRed(n.risk) && n.type !== "doc_claim");
    if (scale > 1.5 || (important && scale > 0.7) || hover?.id === n.id) {
      const fs = Math.max(3.2, 11 / scale);
      ctx.font = `${n.attrs?.target ? 600 : 500} ${fs}px Inter, "Noto Sans JP"`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const label = n.label.length > 34 ? n.label.slice(0, 32) + "…" : n.label;
      const w = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.fillRect(n.x - w / 2 - 2, n.y + r + 2.5, w + 4, fs + 3);
      ctx.fillStyle = riskIsRed(n.risk) ? RED : "#141414";
      ctx.fillText(label, n.x, n.y + r + 4);
    }
  };

  const tooltip = hover && (
    <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[280px] rounded-lg border border-line bg-paper/95 p-3 shadow-lift backdrop-blur">
      <div className="label">{lang === "ja" ? TYPE_LABEL[hover.type]?.ja : TYPE_LABEL[hover.type]?.en}</div>
      <div className="mt-0.5 text-sm font-semibold leading-snug">{hover.label}</div>
      {hover.key && hover.key !== hover.id && <div className="mt-1 font-mono text-[11px] text-muted">{hover.key}</div>}
      {hover.attrs?.status && <div className="mt-1 text-xs text-ink-2">{String(hover.attrs.status)}</div>}
      {riskIsRed(hover.risk) && <div className="mt-1 text-xs font-semibold text-hinomaru">{lang === "ja" ? "リスクあり" : "Risk entity"}</div>}
    </div>
  );

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden stage-grid" style={height ? { height } : undefined}>
      {tooltip}
      {mode3d ? (
        <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted">Loading 3D…</div>}>
          <ForceGraph3D
            graphData={data as any}
            width={size.w}
            height={size.h}
            backgroundColor="#F6F7F9"
            nodeId="id"
            linkSource="source"
            linkTarget="target"
            nodeColor={(n: any) => fillFor(n)}
            nodeVal={(n: any) => radius(n) / 2}
            nodeLabel={(n: any) => n.label}
            nodeOpacity={0.95}
            linkColor={() => "#9AA0AB"}
            linkOpacity={0.5}
            linkDirectionalParticles={running ? 2 : 0}
            linkDirectionalParticleColor={() => RED}
            linkDirectionalParticleWidth={1.6}
            onNodeClick={(n: any) => onSelect?.(n)}
          />
        </Suspense>
      ) : (
        <ForceGraph2D
          ref={fg}
          graphData={data as any}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          nodeId="id"
          nodeRelSize={1}
          nodeVal={(n: any) => radius(n) ** 2}
          nodeCanvasObject={draw}
          nodePointerAreaPaint={(n: any, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(n.x, n.y, radius(n) + 3, 0, Math.PI * 2);
            ctx.fill();
          }}
          linkColor={(l: any) => (riskIsRed((l.target as VizNode).risk) && riskIsRed((l.source as VizNode).risk) ? "rgba(227,18,43,0.55)" : "rgba(60,64,72,0.28)")}
          linkWidth={(l: any) => (l.type === "director_of" ? 1.3 : 0.9)}
          linkLineDash={(l: any) => (l.type === "claims" || l.type === "claimed_site" ? [3, 2] : null)}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={0.92}
          linkDirectionalArrowColor={() => "rgba(60,64,72,0.45)"}
          linkDirectionalParticles={running ? 2 : 0}
          linkDirectionalParticleSpeed={0.008}
          linkDirectionalParticleWidth={2.2}
          linkDirectionalParticleColor={(l: any) => (riskIsRed((l.target as VizNode).risk) ? RED : "#141414")}
          d3VelocityDecay={0.32}
          cooldownTicks={staticMode ? 120 : Infinity}
          warmupTicks={staticMode ? 60 : 0}
          autoPauseRedraw={false}
          onNodeHover={(n: any) => setHover(n)}
          onNodeClick={(n: any) => onSelect?.(n)}
          enableNodeDrag
        />
      )}

      {showControls && (
        <div className="no-print absolute right-3 top-3 flex gap-1.5">
          <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => setMode3d((m) => !m)} aria-pressed={mode3d}>
            {mode3d ? <Square size={14} /> : <Box size={14} />} {mode3d ? "2D" : "3D"}
          </button>
          <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={fit}>
            <Maximize2 size={14} /> {lang === "ja" ? "全体表示" : "Fit"}
          </button>
          {onReplay && (
            <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={onReplay}>
              <RotateCcw size={14} /> {lang === "ja" ? "再生" : "Replay"}
            </button>
          )}
        </div>
      )}

      {communities.length > 0 && (
        <div className="absolute bottom-3 left-3 max-h-[46%] w-[188px] overflow-auto rounded-lg border border-line bg-paper/95 p-2.5 shadow-card backdrop-blur scrollbar-thin">
          <div className="label mb-1.5 flex items-center justify-between">
            <span>{lang === "ja" ? "コミュニティ" : "Communities"}</span>
            <span className="num text-sm text-ink">{communities.length}</span>
          </div>
          {communities.map(([c, count]) => (
            <label key={c} className="flex cursor-pointer items-center gap-2 py-0.5 text-xs text-ink-2">
              <input type="checkbox" className="h-3 w-3 accent-ink" checked={!hidden.has(c)}
                onChange={() => setHidden((h) => { const s = new Set(h); s.has(c) ? s.delete(c) : s.add(c); return s; })} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: communityColor(c) }} />
              <span className="flex-1">{lang === "ja" ? `グループ ${c + 1}` : `Group ${c + 1}`}</span>
              <span className="font-mono text-[10px] text-muted">{count}</span>
            </label>
          ))}
          <div className="mt-1.5 flex items-center gap-2 border-t border-line pt-1.5 text-[11px] text-ink-2">
            <span className="h-2.5 w-2.5 rounded-full bg-hinomaru" /> {lang === "ja" ? "リスク実体" : "Risk entity"}
          </div>
        </div>
      )}
    </div>
  );
}
