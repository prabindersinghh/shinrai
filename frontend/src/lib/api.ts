// Typed client for the Shinrai backend. All requests go through the Vite proxy at /api.

export type Risk = "none" | "low" | "med" | "high" | "critical";
export type Severity = "low" | "medium" | "high" | "critical";
export type Verdict = "verified" | "contradicted" | "unverifiable" | "pending";

export interface GraphNode {
  id: string;
  type: "company" | "person" | "address" | "gstin" | "case" | "news" | "doc_claim";
  label: string;
  key?: string;
  risk: Risk;
  community?: number | null;
  attrs: Record<string, any>;
}
export interface GraphEdge {
  src: string;
  dst: string;
  type: string;
  attrs?: Record<string, any>;
}
export interface FlagT {
  rule_id: string;
  family: string;
  severity: Severity;
  deduction: number;
  entity_ids: string[];
  evidence_ids: string[];
  text_en: string;
  text_ja: string;
  approximate?: boolean;
}
export interface ClaimT {
  node?: string;
  text: string;
  field: string;
  value?: string;
  verdict: Verdict;
  evidence_ids: string[];
  explanation_en: string;
  explanation_ja: string;
}
export interface EvidenceT {
  ev_id: string;
  adapter: string;
  source_name: string;
  query: Record<string, any>;
  url: string;
  retrieved_at: string;
  mode: string;
  summary: string;
  sha256: string;
  payload?: any;
}
export interface Subscores {
  [family: string]: number | null;
}
export interface Signal {
  id: string;
  level: "low" | "med" | "high";
  text_en: string;
  text_ja: string;
  evidence_ids: string[];
}
export interface Sme {
  id: number;
  name: string;
  name_ja: string;
  industry: string;
  seeking: string;
  target_states: string[];
  deal_band: string;
  risk_appetite: string;
  language: string;
}
export interface Partner {
  id: number;
  sme_id: number;
  input_name: string;
  cin?: string | null;
  gstin?: string | null;
  doc_name?: string | null;
  status: string;
  latest?: { id: number; status: string; overall_score: number | null; band: string | null; mode_used: string; is_demo: boolean; fit_score: number | null } | null;
}
export interface GroundT {
  status?: string;
  site?: { role: string; address: string; node: string; lat: number; lon: number; precision: string; provider: string; state?: string };
  addresses?: { role: string; address: string; node: string; lat: number; lon: number; precision: string; provider: string; state?: string; evidence_id: string }[];
  buffer_m?: number;
  claimed?: { area_m2: number | null; founded_year: number | null; production: boolean };
  current?: { path: string; provider: string; attribution: string; bbox: number[]; half_m: number } | null;
  buildings?: { status: string; mode: string; series: { year: number; built_area_m2: number; mean_height_m: number }[]; first_year_built: number | null; latest_area_m2: number | null; latest_height_m: number | null; evidence_id: string; note?: string | null };
  osm?: { status: string; mode: string; count: number; total_area_m2: number; evidence_id: string; footprints: { osm_id: number; area_m2: number; footprint: number[][]; distance_m: number }[]; nearest?: { osm_id: number; area_m2: number; footprint: number[][] } | null };
  frames?: { year: number; path: string; scene: string; date: string; cloud: number; bbox: number[] }[];
  frames_evidence_id?: string;
  nightlights?: { status: string; series: { month: string; site: number; ring: number }[]; activity_ratio: number | null; slope?: number; evidence_id: string; mode?: string; note?: string };
  claim_verdicts?: { claim_node: string; verdict: Verdict; explanation_en: string; explanation_ja: string; evidence_ids: string[] }[];
  caption?: string | null;
  pins?: Record<string, { lat: number; lon: number }>;
}
export interface MoneyT {
  status?: string;
  months?: { period: string; taxable_turnover: number; tax_paid: number; filed_on: string }[];
  declared_12m?: number;
  claimed_turnover?: number | null;
  evidence_id?: string;
  simulated?: boolean;
  summary?: string;
}
export interface AuditPhotoT {
  id: number;
  path: string;
  sha256: string;
  lat: number | null;
  lon: number | null;
  taken_at: string | null;
  distance_m: number | null;
  location_verified: boolean;
  time_verified: boolean;
  ev_id: string;
}
export interface AuditItemT {
  id: number;
  source: string;
  claim_node: string | null;
  text_en: string;
  text_ja: string;
  status: "pending" | "pass" | "fail" | "unverified";
  note: string;
  photos: AuditPhotoT[];
}
export interface AuditT {
  id: number;
  inv_id: number;
  audit_type: string;
  status: string;
  auditor: { name: string; city: string; languages: string[]; rating: number; audits: number; distance_km?: number };
  window_start: string;
  window_end: string;
  price_jpy: number;
  pin: { lat: number; lon: number; address?: string };
  completed_at?: string | null;
  is_demo: boolean;
  pricing?: { en: string; ja: string; price_jpy: number };
  items: AuditItemT[];
  company?: any;
}
export interface Investigation {
  id: number;
  partner_id: number;
  mode: string;
  mode_used: string;
  status: string;
  started_at: string;
  finished_at?: string | null;
  duration_ms?: number | null;
  overall_score: number | null;
  band: string | null;
  subscores: Subscores;
  fit_score: number | null;
  fit_detail: any;
  company: any;
  narrative: { summary_en?: string; summary_ja?: string; method?: string; suggestions?: { en: string; ja: string }[]; meeting_questions?: { en: string; ja: string }[]; dropped_sentences?: number };
  outlook: Signal[];
  coverage: Record<string, string>;
  is_demo: boolean;
}
export interface Report {
  investigation: Investigation;
  partner: Partner;
  sme: Sme;
  flags: FlagT[];
  claims: ClaimT[];
  evidence: EvidenceT[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  ground: GroundT;
  money: MoneyT;
  audit: AuditT | null;
  consent: { status: string; token: string; decided_at?: string } | null;
  directors: { name: string; din: string | null; companies: string[] }[];
  gst: any[];
  families: Record<string, { cap: number; label_en: string; label_ja: string }>;
  bands: { min: number; id: string; ja: string; en: string }[];
  trace_count: number;
  llm: boolean;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* body was not JSON */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  meta: () => call<{ llm: boolean; earth_engine: boolean; google_maps: boolean; data_gov_in: boolean; steps: { id: string; en: string; ja: string }[] }>("/api/meta"),
  publicConfig: () => call<{ google_maps_key: string | null; cesium_ion_token: string | null }>("/api/config/public"),
  createSme: (body: Partial<Sme>) => call<Sme>("/api/sme", json(body)),
  getSme: (id: number) => call<Sme>(`/api/sme/${id}`),
  listSmes: () => call<Sme[]>("/api/sme"),
  createPartner: (form: FormData) => call<Partner>("/api/partners", { method: "POST", body: form }),
  partners: (smeId: number) => call<Partner[]>(`/api/partners?sme_id=${smeId}`),
  investigate: (partner_id: number, mode = "auto") => call<{ id: number }>("/api/investigations", json({ partner_id, mode })),
  investigation: (id: number) => call<Investigation & { partner: Partner; running: boolean; steps: { id: string; en: string; ja: string }[] }>(`/api/investigations/${id}`),
  report: (id: number) => call<Report>(`/api/investigations/${id}/report`),
  trace: (id: number) => call<any[]>(`/api/investigations/${id}/trace`),
  evidence: (id: number, ev: string) => call<EvidenceT>(`/api/investigations/${id}/evidence/${ev}`),
  compare: (smeId: number) => call<any[]>(`/api/compare?sme_id=${smeId}`),
  confirmPin: (id: number, role: string, lat: number, lon: number) => call<{ overall: number; band: string }>(`/api/investigations/${id}/pin`, json({ role, lat, lon })),
  requestConsent: (id: number) => call<{ token: string; link: string; status: string }>(`/api/investigations/${id}/consent`, { method: "POST" }),
  consent: (token: string) => call<any>(`/api/consent/${token}`),
  decideConsent: (token: string, approve: boolean) => call<{ status: string; overall?: number; band?: string }>(`/api/consent/${token}/decision`, json({ approve })),
  verified: (id: number) => call<any>(`/api/verified/${id}`),
  auditPlan: (id: number) => call<any>(`/api/investigations/${id}/audit-plan`),
  createAudit: (id: number, body: any) => call<AuditT>(`/api/investigations/${id}/audits`, json(body)),
  audit: (auditId: number) => call<AuditT>(`/api/audits/${auditId}`),
  uploadPhoto: (auditId: number, itemId: number, file: File) => {
    const f = new FormData();
    f.append("photo", file);
    return call<AuditPhotoT>(`/api/audits/${auditId}/items/${itemId}/photo`, { method: "POST", body: f });
  },
  itemResult: (auditId: number, itemId: number, status: string, note: string) => call<AuditItemT>(`/api/audits/${auditId}/items/${itemId}/result`, json({ status, note })),
  completeAudit: (auditId: number) => call<any>(`/api/audits/${auditId}/complete`, { method: "POST" }),
  demoAudit: (id: number) => call<any>(`/api/investigations/${id}/audits/demo-complete`, { method: "POST" }),
  ringi: (id: number) => call<any>(`/api/investigations/${id}/ringi`),
  advisor: (smeId: number) => call<any>(`/api/advisor/${smeId}`),
  advisorStep: (smeId: number, step_id: string, status: string) => call<any>(`/api/advisor/${smeId}/step`, json({ step_id, status })),
  clauses: (invId: number) => call<any>(`/api/investigations/${invId}/clauses`),
  demoSetup: () => call<{ sme: Sme; partners: Partner[] }>("/api/demo/setup", { method: "POST" }),
};

export const dataUrl = (path?: string | null) => (path ? `/api/data/${path}` : "");
