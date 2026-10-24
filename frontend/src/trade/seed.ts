/** Illustrative trade data. Every company, price, quote and order here is fictional and labelled ILLUSTRATIVE. */
import { major, m } from "./money";
import type { FreightInput, Persona, PersonaId, Pool, PortId, Product, Supplier } from "./types";

export const DAY = 86_400_000;

export const PERSONAS: Record<PersonaId, Persona> = {
  buyerA: { id: "buyerA", role: "buyer", name: "Tanaka Seiko K.K.", name_ja: "田中精工株式会社", city: "Nagoya, Aichi", city_ja: "愛知県名古屋市" },
  buyerB: { id: "buyerB", role: "buyer", name: "Hokuriku Kikai Co., Ltd.", name_ja: "北陸機械株式会社", city: "Kanazawa, Ishikawa", city_ja: "石川県金沢市" },
  buyerC: { id: "buyerC", role: "buyer", name: "Setouchi Pump Works", name_ja: "瀬戸内ポンプ製作所", city: "Okayama", city_ja: "岡山県岡山市" },
  buyerD: { id: "buyerD", role: "buyer", name: "Kanto Assembly Co.", name_ja: "関東アセンブリー株式会社", city: "Saitama", city_ja: "埼玉県" },
  supplier: { id: "supplier", role: "supplier", name: "Deccan Fasteners Pvt Ltd", name_ja: "デカン・ファスナーズ", city: "Chakan, Pune", city_ja: "プネ（チャカン）", supplierId: "s_deccan" },
  ops: { id: "ops", role: "ops", name: "Shinrai Operations", name_ja: "信頼 オペレーション", city: "Tokyo", city_ja: "東京" },
};
export const SWITCHABLE: PersonaId[] = ["buyerA", "buyerB", "buyerC", "supplier", "ops"];

export const PORTS: Record<PortId, { name: string; name_ja: string; lat: number; lon: number }> = {
  INNSA: { name: "Nhava Sheva (JNPT)", name_ja: "ナバシェバ（JNPT）", lat: 18.95, lon: 72.95 },
  INMAA: { name: "Chennai", name_ja: "チェンナイ", lat: 13.08, lon: 80.29 },
  JPYOK: { name: "Yokohama", name_ja: "横浜", lat: 35.45, lon: 139.65 },
  JPUKB: { name: "Kobe", name_ja: "神戸", lat: 34.68, lon: 135.2 },
  JPNGO: { name: "Nagoya", name_ja: "名古屋", lat: 35.08, lon: 136.88 },
};

const iso = (d: number) => new Date(d).toISOString().slice(0, 10);

export function makeSuppliers(now: number): Supplier[] {
  const recent = iso(now - 9 * DAY);
  return [
    {
      id: "s_deccan", name: "Deccan Fasteners Pvt Ltd", name_ja: "デカン・ファスナーズ社", cin: "U28992MH2009PTC19XXXX", state: "Maharashtra", city: "Chakan, Pune",
      lat: 18.76, lon: 73.86, since: 2009, employees: "120–150", capabilities: ["Cold forging", "Thread rolling", "SS304/316", "Passivation"],
      languages: ["English", "Hindi", "Marathi"], exportExperience: "direct",
      investigation: {
        score: 86, band: "low", flags: { high: 0, critical: 0, medium: 1 }, checked_at: recent, mode: "ILLUSTRATIVE",
        checks: [
          { id: "registry", status: "pass", note_en: "Active since 2009 · filings current", note_ja: "2009年から有効・申告は最新", checked_at: recent },
          { id: "gst", status: "pass", note_en: "GSTIN active, state code 27 matches", note_ja: "GSTIN有効・州コード27一致", checked_at: recent },
          { id: "iec", status: "pass", note_en: "IEC on record (self-declared, document seen)", note_ja: "IEC登録あり（書類確認済）" },
          { id: "network", status: "pass", note_en: "3 directors · no struck-off links", note_ja: "取締役3名・抹消会社との関係なし" },
          { id: "legal", status: "warn", note_en: "1 civil case as respondent (commercial, 2024)", note_ja: "被告として民事1件（2024年）" },
          { id: "ground", status: "pass", note_en: "Plant footprint 4,100 m² visible since 2016", note_ja: "工場面積4,100m²を2016年から確認" },
          { id: "cert", status: "pass", note_en: "ISO 9001:2015 valid, scope covers manufacture", note_ja: "ISO 9001:2015有効・製造範囲" },
          { id: "audit", status: "not_checked", note_en: "No Genba audit yet", note_ja: "現地監査は未実施" },
        ],
      },
      readiness: { iec: "pass", lut: "pass", adBank: "pass", icegate: "pass", coo: "pass" }, is_demo: true,
    },
    {
      id: "s_kaveri", name: "Kaveri Precision Engineering Pvt Ltd", name_ja: "カーヴェリ精密工業", cin: "U29XXXKA2014PTC07XXXX", state: "Karnataka", city: "Hosur road, Bengaluru",
      lat: 12.84, lon: 77.66, since: 2014, employees: "60–80", capabilities: ["CNC turning", "Gear hobbing", "EN8/EN19", "Induction hardening"],
      languages: ["English", "Kannada", "Tamil"], exportExperience: "indirect",
      investigation: {
        score: 72, band: "standard", flags: { high: 0, critical: 0, medium: 3 }, checked_at: iso(now - 21 * DAY), mode: "ILLUSTRATIVE", demoScenario: "kaveri precision",
        checks: [
          { id: "registry", status: "warn", note_en: "Active · annual filings overdue", note_ja: "有効・年次申告が遅延" },
          { id: "gst", status: "pass", note_en: "GSTIN active", note_ja: "GSTIN有効" },
          { id: "iec", status: "not_checked", note_en: "IEC not provided", note_ja: "IEC未提出" },
          { id: "network", status: "warn", note_en: "A director holds 11 directorships", note_ja: "取締役の兼任11社" },
          { id: "legal", status: "warn", note_en: "2 pending cases as respondent", note_ja: "被告として係争中2件" },
          { id: "ground", status: "not_checked", note_en: "Site not checked", note_ja: "現地は未確認" },
          { id: "cert", status: "not_checked", note_en: "No certificate submitted", note_ja: "認証の提出なし" },
          { id: "audit", status: "not_checked", note_en: "No Genba audit", note_ja: "現地監査なし" },
        ],
      },
      readiness: { iec: "not_checked", lut: "not_checked", adBank: "pass", icegate: "not_checked", coo: "not_checked" }, is_demo: true,
    },
    {
      id: "s_coromandel", name: "Coromandel Castings LLP", name_ja: "コロマンデル鋳造", cin: "AAX-XXXX (LLP)", state: "Tamil Nadu", city: "Coimbatore",
      lat: 11.02, lon: 76.96, since: 2018, employees: "unknown", capabilities: ["Grey iron FC250", "Sand casting", "Machining (outsourced)"],
      languages: ["English", "Tamil"], exportExperience: "none", investigation: null,
      readiness: { iec: "not_checked", lut: "not_checked", adBank: "not_checked", icegate: "not_checked", coo: "not_checked" }, is_demo: true,
    },
    {
      id: "s_sunrise", name: "Sunrise Auto Components Pvt Ltd", name_ja: "サンライズ・オートコンポーネンツ", cin: "U29304HR2023PTC110482", state: "Haryana", city: "Gurugram",
      lat: 28.41, lon: 77.04, since: 2023, employees: "claims 450", capabilities: ["Claims: forging, machining"], languages: ["English", "Hindi"], exportExperience: "none",
      investigation: {
        score: 22, band: "high", flags: { high: 6, critical: 1, medium: 7 }, checked_at: iso(now - 2 * DAY), mode: "ILLUSTRATIVE", demoScenario: "sunrise auto components",
        checks: [
          { id: "registry", status: "warn", note_en: "Incorporated 2023, ₹1 lakh capital, filings overdue", note_ja: "2023年設立・資本金₹1 lakh・申告遅延" },
          { id: "gst", status: "fail", note_en: "GST registration cancelled (2024)", note_ja: "GST登録取消（2024年）" },
          { id: "network", status: "fail", note_en: "Director linked to 2 struck-off companies", note_ja: "取締役が抹消会社2社に関与" },
          { id: "claims", status: "fail", note_en: "6 brochure claims contradicted", note_ja: "会社資料の主張6件が矛盾" },
          { id: "ground", status: "fail", note_en: "Claimed 50,000 sq ft factory; 353 m² shed built 2022", note_ja: "主張4,600m²工場→実測353m²（2022年建築）" },
          { id: "legal", status: "pass", note_en: "No insolvency found", note_ja: "倒産手続なし" },
        ],
      },
      readiness: { iec: "fail", lut: "not_checked", adBank: "not_checked", icegate: "not_checked", coo: "not_checked" }, is_demo: true,
    },
  ];
}

const inr = (v: string) => major(v, "INR");

export const PRODUCTS: Product[] = [
  {
    id: "p_bolt_m8", supplierId: "s_deccan", title_en: "Hex bolt M8×30, SUS304, ISO 4017", title_ja: "六角ボルト M8×30 SUS304（ISO 4017）", category: "fasteners",
    spec: { Material: "SUS304 (A2-70)", Standard: "ISO 4017 / DIN 933", Size: "M8 × 30 mm", Finish: "Plain, passivated", Packing: "Carton 1,000 pcs" },
    hs_proposed: "7318.15", hs_status: "unverified", unit: "pcs", unitLabel_ja: "個", moq: 10_000, lead_days: 35, incoterm: "FOB Nhava Sheva", originPort: "INNSA",
    tiers: [{ min_qty: 10_000, unit: inr("14.50") }, { min_qty: 25_000, unit: inr("13.20") }, { min_qty: 50_000, unit: inr("12.10") }, { min_qty: 100_000, unit: inr("11.40") }],
    poolable: true, kgPerUnit: 0.0157, cbmPerUnit: 0.000011, certs: [{ standard: "ISO 9001:2015", status: "register_verified", valid_until: "2027-08-31", issuer: "IAF-accredited CB" }, { standard: "Mill test certificate EN 10204 3.1", status: "claimed" }],
    dutyRatePct: "0.0", is_demo: true,
  },
  {
    id: "p_nut_m8", supplierId: "s_deccan", title_en: "Hex nut M8, SUS304, ISO 4032", title_ja: "六角ナット M8 SUS304（ISO 4032）", category: "fasteners",
    spec: { Material: "SUS304 (A2-70)", Standard: "ISO 4032 / DIN 934", Size: "M8", Finish: "Plain, passivated", Packing: "Carton 2,000 pcs" },
    hs_proposed: "7318.16", hs_status: "unverified", unit: "pcs", unitLabel_ja: "個", moq: 20_000, lead_days: 30, incoterm: "FOB Nhava Sheva", originPort: "INNSA",
    tiers: [{ min_qty: 20_000, unit: inr("4.80") }, { min_qty: 50_000, unit: inr("4.10") }, { min_qty: 150_000, unit: inr("3.70") }],
    poolable: true, kgPerUnit: 0.0052, cbmPerUnit: 0.000004, certs: [{ standard: "ISO 9001:2015", status: "register_verified", valid_until: "2027-08-31" }], dutyRatePct: "0.0", is_demo: true,
  },
  {
    id: "p_shaft", supplierId: "s_kaveri", title_en: "Transmission shaft, EN19, per customer drawing", title_ja: "トランスミッションシャフト EN19（図面指定）", category: "machined",
    spec: { Material: "EN19 (≈ SCM440)", Process: "CNC turning, induction hardened", Tolerance: "Per drawing (h6 journals)", Packing: "VCI wrap, wooden crate" },
    hs_proposed: "8483.10", hs_status: "unverified", unit: "sets", unitLabel_ja: "セット", moq: 500, lead_days: 55, incoterm: "FOB Chennai", originPort: "INMAA",
    tiers: [{ min_qty: 500, unit: inr("1840.00") }, { min_qty: 2_000, unit: inr("1625.00") }],
    poolable: false, poolable_reason_en: "Made to each buyer's drawing — specifications cannot be pooled.", poolable_reason_ja: "顧客図面ごとの製作のため、共同発注の対象外です。",
    kgPerUnit: 3.1, cbmPerUnit: 0.0021, certs: [{ standard: "ISO 9001:2015", status: "claimed" }], dutyRatePct: "0.0", is_demo: true,
  },
  {
    id: "p_housing", supplierId: "s_coromandel", title_en: "Pump housing casting, FC250 (grey iron), raw", title_ja: "ポンプハウジング鋳物 FC250（未加工）", category: "castings",
    spec: { Material: "Grey iron FC250 / IS 210 FG260", Weight: "4.2 kg ± 3%", Pattern: "Shared standard pattern PH-40", Packing: "Pallet 120 pcs" },
    hs_proposed: "7325.10", hs_status: "unverified", unit: "pcs", unitLabel_ja: "個", moq: 1_000, lead_days: 45, incoterm: "FOB Chennai", originPort: "INMAA",
    tiers: [{ min_qty: 1_000, unit: inr("410.00") }, { min_qty: 3_000, unit: inr("365.00") }, { min_qty: 6_000, unit: inr("338.00") }],
    poolable: true, kgPerUnit: 4.2, cbmPerUnit: 0.0035, certs: [{ standard: "ISO 9001:2015", status: "claimed" }], dutyRatePct: "0.0", is_demo: true,
  },
  {
    id: "p_flange", supplierId: "s_sunrise", title_en: "Forged flange (claimed), CS A105", title_ja: "鍛造フランジ（自己申告）CS A105", category: "machined",
    spec: { Material: "A105 (claimed)", Standard: "ASME B16.5 (claimed)" }, hs_proposed: "7307.91", hs_status: "unverified", unit: "pcs", unitLabel_ja: "個",
    moq: 2_000, lead_days: 40, incoterm: "FOB Nhava Sheva", originPort: "INNSA", tiers: [{ min_qty: 2_000, unit: inr("290.00") }], poolable: false,
    poolable_reason_en: "Supplier is not eligible: high-risk verification result.", poolable_reason_ja: "検証結果が高リスクのため対象外です。",
    kgPerUnit: 1.9, cbmPerUnit: 0.0012, certs: [{ standard: "ISO 9001", status: "contradicted" }], dutyRatePct: "0.0", is_demo: true,
  },
];

const yen = (n: number) => m(n, "JPY");
/** Illustrative forwarder / broker inputs. Not market quotes. */
export const FREIGHT_NSA_YOK: FreightInput = {
  perCbm: yen(14_000), minCbm: 1, cfsPerCbm: yen(6_500), brokerPerDeclaration: yen(11_800), domesticDelivery: yen(18_000),
  insurancePct: "0.30", bankFeePerRemittance: yen(4_000), intermediaryFee: yen(2_500),
};
export const FREIGHT_MAA_UKB_UNQUOTED: FreightInput = { ...FREIGHT_NSA_YOK, perCbm: null, intermediaryFee: null };

export function makePools(now: number): Pool[] {
  const h = 3_600_000;
  return [
    {
      id: "pool_bolt", productId: "p_bolt_m8", organiser: "buyerB", destPort: "JPYOK", incoterm: "FOB Nhava Sheva", windowStart: iso(now + 40 * DAY), windowEnd: iso(now + 75 * DAY),
      opensAt: now - 4 * DAY, closesAt: now + 6 * DAY + 5 * h, minQty: 50_000, maxQty: 120_000, state: "OPEN", quotes: [], freight: FREIGHT_NSA_YOK, sharedFreight: true, is_demo: true,
      members: [
        { persona: "buyerB", qty: 18_000, ceiling: inr("13.00"), state: "COMMITTED", at: now - 4 * DAY },
        { persona: "buyerC", qty: 25_000, ceiling: inr("12.80"), state: "COMMITTED", at: now - 2 * DAY },
        { persona: "buyerD", qty: 8_000, ceiling: null, state: "INTERESTED", at: now - 1 * DAY },
      ],
    },
    {
      id: "pool_nut", productId: "p_nut_m8", organiser: "buyerC", destPort: "JPYOK", incoterm: "FOB Nhava Sheva", windowStart: iso(now + 30 * DAY), windowEnd: iso(now + 60 * DAY),
      opensAt: now - 12 * DAY, closesAt: now + 20 * h, minQty: 50_000, maxQty: 200_000, state: "OPEN", quotes: [], freight: FREIGHT_NSA_YOK, sharedFreight: false, is_demo: true,
      members: [
        { persona: "buyerC", qty: 16_000, ceiling: inr("4.30"), state: "COMMITTED", at: now - 12 * DAY },
        { persona: "buyerD", qty: 15_000, ceiling: inr("4.20"), state: "COMMITTED", at: now - 6 * DAY },
      ],
    },
    {
      id: "pool_housing", productId: "p_housing", organiser: "buyerC", destPort: "JPUKB", incoterm: "FOB Chennai", windowStart: iso(now + 50 * DAY), windowEnd: iso(now + 90 * DAY),
      opensAt: now - 1 * DAY, closesAt: now + 14 * DAY, minQty: 3_000, maxQty: 9_000, state: "OPEN", quotes: [], freight: FREIGHT_MAA_UKB_UNQUOTED, sharedFreight: false, is_demo: true,
      members: [{ persona: "buyerC", qty: 1_200, ceiling: inr("380.00"), state: "COMMITTED", at: now - 1 * DAY }],
    },
  ];
}
