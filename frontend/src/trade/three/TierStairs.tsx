import { useRef } from "react";
import * as THREE from "three";
import type { PriceTier } from "../types";
import { toScreen, useScene } from "./useScene";

interface Props {
  tiers: PriceTier[];
  qty: number; // current pooled quantity
  own?: number; // what the buyer alone would reach
  maxQty: number;
  height?: number;
  fmtPrice: (minor: number) => string;
  fmtQty: (n: number) => string;
}

const SPAN = 14, DEPTH = 2.6;

/** Price tiers as a staircase: each step is cheaper per unit; a marker sits on the step the pool has reached. */
export default function TierStairs({ tiers, qty, own, maxQty, height = 260, fmtPrice, fmtQty }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);

  useScene<Props>(host, (ctx) => {
    const { scene, camera, controls } = ctx;
    camera.position.set(2, 7, 15.5);
    controls.target.set(0, 1.4, 0);
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI * 0.25;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minAzimuthAngle = -0.6;
    controls.maxAzimuthAngle = 0.6;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe3e6ec, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(-6, 12, 10);
    scene.add(sun);

    const steps = new THREE.Group();
    scene.add(steps);
    const markers = new THREE.Group();
    scene.add(markers);
    const mkMarker = (color: number) => {
      const g = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 10), new THREE.MeshStandardMaterial({ color }));
      stem.position.y = 0.65;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25 }));
      head.position.y = 1.4;
      g.add(stem, head);
      markers.add(g);
      return g;
    };
    const pool = mkMarker(0x1e3a5f);
    const alone = mkMarker(0x9aa3b0);
    let xOf = (_q: number) => 0, yOf = (_q: number) => 0;
    let targetPool = new THREE.Vector3(), targetAlone = new THREE.Vector3();
    const labels: { el: HTMLDivElement; pos: THREE.Vector3 }[] = [];

    const sync = (p: Props) => {
      steps.clear();
      labels.forEach((l) => l.el.remove());
      labels.length = 0;
      const ts = [...p.tiers].sort((a, b) => a.min_qty - b.min_qty);
      if (!ts.length) return;
      const top = Math.max(p.maxQty, ts[ts.length - 1].min_qty * 1.35);
      const s = (q: number) => Math.sqrt(Math.max(0, q) / top);
      xOf = (q: number) => -SPAN / 2 + s(q) * SPAN;
      const maxP = ts[0].unit.minor;
      const minP = ts[ts.length - 1].unit.minor;
      const h = (minor: number) => 0.7 + ((minor - minP * 0.85) / (maxP - minP * 0.85 || 1)) * 2.6;
      const reached = [...ts].reverse().find((t) => p.qty >= t.min_qty);
      yOf = (q: number) => {
        const t = [...ts].reverse().find((x) => q >= x.min_qty);
        return t ? h(t.unit.minor) : 0.05;
      };
      // Below-MOQ zone.
      const w0 = xOf(ts[0].min_qty) - xOf(0);
      const below = new THREE.Mesh(new THREE.BoxGeometry(w0, 0.06, DEPTH), new THREE.MeshStandardMaterial({ color: 0xfdecee }));
      below.position.set(xOf(0) + w0 / 2, 0.03, 0);
      steps.add(below);
      ts.forEach((t, i) => {
        const x0 = xOf(t.min_qty), x1 = xOf(ts[i + 1]?.min_qty ?? top);
        const hh = h(t.unit.minor);
        const isReached = reached?.min_qty === t.min_qty;
        const passed = reached && t.min_qty < reached.min_qty;
        const color = isReached ? 0x15803d : passed ? 0xc9ced6 : 0xeef0f3;
        const block = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 0.06, hh, DEPTH),
          new THREE.MeshStandardMaterial({ color, roughness: 0.55, emissive: isReached ? 0x15803d : 0x000000, emissiveIntensity: isReached ? 0.12 : 0 }));
        block.position.set((x0 + x1) / 2, hh / 2, 0);
        steps.add(block);
        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(block.geometry), new THREE.LineBasicMaterial({ color: 0x141414, transparent: true, opacity: isReached ? 0.5 : 0.15 }));
        edge.position.copy(block.position);
        steps.add(edge);
        const el = document.createElement("div");
        el.className = `pointer-events-none absolute left-0 top-0 whitespace-nowrap text-center text-[10.5px] leading-tight ${isReached ? "font-semibold text-verified" : "text-ink-3"}`;
        el.innerHTML = `<div class="num text-[15px] ${isReached ? "text-verified" : "text-ink"}">${p.fmtPrice(t.unit.minor)}</div><div>${p.fmtQty(t.min_qty)}+</div>`;
        overlay.current?.appendChild(el);
        labels.push({ el, pos: new THREE.Vector3((x0 + x1) / 2, hh + 0.75, DEPTH / 2) });
      });
      targetPool = new THREE.Vector3(xOf(Math.min(p.qty, top)), yOf(p.qty), DEPTH * 0.18);
      alone.visible = p.own != null && p.own !== p.qty;
      if (p.own != null) targetAlone = new THREE.Vector3(xOf(Math.min(p.own, top)), yOf(p.own), -DEPTH * 0.18);
    };

    return {
      sync,
      update: (t, dt) => {
        pool.position.lerp(targetPool, Math.min(1, dt * 5));
        alone.position.lerp(targetAlone, Math.min(1, dt * 5));
        pool.children[1].position.y = 1.4 + Math.sin(t * 2.4) * 0.06;
        for (const l of labels) {
          const sp = toScreen(l.pos, ctx);
          if (sp) l.el.style.transform = `translate(${sp.x}px, ${sp.y}px) translate(-50%, -100%)`;
        }
      },
      dispose: () => labels.forEach((l) => l.el.remove()),
    };
  }, { tiers, qty, own, maxQty, height, fmtPrice, fmtQty });

  return (
    <div className="relative overflow-hidden" style={{ height }}>
      <div ref={host} className="absolute inset-0" />
      <div ref={overlay} className="pointer-events-none absolute inset-0" />
    </div>
  );
}
