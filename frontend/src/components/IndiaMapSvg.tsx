import { useEffect, useState } from "react";

interface Geo {
  states: { code: string; name: string; rings: number[][][] }[];
}

const COS = Math.cos((22.5 * Math.PI) / 180);

/** Static choropleth of India for reports and print (no WebGL). */
export default function IndiaMapSvg({ values, highlight = [], colour = "fit", pins = [], width = 420 }: {
  values: Record<string, number>;
  highlight?: string[];
  colour?: "fit" | "whitespace";
  pins?: { lat: number; lon: number; kind: string }[];
  width?: number;
}) {
  const [geo, setGeo] = useState<Geo | null>(null);
  useEffect(() => {
    fetch("/india_states.json").then((r) => r.json()).then(setGeo);
  }, []);
  if (!geo) return <div style={{ width, height: width * 1.1 }} className="animate-pulse rounded-lg bg-stage" />;
  const x = (lon: number) => (lon - 68) * COS * 26;
  const y = (lat: number) => (37.5 - lat) * 26;
  const fill = (name: string) => {
    const v = values[name];
    if (v == null) return "#ECEDF0";
    const t = Math.max(0, Math.min(1, colour === "fit" ? (v - 35) / 45 : v / 35));
    const [a, b] = colour === "fit" ? [[220, 227, 236], [30, 58, 95]] : [[251, 231, 207], [217, 119, 6]];
    return `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * t)).join(",")})`;
  };
  const W = (97.5 - 68) * COS * 26;
  const H = (37.5 - 6.5) * 26;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={width} role="img" aria-label="Map of India">
      {geo.states.map((s) => (
        <g key={s.code}>
          {s.rings.map((ring, i) => (
            <path key={i} d={"M" + ring.map(([lon, lat]) => `${x(lon).toFixed(1)},${y(lat).toFixed(1)}`).join("L") + "Z"}
              fill={fill(s.name)} stroke={highlight.includes(s.name) ? "#E3122B" : "#FFFFFF"} strokeWidth={highlight.includes(s.name) ? 2.2 : 0.8} />
          ))}
        </g>
      ))}
      {pins.map((p, i) => (
        <circle key={i} cx={x(p.lon)} cy={y(p.lat)} r={p.kind === "jit" ? 3.2 : 4.2}
          fill={p.kind === "jetro" ? "#E3122B" : p.kind === "jit" ? "#2BB3A3" : "#141414"} stroke="#fff" strokeWidth={1.2} />
      ))}
    </svg>
  );
}
