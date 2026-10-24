import { AnimatePresence, motion } from "framer-motion";
import L from "leaflet";
import { CircleAlert, CircleCheck, CircleX, Crosshair, MapPin, Pause, Play, Plane } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "../i18n";
import { api, dataUrl, type ClaimT, type FlagT, type GroundT } from "../lib/api";
import { RED, ROLE_COLOR } from "../lib/visual";
import { EvidenceChips } from "./FindingCards";

const SiteFlyover = lazy(() => import("./SiteFlyover"));

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ROLE_TEXT: Record<string, { ja: string; en: string }> = {
  registered: { ja: "登記上の本店", en: "Registered office" },
  gst_ppob: { ja: "GST事業所", en: "GST place of business" },
  claimed_site: { ja: "主張拠点", en: "Claimed site" },
};
const GROUND_RULES = ["GROUND_NO_BUILDING", "GROUND_AFTER_CLAIMED_YEAR", "GROUND_AREA_MISMATCH", "GROUND_LOW_ACTIVITY", "ADDRESS_MISMATCH"];

function pinIcon(color: string, big = false) {
  const s = big ? 22 : 16;
  return L.divIcon({
    className: "",
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    html: `<div style="width:${s}px;height:${s}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 17);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points).pad(0.3));
  }, [map, points]);
  return null;
}

/** Crossfading yearly Sentinel-2 frames with the measured footprint drawn once the building exists. */
function TimeLapse({ ground }: { ground: GroundT }) {
  const { lang } = useI18n();
  // Sentinel-2 years, then a final high-resolution "today" frame for the reveal.
  const frames = useMemo(() => {
    const s2 = (ground.frames ?? []).map((f) => ({ ...f, hires: false }));
    if (!ground.current || !s2.length) return s2;
    return [...s2, { year: 9999, path: ground.current.path, scene: ground.current.provider, date: "", cloud: 0, bbox: ground.current.bbox, hires: true }];
  }, [ground.frames, ground.current]);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const played = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const series = ground.buildings?.series ?? [];
  const first = ground.buildings?.first_year_built ?? null;
  const footprint = ground.osm?.nearest?.footprint ?? ground.osm?.footprints?.[0]?.footprint ?? null;

  useEffect(() => {
    if (!box.current || played.current) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !played.current) {
        played.current = true;
        setI(0);
        setPlaying(true);
      }
    }, { threshold: 0.5 });
    io.observe(box.current);
    return () => io.disconnect();
  }, [frames.length]);

  useEffect(() => {
    if (!playing) return;
    if (i >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setI((x) => x + 1), i === 0 ? 1100 : i === frames.length - 2 ? 1500 : 950);
    return () => clearTimeout(t);
  }, [playing, i, frames.length]);

  if (!frames.length) {
    return <div className="grid aspect-square place-items-center rounded-xl border border-line bg-stage text-sm text-muted">{lang === "ja" ? "衛星画像なし" : "No satellite scenes"}</div>;
  }
  const f = frames[i];
  const [b0, b1, b2, b3] = f.bbox;
  const toXY = (lat: number, lon: number) => [((lon - b0) / (b2 - b0)) * 100, ((b3 - lat) / (b3 - b1)) * 100];
  const site = ground.site!;
  const [sx, sy] = toXY(site.lat, site.lon);
  const bufferPct = ((ground.buffer_m ?? 150) / ((b3 - b1) * 110540)) * 100;
  const built = (year: number) => {
    const row = series.find((r) => r.year === year);
    if (row) return row.built_area_m2 >= 100;
    if (first != null) return year >= first;
    return !series.length; // no history: draw today's footprint on every frame
  };
  const latestArea = series.length ? series[series.length - 1].built_area_m2 : ground.osm?.total_area_m2 ?? null;
  const areaThisYear = series.find((r) => r.year === f.year)?.built_area_m2 ?? (f.year > 2023 ? latestArea : null);

  return (
    <div ref={box} className="relative overflow-hidden rounded-xl bg-ink">
      <div className="relative aspect-square w-full">
        <AnimatePresence initial={false}>
          <motion.img key={f.year} src={dataUrl(f.path)} alt={`Sentinel-2 ${f.year}`} className="absolute inset-0 h-full w-full object-cover"
            initial={{ opacity: 0, scale: 1.035 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.75, ease: "easeOut" }} />
        </AnimatePresence>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <circle cx={sx} cy={sy} r={bufferPct} fill="none" stroke="#fff" strokeWidth={0.35} strokeDasharray="1.2 1" vectorEffect="non-scaling-stroke" />
          {footprint && built(f.year) && (
            <motion.polygon initial={{ opacity: 0 }} animate={{ opacity: 1 }} points={footprint.map(([la, lo]) => toXY(la, lo).join(",")).join(" ")}
              fill="rgba(227,18,43,0.45)" stroke={RED} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          )}
          <circle cx={sx} cy={sy} r={0.9} fill={RED} stroke="#fff" strokeWidth={0.4} />
        </svg>
        <div className="absolute left-3 top-3">
          <div className="num text-[56px] leading-none text-white drop-shadow">{f.hires ? (lang === "ja" ? "現在" : "TODAY") : f.year}</div>
          <div className="mt-1 rounded bg-ink/70 px-2 py-0.5 text-[10.5px] text-white/85 backdrop-blur">
            {f.hires ? (lang === "ja" ? "高解像度画像（Esri World Imagery）" : "High-resolution imagery (Esri World Imagery)") : `Sentinel-2 L2A · ${f.date} · ☁ ${f.cloud}%`}
          </div>
        </div>
        <div className="absolute right-3 top-3 rounded-lg bg-paper/95 px-2.5 py-1.5 text-right shadow-lift">
          <div className="label">{lang === "ja" ? "建築面積" : "Built area"}</div>
          <div className="num text-[24px] leading-none text-ink">{areaThisYear == null ? "—" : `${areaThisYear.toLocaleString()} m²`}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-ink px-3 py-2.5">
        <button className="grid h-7 w-7 place-items-center rounded-full bg-white text-ink" onClick={() => { if (i >= frames.length - 1) setI(0); setPlaying((p) => !p); }} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <input type="range" min={0} max={frames.length - 1} value={i} onChange={(e) => { setPlaying(false); setI(Number(e.target.value)); }}
          className="flex-1 accent-[#E3122B]" aria-label="Year" />
        <div className="flex gap-1.5">
          {frames.map((fr, k) => (
            <button key={fr.year} onClick={() => { setPlaying(false); setI(k); }}
              className={`num text-[13px] ${k === i ? "text-hinomaru" : built(fr.year) && footprint ? "text-white" : "text-white/40"}`}>
              {fr.hires ? (lang === "ja" ? "今" : "now") : String(fr.year).slice(2)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Props {
  invId: number;
  ground: GroundT;
  flags: FlagT[];
  claims: ClaimT[];
  onEvidence: (ev: string) => void;
  onUpdated?: () => void;
  compact?: boolean;
}

export default function GroundTruthPanel({ invId, ground, flags, claims, onEvidence, onUpdated, compact = false }: Props) {
  const { lang, pick, t } = useI18n();
  const [adjust, setAdjust] = useState(false);
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [saving, setSaving] = useState(false);
  const [flyover, setFlyover] = useState(false);
  const [allPins, setAllPins] = useState(false);
  const site = ground.site;
  const addresses = ground.addresses ?? [];
  const points = useMemo(() => addresses.map((a) => [a.lat, a.lon] as [number, number]), [addresses]);
  const groundFlags = flags.filter((f) => GROUND_RULES.includes(f.rule_id));
  const groundClaimNodes = new Set((ground.claim_verdicts ?? []).map((v) => v.claim_node));
  const groundClaims = claims.filter((c) => c.node && groundClaimNodes.has(c.node));
  const series = ground.buildings?.series ?? [];
  const claimed = ground.claimed?.area_m2 ?? null;
  const lights = ground.nightlights;
  const approx = site && ["locality", "pin_code"].includes(site.precision);
  const measured = ground.buildings?.latest_area_m2 ?? (ground.osm?.count ? ground.osm.total_area_m2 : null);
  const verified = !groundFlags.some((f) => f.rule_id !== "ADDRESS_MISMATCH") && measured != null && measured >= 100;

  if (!site) {
    return <div className="panel p-5 text-sm text-muted">{lang === "ja" ? "住所をジオコーディングできなかったため、現地確認は未実施です。" : "No address could be geocoded, so the ground checks did not run."}</div>;
  }

  const confirm = async () => {
    if (!pin) return;
    setSaving(true);
    try {
      await api.confirmPin(invId, site.role, pin[0], pin[1]);
      setAdjust(false);
      onUpdated?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="jp text-[22px] font-bold tracking-tight text-ink">{t("ground.header")}</h2>
          <p className="text-[12.5px] text-ink-3">{t("ground.tagline")}</p>
        </div>
        <div className="flex items-center gap-2">
          {verified ? (
            <span className="chip bg-verified-soft text-verified"><CircleCheck size={13} /> {lang === "ja" ? "拠点の実在を確認" : "Site verified"}</span>
          ) : (
            <span className="chip bg-hinomaru-soft text-hinomaru"><CircleX size={13} /> {groundFlags.length} {lang === "ja" ? "件の現地指摘" : "ground findings"}</span>
          )}
          {approx && <span className="chip bg-amber-soft text-amber">{lang === "ja" ? "概略位置" : "approximate location"}</span>}
          <button className="btn-ink !py-1.5 text-xs" onClick={() => setFlyover(true)}><Plane size={14} /> {t("report.flyover")}</button>
        </div>
      </div>

      <div className={`grid gap-4 ${compact ? "grid-cols-1" : "lg:grid-cols-[1.05fr_1fr]"}`}>
        <TimeLapse ground={ground} />
        <div className="flex flex-col gap-3">
          <div className="relative h-[300px] overflow-hidden rounded-xl border border-line">
            <MapContainer center={[site.lat, site.lon]} zoom={16} scrollWheelZoom={false} className="h-full w-full" attributionControl={false}>
              <TileLayer url={ESRI} maxZoom={19} />
              <FitBounds points={adjust || !allPins ? [[site.lat, site.lon]] : points} />
              <Circle center={[site.lat, site.lon]} radius={ground.buffer_m ?? 150} pathOptions={{ color: "#fff", weight: 1.5, dashArray: "5 5", fillOpacity: 0.06 }} />
              {(ground.osm?.footprints ?? []).slice(0, 30).map((fp) => (
                <Polygon key={fp.osm_id} positions={fp.footprint as [number, number][]} pathOptions={{ color: RED, weight: 1.5, fillOpacity: 0.25 }} />
              ))}
              {addresses.map((a) => (
                <Marker key={a.role} position={[a.lat, a.lon]} icon={pinIcon(ROLE_COLOR[a.role] ?? "#141414", a.role === site.role)}>
                  <Tooltip direction="top" offset={[0, -8]}>{pick(ROLE_TEXT[a.role]?.ja, ROLE_TEXT[a.role]?.en)} · {a.state}</Tooltip>
                </Marker>
              ))}
              {adjust && (
                <Marker position={pin ?? [site.lat, site.lon]} draggable icon={pinIcon("#E3122B", true)}
                  eventHandlers={{ dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); setPin([ll.lat, ll.lng]); } }} />
              )}
            </MapContainer>
            <div className="no-print absolute bottom-2 left-2 z-[500] flex gap-1.5">
              {addresses.length > 1 && !adjust && (
                <button className="btn-ghost !py-1 text-xs shadow-card" onClick={() => setAllPins((v) => !v)}>
                  <MapPin size={13} /> {allPins ? (lang === "ja" ? "拠点に戻る" : "Back to site") : lang === "ja" ? `全${addresses.length}拠点` : `All ${addresses.length} pins`}
                </button>
              )}
              {!adjust ? (
                <button className="btn-ghost !py-1 text-xs shadow-card" onClick={() => { setAdjust(true); setPin([site.lat, site.lon]); }}>
                  <Crosshair size={13} /> {lang === "ja" ? "ピンを調整" : "Adjust pin"}
                </button>
              ) : (
                <>
                  <button className="btn-red !py-1 text-xs" disabled={saving} onClick={confirm}>{saving ? "…" : lang === "ja" ? "この位置で確定" : "Confirm pin"}</button>
                  <button className="btn-ghost !py-1 text-xs" onClick={() => setAdjust(false)}>{lang === "ja" ? "取消" : "Cancel"}</button>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {addresses.map((a) => (
              <div key={a.role} className="rounded-lg border border-line p-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: ROLE_COLOR[a.role] }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: ROLE_COLOR[a.role] }} /> {pick(ROLE_TEXT[a.role]?.ja, ROLE_TEXT[a.role]?.en)}
                </div>
                <div className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-ink-2">{a.address}</div>
                <div className="mt-1 font-mono text-[10px] text-muted">{a.state} · {a.precision} · {a.provider}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`grid gap-4 ${compact ? "grid-cols-1" : "lg:grid-cols-3"}`}>
        <div className="panel p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[13px] font-semibold">{lang === "ja" ? "建築面積の推移" : "Built area by year"}</h3>
            <span className="font-mono text-[10px] text-muted">{ground.buildings?.status === "ok" ? "Open Buildings 2.5D" : "OSM (today)"}</span>
          </div>
          {series.length ? (
            <div className="mt-2 h-[150px]">
              <ResponsiveContainer>
                <BarChart data={series} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#EDEEF1" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#7A808C" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#7A808C" }} tickLine={false} axisLine={false} domain={[0, Math.ceil((Math.max(claimed ?? 0, ...series.map((s) => s.built_area_m2)) * 1.08) / 500) * 500]} />
                  <RTooltip formatter={(v: number) => [`${v.toLocaleString()} m²`, lang === "ja" ? "建築面積" : "Built area"]} />
                  <Bar dataKey="built_area_m2" fill="#141414" radius={[3, 3, 0, 0]} />
                  {claimed && <ReferenceLine y={claimed} stroke={RED} strokeDasharray="5 4" label={{ value: `${lang === "ja" ? "主張" : "claimed"} ${Math.round(claimed).toLocaleString()} m²`, fontSize: 10, fill: RED, position: "insideTopRight" }} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-3 text-[12px] text-ink-3">
              <div className="num text-[30px] leading-none text-ink">{(ground.osm?.total_area_m2 ?? 0).toLocaleString()} m²</div>
              <p className="mt-1">{ground.osm?.count ?? 0} {lang === "ja" ? "棟の建物（OSM、現在）" : "footprints mapped today (OSM)"}</p>
              <p className="mt-2 rounded-md bg-amber-soft px-2 py-1.5 text-[11px] text-amber">
                {lang === "ja" ? "年次の建物履歴：保留（Earth Engine未接続）。" : "Year-by-year history: pending (Earth Engine not connected)."}
              </p>
            </div>
          )}
          <EvidenceChips ids={[ground.buildings?.series?.length ? ground.buildings.evidence_id : ground.osm?.evidence_id].filter(Boolean) as string[]} onEvidence={onEvidence} />
        </div>
        <div className="panel p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[13px] font-semibold">{lang === "ja" ? "夜間光（拠点 vs 周辺）" : "Night lights (site vs surroundings)"}</h3>
            <span className="font-mono text-[10px] text-muted">VIIRS</span>
          </div>
          {lights?.series?.length ? (
            <>
              <div className="mt-2 h-[118px]">
                <ResponsiveContainer>
                  <LineChart data={lights.series} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                    <XAxis dataKey="month" hide />
                    <YAxis tick={{ fontSize: 10, fill: "#7A808C" }} tickLine={false} axisLine={false} />
                    <RTooltip />
                    <Line type="monotone" dataKey="site" stroke={RED} strokeWidth={2} dot={false} name={lang === "ja" ? "拠点" : "site"} />
                    <Line type="monotone" dataKey="ring" stroke="#9AA0AB" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name={lang === "ja" ? "周辺1–2km" : "1–2 km ring"} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="num text-[26px] leading-none">{lights.activity_ratio?.toFixed(2)}</span>
                <span className="text-[11px] text-muted">{lang === "ja" ? "活動比率（拠点÷周辺）" : "activity ratio (site ÷ ring)"}</span>
              </div>
            </>
          ) : (
            <p className="mt-3 rounded-md bg-amber-soft px-2 py-1.5 text-[11px] text-amber">{lang === "ja" ? "夜間光：保留（Earth Engine未接続）。" : "Night lights: pending (Earth Engine not connected)."}</p>
          )}
          <EvidenceChips ids={[lights?.evidence_id].filter(Boolean) as string[]} onEvidence={onEvidence} />
        </div>
        <div className="panel overflow-hidden">
          {ground.current ? (
            <>
              <img src={dataUrl(ground.current.path)} alt="Current satellite image" className="aspect-[4/3] w-full object-cover" />
              <div className="p-3">
                <div className="text-[12px] font-semibold">{lang === "ja" ? "現在の衛星画像" : "Current imagery"}</div>
                {ground.caption && <p className="mt-1 text-[12px] text-ink-2">“{ground.caption}” <span className="text-muted">· {lang === "ja" ? "AIキャプション（説明のみ）" : "AI caption: descriptive only"}</span></p>}
                <p className="mt-1 text-[10px] text-muted">{ground.current.attribution}</p>
              </div>
            </>
          ) : (
            <p className="p-4 text-sm text-muted">{lang === "ja" ? "現在の画像なし" : "No current image"}</p>
          )}
        </div>
      </div>

      <div className={`grid gap-2 ${compact ? "grid-cols-1" : "md:grid-cols-2"}`}>
        {groundFlags.map((f, k) => (
          <div key={k} className="flex gap-3 rounded-lg border border-line bg-paper p-3 shadow-card">
            {f.severity === "low" ? <CircleAlert className="mt-0.5 shrink-0 text-amber" size={18} /> : <CircleX className="mt-0.5 shrink-0 text-hinomaru" size={18} />}
            <div className="min-w-0">
              <p className={`text-[13px] leading-snug ${lang === "ja" ? "jp" : ""}`}>{pick(f.text_ja, f.text_en)}</p>
              <div className="font-mono text-[10px] text-muted">{f.rule_id}</div>
              <EvidenceChips ids={f.evidence_ids} onEvidence={onEvidence} />
            </div>
          </div>
        ))}
        {groundClaims.map((c, k) => (
          <div key={`c${k}`} className="flex gap-3 rounded-lg border border-line bg-paper p-3 shadow-card">
            {c.verdict === "verified" ? <CircleCheck className="mt-0.5 shrink-0 text-verified" size={18} /> : <CircleX className="mt-0.5 shrink-0 text-hinomaru" size={18} />}
            <div className="min-w-0">
              <p className="text-[13px] font-medium">“{c.text}”</p>
              <p className={`text-[12px] leading-snug text-ink-3 ${lang === "ja" ? "jp" : ""}`}>{pick(c.explanation_ja, c.explanation_en)}</p>
              <EvidenceChips ids={c.evidence_ids} onEvidence={onEvidence} />
            </div>
          </div>
        ))}
        {verified && !groundFlags.length && (
          <div className="flex gap-3 rounded-lg border border-line bg-verified-soft p-3">
            <CircleCheck className="mt-0.5 shrink-0 text-verified" size={18} />
            <p className="text-[13px] text-ink">{lang === "ja" ? `拠点周辺に${(measured ?? 0).toLocaleString()}㎡の建物を確認しました。` : `${(measured ?? 0).toLocaleString()} m² of buildings confirmed at the site.`}</p>
          </div>
        )}
      </div>
      <p className="text-[10.5px] text-muted">{t("ground.limits")}</p>

      {flyover && (
        <Suspense fallback={null}>
          <SiteFlyover ground={ground} flagged={groundFlags.some((f) => f.rule_id.startsWith("GROUND_"))} onClose={() => setFlyover(false)} />
        </Suspense>
      )}
    </section>
  );
}
