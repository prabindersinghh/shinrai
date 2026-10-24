import { useRef } from "react";
import * as THREE from "three";
import { PORTS } from "../seed";
import type { PortId } from "../types";
import { toScreen, useScene } from "./useScene";

export interface GlobeRoute {
  id: string;
  from: PortId;
  to: PortId;
  progress?: number | null; // ship position 0..1 (null = no ship)
  emphasis?: boolean;
}
export interface GlobePin {
  id: string;
  lat: number;
  lon: number;
  label: string;
  tone?: "ink" | "green" | "red" | "amber";
}
interface Props {
  routes: GlobeRoute[];
  pins?: GlobePin[];
  height?: number | string;
  autoRotate?: boolean;
  showPortLabels?: boolean;
}

const R = 10;
const DEG = Math.PI / 180;
export function ll(lat: number, lon: number, r = R): THREE.Vector3 {
  const phi = (90 - lat) * DEG, theta = (lon + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

// Coarse, stylised outlines (lon, lat). Japan is hand-simplified; India comes from public/india_states.json.
const JAPAN: number[][][] = [
  [[130.95, 33.95], [131.45, 34.4], [132.1, 34.85], [132.6, 35.45], [133.3, 35.55], [134.2, 35.55], [135.2, 35.75], [135.95, 35.7], [136.1, 36.25], [136.7, 36.95], [137.3, 36.8], [137.35, 37.5], [138.25, 37.2], [138.6, 37.9], [139.4, 38.15], [139.9, 39.0], [140.0, 39.9], [139.85, 40.6], [140.35, 41.25], [141.2, 41.2], [141.5, 40.6], [141.95, 39.6], [141.6, 38.4], [141.0, 38.25], [141.0, 37.0], [140.75, 36.3], [140.9, 35.7], [140.35, 35.15], [139.85, 34.95], [139.75, 35.3], [139.2, 35.25], [138.85, 34.65], [138.2, 34.6], [137.3, 34.65], [136.85, 34.3], [136.3, 33.75], [135.8, 33.45], [135.2, 33.9], [135.05, 34.3], [135.35, 34.65], [134.7, 34.75], [133.9, 34.45], [133.0, 34.3], [132.3, 33.95], [131.8, 34.0], [131.2, 33.95]],
  [[129.6, 33.3], [130.25, 33.6], [130.95, 33.9], [131.65, 33.5], [131.7, 32.6], [131.35, 31.4], [130.7, 31.0], [130.2, 31.3], [130.15, 32.2], [129.8, 32.6], [129.75, 33.0]],
  [[132.5, 33.25], [132.95, 34.05], [133.8, 34.25], [134.6, 34.15], [134.7, 33.8], [134.2, 33.25], [133.6, 33.4], [133.0, 32.75], [132.5, 32.9]],
  [[140.0, 41.4], [140.2, 42.3], [139.9, 42.6], [140.4, 43.3], [141.35, 43.2], [141.65, 44.3], [141.9, 45.4], [142.6, 44.8], [143.6, 44.2], [144.9, 43.9], [145.35, 43.3], [145.0, 42.95], [143.3, 42.0], [141.95, 42.55], [141.0, 42.3], [140.4, 41.6]],
];
// Sea lane: Arabian Sea → Sri Lanka → Malacca → Singapore → South China Sea → Japan.
const LANE_MID: number[][] = [[75.5, 8.5], [80, 5.6], [86, 5.8], [95, 6.0], [98.5, 4.4], [101, 2.6], [103.8, 1.15], [105.6, 3.0], [109, 8], [113, 13], [117.5, 18.5], [121.2, 22.3], [123.5, 26], [128, 30.2], [131.6, 31.9]];
const START: Record<string, number[][]> = { INNSA: [[72.95, 18.95], [72.2, 15.5]], INMAA: [[80.29, 13.08], [81.6, 9.5]] };
const END: Record<string, number[][]> = {
  JPYOK: [[134.6, 33.2], [138.6, 34.3], [139.65, 35.3]], JPUKB: [[134.9, 33.4], [135.1, 34.2], [135.2, 34.62]], JPNGO: [[134.6, 33.2], [136.9, 34.3], [136.88, 34.95]],
};
function lane(from: PortId, to: PortId): THREE.Vector3[] {
  const start = START[from] ?? START.INNSA;
  const mid = from === "INMAA" ? LANE_MID.slice(2) : LANE_MID;
  return [...start, ...mid, ...(END[to] ?? END.JPYOK)].map(([lon, lat]) => ll(lat, lon, R * 1.012));
}

function inRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const TONES = { ink: "#141414", green: "#15803D", red: "#E3122B", amber: "#D97706" };

/** A white-first dotted globe focused on the India → Japan corridor. Ships move along the lane by order progress. */
export default function TradeGlobe({ routes, pins = [], height = 520, autoRotate = true, showPortLabels = true }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);

  useScene<Props>(host, (ctx) => {
    const { scene, camera, controls } = ctx;
    camera.position.copy(ll(22, 108, 40));
    controls.minDistance = 18;
    controls.maxDistance = 60;
    controls.autoRotate = autoRotate && !ctx.reducedMotion;
    controls.autoRotateSpeed = 0.28;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9dee7, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(-20, 30, 30);
    scene.add(key);

    const world = new THREE.Group();
    scene.add(world);
    world.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 96, 96), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeef1f6, emissiveIntensity: 0.55, roughness: 1, metalness: 0 })));

    // Atmosphere: back-face fresnel glow.
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 64, 64), new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false,
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: "varying vec3 vN; void main(){ float i = pow(0.72 - dot(vN, vec3(0,0,1.0)), 3.0); gl_FragColor = vec4(0.45,0.6,0.88,1.0)*i*0.35; }",
    }));
    scene.add(atmo);

    // Dot field (Fibonacci sphere). Land dots for India and Japan are denser and darker.
    const N = 42000;
    const base: number[] = [], land: number[] = [];
    let rings: number[][][] = JAPAN;
    const build = () => {
      base.length = 0;
      land.length = 0;
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - y * y), th = golden * i;
        const v = new THREE.Vector3(Math.cos(th) * rad, y, Math.sin(th) * rad);
        const lat = Math.asin(v.y) / DEG;
        const lon = ((Math.atan2(v.z, -v.x) / DEG + 540) % 360) - 180;
        const onLand = lon > 60 && lon < 150 && lat > 0 && lat < 47 && rings.some((r) => inRing(lon, lat, r));
        const p = ll(lat, lon, R * 1.002);
        (onLand ? land : base).push(p.x, p.y, p.z);
      }
      baseGeo.setAttribute("position", new THREE.Float32BufferAttribute(base, 3));
      landGeo.setAttribute("position", new THREE.Float32BufferAttribute(land, 3));
    };
    const baseGeo = new THREE.BufferGeometry(), landGeo = new THREE.BufferGeometry();
    world.add(new THREE.Points(baseGeo, new THREE.PointsMaterial({ color: 0xd3d7de, size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.75 })));
    world.add(new THREE.Points(landGeo, new THREE.PointsMaterial({ color: 0x1e3a5f, size: 0.075, sizeAttenuation: true })));
    build();

    const outline = new THREE.LineBasicMaterial({ color: 0x141414, transparent: true, opacity: 0.55 });
    const addOutline = (ring: number[][]) => {
      const pts = ring.filter((_, i) => i % 2 === 0).map(([lon, lat]) => ll(lat, lon, R * 1.004));
      world.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), outline));
    };
    JAPAN.forEach(addOutline);
    let cancelled = false;
    fetch("/india_states.json").then((r) => r.json()).then((geo: { states: { rings: number[][][] }[] }) => {
      if (cancelled) return;
      const india = geo.states.flatMap((s) => s.rings).filter((r) => r.length > 30);
      rings = [...JAPAN, ...india];
      build();
      india.forEach((r) => addOutline(r.filter((_, i) => i % 3 === 0)));
    }).catch(() => undefined);

    // Graticule (subtle).
    const grat = new THREE.LineBasicMaterial({ color: 0xe1e4ea, transparent: true, opacity: 0.7 });
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = Array.from({ length: 121 }, (_, i) => ll(lat, -180 + i * 3, R * 1.001));
      world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), grat));
    }

    // Ports + labels.
    const labelEls = new Map<string, { el: HTMLDivElement; pos: THREE.Vector3 }>();
    const label = (id: string, text: string, pos: THREE.Vector3, cls: string) => {
      const el = document.createElement("div");
      el.className = `pointer-events-none absolute whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold shadow-card ${cls}`;
      el.textContent = text;
      overlay.current?.appendChild(el);
      labelEls.set(id, { el, pos });
    };
    const portGroup = new THREE.Group();
    world.add(portGroup);
    const pulses: THREE.Mesh[] = [];
    for (const [id, p] of Object.entries(PORTS)) {
      const pos = ll(p.lat, p.lon, R * 1.01);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), new THREE.MeshBasicMaterial({ color: id.startsWith("JP") ? 0x141414 : 0x1e3a5f }));
      dot.position.copy(pos);
      portGroup.add(dot);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.2, 32), new THREE.MeshBasicMaterial({ color: 0x1e3a5f, transparent: true, side: THREE.DoubleSide }));
      ring.position.copy(pos);
      ring.lookAt(pos.clone().multiplyScalar(2));
      portGroup.add(ring);
      pulses.push(ring);
      if (showPortLabels && routes.some((r) => r.emphasis && (r.from === id || r.to === id))) label(`port:${id}`, p.name, pos, "bg-white/90 text-ink ring-1 ring-line");
    }

    // Routes: glowing tube + travelling light + ship.
    const routeGroup = new THREE.Group();
    world.add(routeGroup);
    let ships: { mesh: THREE.Group; curve: THREE.CatmullRomCurve3; target: number; cur: number }[] = [];
    let sparks: { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; offset: number }[] = [];
    const pinGroup = new THREE.Group();
    world.add(pinGroup);

    const makeShip = () => {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.2), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5 }));
      g.add(hull);
      const colors = [0xe3122b, 0x1e3a5f, 0xc8a97e, 0x2bb3a3];
      for (let i = 0; i < 4; i++) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.16), new THREE.MeshStandardMaterial({ color: colors[i] }));
        box.position.set(-0.18 + i * 0.11, 0.1, 0);
        g.add(box);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      bridge.position.set(0.24, 0.13, 0);
      g.add(bridge);
      return g;
    };

    const sync = (p: Props) => {
      routeGroup.clear();
      ships = [];
      sparks = [];
      for (const r of p.routes) {
        const curve = new THREE.CatmullRomCurve3(lane(r.from, r.to), false, "centripetal");
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 240, r.emphasis ? 0.045 : 0.028, 8, false),
          new THREE.MeshBasicMaterial({ color: r.emphasis ? 0x1e3a5f : 0x8a96a8, transparent: true, opacity: r.emphasis ? 0.95 : 0.55 }));
        routeGroup.add(tube);
        for (let k = 0; k < (r.emphasis ? 3 : 1); k++) {
          const spark = new THREE.Mesh(new THREE.SphereGeometry(r.emphasis ? 0.085 : 0.06, 12, 12), new THREE.MeshBasicMaterial({ color: 0x5b8def }));
          routeGroup.add(spark);
          sparks.push({ mesh: spark, curve, offset: k / 3 });
        }
        if (r.progress != null) {
          const ship = makeShip();
          routeGroup.add(ship);
          ships.push({ mesh: ship, curve, target: Math.max(0, Math.min(1, r.progress)), cur: 0 });
        }
      }
      pinGroup.clear();
      for (const [id, v] of [...labelEls]) if (id.startsWith("pin:")) { v.el.remove(); labelEls.delete(id); }
      for (const pin of p.pins ?? []) {
        const pos = ll(pin.lat, pin.lon, R * 1.01);
        const col = new THREE.Color(TONES[pin.tone ?? "ink"]);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8), new THREE.MeshBasicMaterial({ color: col }));
        const top = pos.clone().multiplyScalar(1.045);
        stem.position.copy(pos.clone().lerp(top, 0.5));
        stem.lookAt(top);
        stem.rotateX(Math.PI / 2);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), new THREE.MeshBasicMaterial({ color: col }));
        head.position.copy(top);
        pinGroup.add(stem, head);
        if (pin.label) label(`pin:${pin.id}`, pin.label, top, "bg-ink text-white");
      }
    };

    const tmp = new THREE.Vector3();
    return {
      sync,
      update: (t, dt) => {
        pulses.forEach((ring, i) => {
          const k = ((t * 0.6 + i * 0.2) % 1);
          ring.scale.setScalar(1 + k * 2.2);
          (ring.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k);
        });
        for (const s of sparks) s.mesh.position.copy(s.curve.getPointAt(Math.min(0.995, (t * 0.08 + s.offset) % 1)));
        for (const s of ships) {
          s.cur += (s.target - s.cur) * Math.min(1, dt * 1.6);
          const u = Math.max(0.0001, Math.min(0.99, s.cur)); // getPointAt can overshoot near 1 on open curves
          const pos = s.curve.getPointAt(u);
          s.mesh.position.copy(pos.clone().multiplyScalar(1.006));
          s.mesh.up.copy(pos.clone().normalize());
          s.mesh.lookAt(tmp.copy(s.curve.getPointAt(Math.min(0.995, u + 0.002))).multiplyScalar(1.006));
          s.mesh.rotateY(-Math.PI / 2);
          s.mesh.position.add(pos.clone().normalize().multiplyScalar(0.04 * Math.sin(t * 2)));
        }
        // HTML labels, hidden on the far side of the globe.
        const camDir = camera.position.clone().normalize();
        for (const [id, { el, pos }] of labelEls) {
          const world_ = pos.clone().applyMatrix4(world.matrixWorld);
          const facing = world_.clone().normalize().dot(camDir) > 0.15;
          const sp = toScreen(world_, ctx);
          el.style.display = facing && sp ? "block" : "none";
          if (sp) el.style.transform = `translate(${sp.x}px, ${sp.y}px) translate(-50%, ${id.startsWith("port:") ? "40%" : "-130%"})`;
        }
      },
      dispose: () => {
        cancelled = true;
        labelEls.forEach((v) => v.el.remove());
      },
    };
  }, { routes, pins, height, autoRotate, showPortLabels });

  return (
    <div className="relative overflow-hidden" style={{ height }}>
      <div ref={host} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      <div ref={overlay} className="pointer-events-none absolute inset-0 [&>div]:left-0 [&>div]:top-0" />
    </div>
  );
}
