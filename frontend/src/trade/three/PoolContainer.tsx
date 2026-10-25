import { useRef } from "react";
import * as THREE from "three";
import { easeOutBack, toScreen, useScene } from "./useScene";

export interface CrateSegment {
  key: string;
  qty: number;
  kind: "mine" | "other" | "interested";
}
interface Props {
  capacity: number; // pool max quantity
  threshold: number; // pool minimum (≥ MOQ)
  segments: CrateSegment[];
  reached: boolean;
  thresholdLabel: string;
  height?: number;
}

const NX = 10, NZ = 4, NY = 4, SLOTS = NX * NY * NZ;
const L = 12, W = 4.6, H = 4.6; // container interior
const CS = { x: L / NX, y: H / NY, z: W / NZ };
const COLORS = { mine: new THREE.Color("#1E3A5F"), other: new THREE.Color("#C8A97E"), interested: new THREE.Color("#FFFFFF") };

function slotPos(i: number): THREE.Vector3 {
  const layer = Math.floor(i / (NX * NZ));
  const r = i % (NX * NZ);
  const x = Math.floor(r / NZ), z = r % NZ;
  return new THREE.Vector3(-L / 2 + CS.x * (x + 0.5), CS.y * (layer + 0.5), -W / 2 + CS.z * (z + 0.5));
}

/** A 20-ft container that fills crate by crate as buyers commit. Each crate ≈ capacity / 160 units. */
export default function PoolContainer({ capacity, threshold, segments, reached, thresholdLabel, height = 380 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLDivElement>(null);

  useScene<Props>(host, (ctx) => {
    const { scene, camera, controls, renderer } = ctx;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    camera.position.set(13, 9.5, 15);
    controls.target.set(0, 2, 0);
    controls.minDistance = 12;
    controls.maxDistance = 34;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.autoRotate = !ctx.reducedMotion;
    controls.autoRotateSpeed = 0.5;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe3ea, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(10, 18, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.ShadowMaterial({ opacity: 0.12 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Container shell: floor, back + far side walls with corrugation, corner posts, roof rails (open cut-away).
    const steel = new THREE.MeshStandardMaterial({ color: 0xdfe3e9, roughness: 0.6, metalness: 0.2 });
    const steelDark = new THREE.MeshStandardMaterial({ color: 0x9aa3b0, roughness: 0.5, metalness: 0.3 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(L + 0.4, 0.2, W + 0.4), new THREE.MeshStandardMaterial({ color: 0xb8916a, roughness: 0.9 }));
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);
    const wall = (w: number, h: number, pos: THREE.Vector3, rotY: number, ribs: number) => {
      const g = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), steel);
      panel.receiveShadow = true;
      g.add(panel);
      for (let i = 0; i < ribs; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(w / ribs / 2.4, h * 0.94, 0.12), steelDark);
        rib.position.set(-w / 2 + (w / ribs) * (i + 0.5), 0, 0.02);
        g.add(rib);
      }
      g.position.copy(pos);
      g.rotation.y = rotY;
      scene.add(g);
    };
    wall(L + 0.4, H + 0.3, new THREE.Vector3(0, H / 2 + 0.05, -W / 2 - 0.2), 0, 22);
    wall(W + 0.4, H + 0.3, new THREE.Vector3(-L / 2 - 0.2, H / 2 + 0.05, 0), Math.PI / 2, 8);
    const post = new THREE.BoxGeometry(0.28, H + 0.4, 0.28);
    for (const [x, z] of [[-L / 2 - 0.2, -W / 2 - 0.2], [L / 2 + 0.2, -W / 2 - 0.2], [-L / 2 - 0.2, W / 2 + 0.2], [L / 2 + 0.2, W / 2 + 0.2]]) {
      const p = new THREE.Mesh(post, steelDark);
      p.position.set(x, H / 2, z);
      p.castShadow = true;
      scene.add(p);
    }
    const rail = (len: number, pos: THREE.Vector3, rotY = 0) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.22, 0.22), steelDark);
      r.position.copy(pos);
      r.rotation.y = rotY;
      scene.add(r);
    };
    rail(L + 0.6, new THREE.Vector3(0, H + 0.25, W / 2 + 0.2));
    rail(L + 0.6, new THREE.Vector3(0, H + 0.25, -W / 2 - 0.2));
    rail(W + 0.6, new THREE.Vector3(L / 2 + 0.2, H + 0.25, 0), Math.PI / 2);
    rail(W + 0.6, new THREE.Vector3(-L / 2 - 0.2, H + 0.25, 0), Math.PI / 2);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(L + 0.4, 0.05, W + 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 }));
    roof.position.y = H + 0.3;
    scene.add(roof);

    // Crates: one instanced mesh for committed crates, one for interest (ghosted).
    const crateGeo = new THREE.BoxGeometry(CS.x * 0.9, CS.y * 0.9, CS.z * 0.9);
    const solid = new THREE.InstancedMesh(crateGeo, new THREE.MeshStandardMaterial({ roughness: 0.75 }), SLOTS);
    solid.castShadow = true;
    solid.receiveShadow = true;
    const ghost = new THREE.InstancedMesh(crateGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.4 }), SLOTS);
    scene.add(solid, ghost);

    // Threshold ring at the layer where the minimum falls.
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xd97706, transparent: true, opacity: 0.9 });
    const ring = new THREE.Group();
    const bar = (len: number, pos: THREE.Vector3, rotY = 0) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), ringMat);
      b.position.copy(pos);
      b.rotation.y = rotY;
      ring.add(b);
    };
    bar(L + 0.9, new THREE.Vector3(0, 0, W / 2 + 0.45));
    bar(L + 0.9, new THREE.Vector3(0, 0, -W / 2 - 0.45));
    bar(W + 0.9, new THREE.Vector3(L / 2 + 0.45, 0, 0), Math.PI / 2);
    bar(W + 0.9, new THREE.Vector3(-L / 2 - 0.45, 0, 0), Math.PI / 2);
    scene.add(ring);

    interface Slot { kind: CrateSegment["kind"]; born: number; key: string }
    let slots: Slot[] = [];
    let ghosts: Slot[] = [];
    let clock = 0;
    let reachedNow = false;
    let ringY = 0;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);

    const sync = (p: Props) => {
      const per = Math.max(1, p.capacity / SLOTS);
      const wanted: Slot[] = [];
      const wantedGhost: Slot[] = [];
      // Others first, then mine on top (so "your" crates are visible), interest as ghosts after.
      const ordered = [...p.segments.filter((s) => s.kind === "other"), ...p.segments.filter((s) => s.kind === "mine")];
      for (const s of ordered) for (let i = 0; i < Math.round(s.qty / per); i++) wanted.push({ kind: s.kind, key: `${s.key}:${i}`, born: 0 });
      for (const s of p.segments.filter((x) => x.kind === "interested")) for (let i = 0; i < Math.round(s.qty / per); i++) wantedGhost.push({ kind: "interested", key: `${s.key}:${i}`, born: 0 });
      const keep = (prev: Slot[], next: Slot[]) => next.slice(0, SLOTS).map((n, i) => (prev[i] && prev[i].key === n.key ? prev[i] : { ...n, born: clock + i * 0.012 }));
      slots = keep(slots, wanted);
      ghosts = keep(ghosts, wantedGhost).slice(0, Math.max(0, SLOTS - slots.length));
      const tIdx = Math.min(SLOTS - 1, Math.ceil(p.threshold / per) - 1);
      ringY = slotPos(Math.max(0, tIdx)).y + CS.y / 2;
      reachedNow = p.reached;
      ringMat.color.set(p.reached ? 0x15803d : 0xd97706);
      if (tag.current) {
        tag.current.textContent = p.thresholdLabel;
        tag.current.dataset.reached = String(p.reached);
      }
    };

    const tmp = new THREE.Vector3();
    return {
      sync,
      update: (t, dt) => {
        clock += dt;
        const place = (mesh: THREE.InstancedMesh, list: Slot[], offset: number) => {
          for (let i = 0; i < SLOTS; i++) {
            const s = list[i];
            if (!s) {
              m4.makeScale(0, 0, 0);
              mesh.setMatrixAt(i, m4);
              continue;
            }
            const age = Math.max(0, Math.min(1, (clock - s.born) / 0.55));
            const target = slotPos(i + offset);
            const y = target.y + (1 - easeOutBack(age)) * 6;
            const pulse = reachedNow && s.kind !== "interested" ? 1 + Math.sin(t * 3 + i * 0.3) * 0.015 : 1;
            sc.setScalar(age === 0 ? 0.001 : pulse);
            m4.compose(tmp.set(target.x, y, target.z), q, sc);
            mesh.setMatrixAt(i, m4);
            if (mesh === solid) mesh.setColorAt(i, COLORS[s.kind]);
          }
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        };
        place(solid, slots, 0);
        place(ghost, ghosts, slots.length);
        ring.position.y += (ringY - ring.position.y) * Math.min(1, dt * 4);
        ringMat.opacity = reachedNow ? 0.95 : 0.55 + 0.4 * Math.abs(Math.sin(t * 2.2));
        const sp = toScreen(new THREE.Vector3(L / 2 + 0.5, ring.position.y, W / 2 + 0.5), ctx);
        if (tag.current && sp) tag.current.style.transform = `translate(${sp.x + 8}px, ${sp.y - 12}px)`;
      },
    };
  }, { capacity, threshold, segments, reached, thresholdLabel, height });

  return (
    <div className="relative overflow-hidden" style={{ height }}>
      <div ref={host} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      <div ref={tag} className="pointer-events-none absolute left-0 top-0 rounded-md bg-amber px-2 py-0.5 text-[11px] font-semibold text-white shadow-lift data-[reached=true]:bg-verified" />
    </div>
  );
}
