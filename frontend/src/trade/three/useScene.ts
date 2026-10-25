import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface SceneCtx {
  el: HTMLDivElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  reducedMotion: boolean;
}
export interface SceneApi<P> {
  update?: (t: number, dt: number) => void;
  sync?: (props: P) => void;
  dispose?: () => void;
}

/** One WebGL scene per host: resize-aware, paused when off-screen, fully disposed on unmount. */
export function useScene<P>(host: RefObject<HTMLDivElement>, setup: (ctx: SceneCtx) => SceneApi<P>, props: P, opts: { fov?: number } = {}) {
  const api = useRef<SceneApi<P> | null>(null);
  const lastKey = useRef("");

  useEffect(() => {
    const el = host.current!;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      el.dataset.webgl = "unavailable";
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(opts.fov ?? 35, 1, 0.1, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    const stop = () => (controls.autoRotate = false);
    renderer.domElement.addEventListener("pointerdown", stop);

    api.current = setup({ el, scene, camera, renderer, controls, reducedMotion }); // first sync comes from the effect below

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    let raf = 0, last = performance.now();
    const t0 = last;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // rAF timestamps can precede t0 on the first frame; clamp so scenes never see negative time.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = Math.max(last, now);
      if (!visible || document.hidden) return;
      api.current?.update?.(Math.max(0, (now - t0) / 1000), dt);
      controls.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      renderer.domElement.removeEventListener("pointerdown", stop);
      api.current?.dispose?.();
      api.current = null;
      lastKey.current = "";
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync only when data props change (functions are ignored), so per-second re-renders don't rebuild geometry.
  const key = JSON.stringify(props, (_k, v) => (typeof v === "function" ? undefined : v));
  useEffect(() => {
    if (key === lastKey.current) return;
    lastKey.current = key;
    api.current?.sync?.(props);
  });
}

/** Project a world point to CSS pixels inside the host (for HTML labels). Returns null when behind the camera. */
export function toScreen(v: THREE.Vector3, ctx: Pick<SceneCtx, "camera" | "el">): { x: number; y: number } | null {
  const p = v.clone().project(ctx.camera);
  if (p.z > 1) return null;
  return { x: ((p.x + 1) / 2) * ctx.el.clientWidth, y: ((1 - p.y) / 2) * ctx.el.clientHeight };
}

export const easeOutBack = (x: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
