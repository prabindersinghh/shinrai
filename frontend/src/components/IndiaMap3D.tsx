import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface MapState {
  fit: number;
  support: number;
  white_space: number;
  is_white_space: boolean;
  rank: number;
}
export interface SupportPin {
  id: string;
  name: string;
  kind: "jetro" | "consulate" | "jit" | "agency";
  lat: number;
  lon: number;
}
export type MapLayer = "fit" | "whitespace" | "support";

interface Props {
  scores: Record<string, MapState>;
  layer: MapLayer;
  pins: SupportPin[];
  selected?: string | null;
  onSelect?: (state: string) => void;
  onHover?: (state: string | null) => void;
  height?: number | string;
  autoRotate?: boolean;
}

interface Geo {
  states: { code: string; name: string; rings: number[][][] }[];
}

const LON0 = 82.5;
const LAT0 = 22.5;
const COS = Math.cos((LAT0 * Math.PI) / 180);
const project = (lon: number, lat: number) => new THREE.Vector2((lon - LON0) * COS, lat - LAT0);
const BASE = 0.08;
const MAX = 3.2;

const FIT_LOW = new THREE.Color("#DCE3EC");
const FIT_HIGH = new THREE.Color("#1E3A5F");
const WS_LOW = new THREE.Color("#FBE7CF");
const WS_HIGH = new THREE.Color("#D97706");
const MUTED = new THREE.Color("#ECEDF0");
const RED = new THREE.Color("#E3122B");

function colourFor(s: MapState | undefined, layer: MapLayer): THREE.Color {
  if (!s) return MUTED.clone();
  if (layer === "whitespace") return s.is_white_space ? WS_LOW.clone().lerp(WS_HIGH, 0.55 + s.white_space / 100) : FIT_LOW.clone().lerp(FIT_HIGH, 0.12);
  if (layer === "support") return FIT_LOW.clone().lerp(new THREE.Color("#2BB3A3"), s.support / 100);
  return FIT_LOW.clone().lerp(FIT_HIGH, Math.min(1, Math.max(0, (s.fit - 35) / 45)));
}

function heightFor(s: MapState | undefined, layer: MapLayer): number {
  if (!s) return BASE;
  const v = layer === "whitespace" ? s.white_space * 2.2 : layer === "support" ? s.support : s.fit;
  return BASE + (Math.max(0, v) / 100) * MAX;
}

/** Extruded 3D India: each state rises by its score as results stream in. */
export default function IndiaMap3D({ scores, layer, pins, selected, onSelect, onHover, height = 560, autoRotate = true }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const api = useRef<{
    meshes: Map<string, THREE.Mesh>;
    outlines: Map<string, THREE.LineSegments>;
    centres: Map<string, THREE.Vector3>;
    target: Map<string, number>;
    pinGroup: THREE.Group;
    controls: OrbitControls;
  } | null>(null);
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const propsRef = useRef({ scores, layer, selected, onSelect, onHover });
  propsRef.current = { scores, layer, selected, onSelect, onHover };

  // Scene set-up, once.
  useEffect(() => {
    const el = host.current!;
    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
    camera.position.set(0, -50, 30);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 18;
    controls.maxDistance = 80;
    controls.maxPolarAngle = Math.PI * 0.44;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.35;
    controls.target.set(0, 1.5, 0);
    const stop = () => (controls.autoRotate = false);
    renderer.domElement.addEventListener("pointerdown", stop);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe3ea, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.35);
    sun.position.set(-18, -22, 40);
    sun.castShadow = true;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.04;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.ShadowMaterial({ opacity: 0.12 }));
    ground.position.z = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    const world = new THREE.Group();
    scene.add(world);
    const pinGroup = new THREE.Group();
    world.add(pinGroup);
    const meshes = new Map<string, THREE.Mesh>();
    const outlines = new Map<string, THREE.LineSegments>();
    const centres = new Map<string, THREE.Vector3>();
    const target = new Map<string, number>();

    fetch("/india_states.json")
      .then((r) => r.json())
      .then((geo: Geo) => {
        if (disposed) return;
        for (const st of geo.states) {
          const shapes = st.rings.map((ring) => new THREE.Shape(ring.map(([lon, lat]) => project(lon, lat))));
          const geom = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 1 });
          const mat = new THREE.MeshStandardMaterial({ color: MUTED, roughness: 0.82, metalness: 0.02 });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.scale.z = BASE;
          mesh.userData.name = st.name;
          world.add(mesh);
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 30), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
          edges.scale.z = BASE;
          world.add(edges);
          meshes.set(st.name, mesh);
          outlines.set(st.name, edges);
          geom.computeBoundingBox();
          const c = new THREE.Vector3();
          geom.boundingBox!.getCenter(c);
          centres.set(st.name, c);
          target.set(st.name, BASE);
        }
        api.current = { meshes, outlines, centres, target, pinGroup, controls };
        applyScores();
        setReady(true);
      });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hovered: string | null = null;
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObjects([...meshes.values()], false)[0];
      const name = (hit?.object.userData.name as string) ?? null;
      if (name !== hovered) {
        hovered = name;
        propsRef.current.onHover?.(name);
        renderer.domElement.style.cursor = name ? "pointer" : "grab";
      }
      setHover(name ? { name, x: e.clientX - r.left, y: e.clientY - r.top } : null);
    };
    const onClick = () => hovered && propsRef.current.onSelect?.(hovered);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("click", onClick);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const tmp = new THREE.Vector3();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      for (const [name, mesh] of meshes) {
        const t = target.get(name) ?? BASE;
        const z = mesh.scale.z + (t - mesh.scale.z) * 0.08;
        mesh.scale.z = z;
        outlines.get(name)!.scale.z = z;
      }
      controls.update();
      renderer.render(scene, camera);
      // Rank badges follow the top three states.
      const box = labels.current;
      if (box) {
        for (const child of Array.from(box.children) as HTMLElement[]) {
          const name = child.dataset.state!;
          const c = centres.get(name);
          const mesh = meshes.get(name);
          if (!c || !mesh) continue;
          tmp.set(c.x, c.y, mesh.scale.z + 0.35).project(camera);
          child.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * el.clientWidth}px, ${(-tmp.y * 0.5 + 0.5) * el.clientHeight}px) translate(-50%, -100%)`;
          child.style.opacity = tmp.z < 1 ? "1" : "0";
        }
      }
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyScores() {
    const a = api.current;
    if (!a) return;
    const { scores: sc, layer: ly, selected: sel } = propsRef.current;
    for (const [name, mesh] of a.meshes) {
      const s = sc[name];
      a.target.set(name, heightFor(s, ly));
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(colourFor(s, ly));
      mat.emissive.copy(name === sel ? new THREE.Color("#3a0a10") : new THREE.Color(0x000000));
      const line = a.outlines.get(name)!.material as THREE.LineBasicMaterial;
      const top3 = s && s.rank <= 3 && ly === "fit";
      line.color.copy(top3 || name === sel ? RED : new THREE.Color(0xffffff));
      line.opacity = top3 || name === sel ? 1 : 0.85;
    }
  }

  useEffect(() => {
    applyScores();
  }, [scores, layer, selected, ready]);

  // Support-network pins and coverage rings.
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    a.pinGroup.clear();
    if (layer !== "support" && layer !== "whitespace") return;
    const colour = { jetro: 0xe3122b, consulate: 0x141414, jit: 0x2bb3a3, agency: 0x5b8def };
    for (const p of pins) {
      const xy = project(p.lon, p.lat);
      const top = BASE + (layer === "support" ? 2.2 : 1.2);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, top, 8), new THREE.MeshStandardMaterial({ color: 0x9aa0ab }));
      stem.rotation.x = Math.PI / 2;
      stem.position.set(xy.x, xy.y, top / 2);
      const head = new THREE.Mesh(
        p.kind === "jit" ? new THREE.OctahedronGeometry(0.22) : new THREE.SphereGeometry(0.2, 18, 18),
        new THREE.MeshStandardMaterial({ color: colour[p.kind], emissive: colour[p.kind], emissiveIntensity: 0.25 }),
      );
      head.position.set(xy.x, xy.y, top);
      head.castShadow = true;
      a.pinGroup.add(stem, head);
      if (layer === "support" && (p.kind === "jetro" || p.kind === "consulate")) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.7, 64), new THREE.MeshBasicMaterial({ color: colour[p.kind], transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
        ring.position.set(xy.x, xy.y, 0.02);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(2.65, 64), new THREE.MeshBasicMaterial({ color: colour[p.kind], transparent: true, opacity: 0.05 }));
        disc.position.set(xy.x, xy.y, 0.015);
        a.pinGroup.add(ring, disc);
      }
    }
  }, [pins, layer, ready]);

  const ranked = Object.entries(scores).filter(([, s]) => s.rank <= 3).sort((a, b) => a[1].rank - b[1].rank);
  const hs = hover ? scores[hover.name] : null;

  return (
    <div className="relative w-full overflow-hidden" style={{ height }}>
      <div ref={host} className="absolute inset-0" />
      <div ref={labels} className="pointer-events-none absolute inset-0">
        {layer === "fit" && ranked.map(([name, s]) => (
          <div key={name} data-state={name} className="absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-white shadow-lift">
            <span className="num text-[14px] text-hinomaru">{s.rank}</span> {name}
          </div>
        ))}
      </div>
      {hover && (
        <div className="pointer-events-none absolute z-10 rounded-lg border border-line bg-paper/95 px-3 py-2 text-[12px] shadow-lift backdrop-blur"
          style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 14 }}>
          <div className="font-semibold">{hover.name}</div>
          {hs ? (
            <div className="mt-0.5 font-mono text-[11px] text-ink-2">fit {hs.fit} · support {hs.support}{hs.is_white_space ? " · white space" : ""}</div>
          ) : (
            <div className="mt-0.5 text-[11px] text-muted">Not yet profiled</div>
          )}
        </div>
      )}
    </div>
  );
}
