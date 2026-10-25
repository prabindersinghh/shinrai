import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const ForceGraph3D = lazy(() => import("react-force-graph-3d"));

export type EdgeStatus = "verified" | "reported" | "platform" | "unavailable" | "stale";
export interface RNode {
  id: string;
  label: string;
  kind: "supplier" | "person" | "address" | "cert" | "port" | "product" | "buyer" | "you" | "pool" | "unknown";
}
export interface RLink {
  source: string;
  target: string;
  type: string;
  status: EdgeStatus;
}

export const EDGE_STYLE: Record<EdgeStatus, { color: string; en: string; ja: string }> = {
  verified: { color: "#141414", en: "Verified (public record)", ja: "検証済（公的記録）" },
  reported: { color: "#D97706", en: "Reported (self-declared)", ja: "申告（自己申告）" },
  platform: { color: "#5B8DEF", en: "Platform-observed (parties only)", ja: "取引記録（当事者のみ）" },
  unavailable: { color: "#C3C8D1", en: "Not checked / unavailable", ja: "未確認・取得不可" },
  stale: { color: "#AEB3BD", en: "Stale (> 180 days)", ja: "古い情報（180日超）" },
};
const NODE_COLOR: Record<RNode["kind"], string> = {
  supplier: "#1E3A5F", person: "#5C616C", address: "#8C9BAB", cert: "#15803D", port: "#2BB3A3", product: "#C8A97E", buyer: "#9AA3B0", you: "#E3122B", pool: "#5B8DEF", unknown: "#D6D9DE",
};

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`); // force-graph tooltips render HTML

function labelSprite(text: string, color: string): THREE.Sprite {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = "600 44px Inter, 'Noto Sans JP', sans-serif";
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  c.width = w;
  c.height = 72;
  ctx.font = font;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.roundRect(0, 4, w, 64, 18);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 20, 38);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(w / 7, 10, 1);
  return s;
}

export default function RelationshipGraph({ nodes, links, height = 420 }: { nodes: RNode[]; links: RLink[]; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const fg = useRef<any>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  const data = useMemo(() => ({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) }), [nodes, links]);

  return (
    <div ref={wrap} className="relative overflow-hidden rounded-xl stage-grid" style={{ height }}>
      <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted">Loading 3D…</div>}>
        <ForceGraph3D
          ref={fg}
          onEngineStop={() => fg.current?.zoomToFit(600, 30)}
          graphData={data as any}
          width={w}
          height={height}
          backgroundColor="rgba(0,0,0,0)"
          showNavInfo={false}
          nodeThreeObject={(n: any) => {
            const g = new THREE.Group();
            const r = n.kind === "supplier" || n.kind === "you" ? 5 : n.kind === "unknown" ? 2.6 : 3.4;
            const mat = n.kind === "unknown"
              ? new THREE.MeshStandardMaterial({ color: NODE_COLOR.unknown, transparent: true, opacity: 0.6, wireframe: true })
              : new THREE.MeshStandardMaterial({ color: NODE_COLOR[n.kind as RNode["kind"]], roughness: 0.45, metalness: 0.1 });
            g.add(new THREE.Mesh(n.kind === "cert" ? new THREE.OctahedronGeometry(r) : n.kind === "port" ? new THREE.CylinderGeometry(r * 0.8, r * 0.8, r, 24) : n.kind === "product" ? new THREE.BoxGeometry(r * 1.4, r * 1.4, r * 1.4) : new THREE.SphereGeometry(r, 24, 24), mat));
            const sp = labelSprite(n.label, n.kind === "you" ? "#B70D21" : "#141414");
            sp.position.y = -r - 6;
            g.add(sp);
            return g;
          }}
          linkColor={(l: any) => EDGE_STYLE[l.status as EdgeStatus].color}
          linkWidth={(l: any) => (l.status === "verified" ? 1.1 : l.status === "platform" ? 1.4 : 0.5)}
          linkOpacity={0.6}
          linkDirectionalParticles={(l: any) => (l.status === "platform" ? 3 : l.status === "verified" ? 1 : 0)}
          linkDirectionalParticleWidth={1.8}
          linkDirectionalParticleColor={(l: any) => EDGE_STYLE[l.status as EdgeStatus].color}
          linkLabel={(l: any) => esc(`${l.type} · ${EDGE_STYLE[l.status as EdgeStatus].en}`)}
          nodeLabel={(n: any) => esc(n.label)}
          cooldownTicks={120}
        />
      </Suspense>
    </div>
  );
}
