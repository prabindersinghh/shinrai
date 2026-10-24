import type { Risk, Severity } from "./api";

/** Soft, distinct community colours. Red is never used here: red means risk. */
export const COMMUNITY = [
  "#5B8DEF", "#2BB3A3", "#9B7BEA", "#E59A3C", "#3FA7D6", "#7FB069",
  "#D97AB0", "#8C9BAB", "#C9A227", "#4F6D7A", "#B07C5B", "#6C8EBF",
];

export const RED = "#E3122B";
export const INK = "#141414";
export const AMBER = "#D97706";
export const GREEN = "#15803D";
export const MUTED = "#7A808C";

export function communityColor(c?: number | null): string {
  return c == null ? "#AEB3BD" : COMMUNITY[c % COMMUNITY.length];
}

export function riskIsRed(r: Risk): boolean {
  return r === "high" || r === "critical";
}

export const BAND: Record<string, { ja: string; en: string; color: string; soft: string }> = {
  low: { ja: "低リスク", en: "Low risk", color: GREEN, soft: "#E9F7EE" },
  standard: { ja: "標準", en: "Standard", color: INK, soft: "#F1F2F4" },
  caution: { ja: "要注意", en: "Caution", color: AMBER, soft: "#FEF5E6" },
  high: { ja: "高リスク", en: "High risk", color: RED, soft: "#FDECEE" },
  insufficient: { ja: "確認不足", en: "Insufficient data", color: MUTED, soft: "#F1F2F4" },
};

export const SEVERITY: Record<Severity, { ja: string; en: string; color: string; soft: string }> = {
  critical: { ja: "重大", en: "Critical", color: "#9F0A1C", soft: "#FDECEE" },
  high: { ja: "高", en: "High", color: RED, soft: "#FDECEE" },
  medium: { ja: "中", en: "Medium", color: AMBER, soft: "#FEF5E6" },
  low: { ja: "低", en: "Low", color: "#5C616C", soft: "#F1F2F4" },
};

export const FAMILY: Record<string, { ja: string; en: string }> = {
  identity: { ja: "実在性", en: "Identity" },
  compliance: { ja: "コンプライアンス", en: "Compliance" },
  legal: { ja: "法的リスク", en: "Legal" },
  network: { ja: "ネットワーク", en: "Network" },
  claims: { ja: "主張整合性", en: "Claims" },
  reputation: { ja: "評判", en: "Reputation" },
  ground: { ja: "現地", en: "Ground" },
  money: { ja: "資金", en: "Money" },
  audit: { ja: "現地監査", en: "Field audit" },
};

/** The seven sub-scores on the radar (money and audit appear once their data exists). */
export const RADAR_FAMILIES = ["identity", "compliance", "legal", "network", "claims", "reputation", "ground"];

export const MODE: Record<string, { label: string; cls: string }> = {
  live: { label: "LIVE", cls: "bg-hinomaru text-white" },
  cached: { label: "CACHED", cls: "bg-ink text-white" },
  seed: { label: "SEED", cls: "bg-stage text-ink-2 ring-1 ring-line" },
  local: { label: "LOCAL", cls: "bg-stage text-ink-2 ring-1 ring-line" },
  upload: { label: "DOC", cls: "bg-stage text-ink-2 ring-1 ring-line" },
  user: { label: "USER", cls: "bg-stage text-ink-2 ring-1 ring-line" },
  field: { label: "FIELD", cls: "bg-verified text-white" },
  none: { label: "N/A", cls: "bg-stage text-muted ring-1 ring-line" },
  failed: { label: "N/A", cls: "bg-stage text-muted ring-1 ring-line" },
};

export const ADAPTER_LABEL: Record<string, string> = {
  mca_ogd: "MCA",
  mca_directors: "DIN",
  gst: "GST",
  gstin_local: "GSTIN",
  courts: "eCourts",
  ibbi: "IBBI",
  strikeoff: "Sec 248",
  news: "News",
  document: "Doc",
  geocode: "Geo",
  imagery_current: "Imagery",
  imagery_timelapse: "Sentinel-2",
  buildings_temporal: "Buildings",
  osm_buildings: "OSM",
  nightlights: "VIIRS",
  aa_gst: "AA · GST",
  genba_audit: "Audit",
};

export const ROLE_COLOR: Record<string, string> = {
  registered: "#141414",
  gst_ppob: "#5B8DEF",
  claimed_site: RED,
};

export function fmtInr(n?: number | null): string {
  if (n == null) return "—";
  if (n >= 1e7) return `₹${(n / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 })} cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 1 })} lakh`;
  return `₹${n.toLocaleString("en-IN")}`;
}
