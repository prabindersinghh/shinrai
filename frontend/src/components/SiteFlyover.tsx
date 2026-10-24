import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { api, type GroundT } from "../lib/api";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const TOKYO = { lon: 139.7671, lat: 35.6812 };
const M_PER_DEG_LAT = 110540;

function square(lat: number, lon: number, sideM: number): number[] {
  const dLat = sideM / 2 / M_PER_DEG_LAT;
  const dLon = sideM / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lon - dLon, lat - dLat, lon + dLon, lat - dLat, lon + dLon, lat + dLat, lon - dLon, lat + dLat];
}

interface Props {
  ground: GroundT;
  flagged: boolean;
  onClose: () => void;
}

/** Tokyo → partner site flight with the measured building against a ghost box of the claimed size. */
export default function SiteFlyover({ ground, flagged, onClose }: Props) {
  const { lang } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"google" | "imagery" | null>(null);
  const [phase, setPhase] = useState<"flying" | "orbit">("flying");

  useEffect(() => {
    let viewer: Cesium.Viewer | null = null;
    let disposed = false;
    let removeOrbit: (() => void) | null = null;
    const site = ground.site!;

    (async () => {
      const cfg = await api.publicConfig().catch(() => ({ google_maps_key: null, cesium_ion_token: null }));
      if (disposed || !host.current) return;
      Cesium.Ion.defaultAccessToken = cfg.cesium_ion_token ?? "";
      viewer = new Cesium.Viewer(host.current, {
        baseLayer: new Cesium.ImageryLayer(new Cesium.UrlTemplateImageryProvider({ url: ESRI, maximumLevel: 19, credit: "Esri, Maxar, Earthstar Geographics" })),
        baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false, navigationHelpButton: false,
        animation: false, timeline: false, fullscreenButton: false, infoBox: false, selectionIndicator: false,
      });
      viewer.scene.globe.enableLighting = false;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
      let base = 0;
      if (cfg.google_maps_key) {
        try {
          Cesium.GoogleMaps.defaultApiKey = cfg.google_maps_key;
          const tiles = await Cesium.createGooglePhotorealistic3DTileset();
          viewer.scene.primitives.add(tiles);
          viewer.scene.globe.show = false;
          setMode("google");
          const [c] = await viewer.scene.sampleHeightMostDetailed([Cesium.Cartographic.fromDegrees(site.lon, site.lat)]);
          base = c?.height ?? 0;
        } catch {
          viewer.scene.globe.show = true;
          setMode("imagery");
        }
      } else {
        setMode("imagery");
      }
      if (disposed) return;

      const height = Math.max(ground.buildings?.latest_height_m || 0, 6);
      const footprint = ground.osm?.nearest?.footprint ?? ground.osm?.footprints?.[0]?.footprint;
      const measuredColor = flagged ? Cesium.Color.fromCssColorString("#E3122B").withAlpha(0.88) : Cesium.Color.WHITE.withAlpha(0.92);
      if (footprint) {
        viewer.entities.add({
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(footprint.flatMap(([la, lo]) => [lo, la])),
            height: base, extrudedHeight: base + height, material: measuredColor, outline: true, outlineColor: Cesium.Color.WHITE,
          },
        });
      }
      const claimed = ground.claimed?.area_m2;
      if (claimed) {
        const side = Math.sqrt(claimed);
        const shiftLon = (side / 2 + 25) / (111320 * Math.cos((site.lat * Math.PI) / 180));
        const ghost = square(site.lat, site.lon + shiftLon, side);
        viewer.entities.add({
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(ghost), height: base, extrudedHeight: base + 12,
            material: Cesium.Color.WHITE.withAlpha(0.16), outline: true, outlineColor: Cesium.Color.fromCssColorString("#E3122B"),
          },
        });
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(site.lon + shiftLon, site.lat, base + 18),
          label: {
            text: lang === "ja" ? `主張：${Math.round(claimed / 0.092903).toLocaleString()} 平方フィート` : `Claimed: ${Math.round(claimed / 0.092903).toLocaleString()} sq ft`,
            font: "600 15px Inter", fillColor: Cesium.Color.WHITE, showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString("#E3122B"), disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      }
      const measured = ground.buildings?.latest_area_m2 ?? ground.osm?.nearest?.area_m2;
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(site.lon, site.lat, base + height + 10),
        label: {
          text: lang === "ja" ? `実測：${(measured ?? 0).toLocaleString()} ㎡` : `Measured: ${(measured ?? 0).toLocaleString()} m²`,
          font: "600 15px Inter", fillColor: Cesium.Color.fromCssColorString("#141414"), showBackground: true,
          backgroundColor: Cesium.Color.WHITE, disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      for (const a of ground.addresses ?? []) {
        const color = a.role === "claimed_site" ? "#E3122B" : a.role === "gst_ppob" ? "#5B8DEF" : "#141414";
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(a.lon, a.lat, base + 2),
          point: { pixelSize: 13, color: Cesium.Color.fromCssColorString(color), outlineColor: Cesium.Color.WHITE, outlineWidth: 3, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        });
      }

      viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(TOKYO.lon, TOKYO.lat, 1_400_000) });
      const target = Cesium.Cartesian3.fromDegrees(site.lon, site.lat, base);
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(site.lon - 0.0035, site.lat - 0.0045, base + 420),
        orientation: { heading: Cesium.Math.toRadians(30), pitch: Cesium.Math.toRadians(-38), roll: 0 },
        duration: 6.2, maximumHeight: 4_500_000, easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        complete: () => {
          if (!viewer || disposed) return;
          setPhase("orbit");
          let heading = Cesium.Math.toRadians(30);
          const range = 520;
          removeOrbit = viewer.scene.preRender.addEventListener(() => {
            heading += 0.0018;
            viewer!.camera.lookAt(target, new Cesium.HeadingPitchRange(heading, Cesium.Math.toRadians(-34), range));
          });
        },
      });
    })();

    return () => {
      disposed = true;
      removeOrbit?.();
      viewer?.destroy();
    };
  }, [ground, flagged, lang]);

  return (
    <motion.div className="fixed inset-0 z-[60] bg-ink" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div ref={host} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between bg-gradient-to-b from-ink/80 to-transparent p-5 text-white">
        <div>
          <div className="jp text-[20px] font-bold">現地現物 · {lang === "ja" ? "3Dフライオーバー" : "3D Site Flyover"}</div>
          <div className="text-[12px] text-white/70">
            {phase === "flying" ? (lang === "ja" ? "東京 → 拠点へ移動中" : "Tokyo → partner site") : ground.site?.address}
          </div>
          <div className="mt-2 flex gap-2 text-[11px]">
            <span className="chip bg-white/15 text-white">{mode === "google" ? "Google Photorealistic 3D Tiles" : "Esri World Imagery globe"}</span>
            <span className="chip bg-hinomaru text-white">{lang === "ja" ? "赤：実測の建物 / 枠：主張された規模" : "Solid: measured building · Outline: claimed size"}</span>
          </div>
        </div>
        <button onClick={onClose} className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-white text-ink" aria-label="Close"><X size={18} /></button>
      </div>
    </motion.div>
  );
}
