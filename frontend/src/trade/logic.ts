/** Deterministic trade rules: verification badge, pool tiers and compatibility, state-machine tables, landed cost. */
import { add, allocate, convert, m, sub, times, zero, type Money } from "./money";
import { DAY } from "./seed";
import type { MemberState, PayState, PoState, Pool, PoolState, PriceTier, Product, Provenance, Supplier } from "./types";

// ----- verification badge ---------------------------------------------------------------------------------------
export interface Badge {
  level: 0 | 1 | 2 | 3;
  eligible: boolean;
  label_en: string;
  label_ja: string;
  verified_at?: string;
  expires_at?: string;
  mode?: Provenance;
  reasons_en: string[];
  reasons_ja: string[];
}
const LEVELS = [
  ["Listed · not verified", "掲載のみ・未検証"],
  ["Registry-checked", "登記確認済"],
  ["Verified", "検証済"],
  ["Audited", "現地監査済"],
] as const;

/** Mirrors IMPLEMENTATION_CHECKLIST P0-06. Badges expire 180 days after the investigation. */
export function badgeFor(s: Supplier, now: number): Badge {
  const inv = s.investigation;
  const mk = (level: Badge["level"], eligible: boolean, r_en: string[] = [], r_ja: string[] = []): Badge => ({
    level, eligible, label_en: LEVELS[level][0], label_ja: LEVELS[level][1], reasons_en: r_en, reasons_ja: r_ja,
    verified_at: inv?.checked_at, mode: inv?.mode,
    expires_at: inv ? new Date(Date.parse(inv.checked_at) + 180 * DAY).toISOString().slice(0, 10) : undefined,
  });
  if (!inv) return mk(0, true, ["No Shinrai investigation has been run"], ["信頼の調査は未実施です"]);
  if (now > Date.parse(inv.checked_at) + 180 * DAY) return mk(0, true, ["Investigation older than 180 days — expired"], ["調査から180日超のため失効"]);
  const serious = inv.flags.critical + inv.flags.high;
  if (serious > 0)
    return mk(0, false, [`${serious} critical/high finding(s) — not eligible for pools`], [`重大・高リスクの指摘${serious}件のため共同発注の対象外`]);
  const c = (id: string) => inv.checks.find((x) => x.id === id)?.status ?? "not_checked";
  if (inv.band === "insufficient" || !["pass", "warn"].includes(c("registry"))) return mk(0, true, ["Registry not checked"], ["登記未確認"]);
  if (c("registry") !== "pass") return mk(1, true, ["Registry warnings (e.g. overdue filings)"], ["登記上の注意点（申告遅延など）"]);
  if (c("gst") !== "pass") return mk(1, true, ["GST status not confirmed"], ["GST状況が未確認"]);
  if (c("audit") === "pass") return mk(3, true);
  const r_en = inv.flags.medium ? [`${inv.flags.medium} medium finding(s) to review`] : [];
  const r_ja = inv.flags.medium ? [`確認すべき中程度の指摘${inv.flags.medium}件`] : [];
  return mk(2, true, r_en, r_ja);
}

// ----- tiers, compatibility ------------------------------------------------------------------------------------
export function tierFor(tiers: PriceTier[], qty: number): PriceTier | null {
  return [...tiers].sort((a, b) => b.min_qty - a.min_qty).find((t) => qty >= t.min_qty) ?? null;
}
export const committedQty = (p: Pool) => p.members.filter((x) => ["COMMITTED", "ACCEPTED", "ORDERED"].includes(x.state)).reduce((s, x) => s + x.qty, 0);
export const acceptedQty = (p: Pool) => p.members.filter((x) => ["ACCEPTED", "ORDERED"].includes(x.state)).reduce((s, x) => s + x.qty, 0);
export const interestedQty = (p: Pool) => p.members.filter((x) => x.state === "INTERESTED").reduce((s, x) => s + x.qty, 0);
export function memberBucket(n: number): string {
  if (n <= 2) return "1–2";
  if (n <= 5) return "3–5";
  return "6+";
}

export interface CompatInput {
  productId: string;
  incoterm: string;
  destPort: string;
  windowStart: string;
  windowEnd: string;
  certsRequired: string[];
}
/** Compatibility rule (UPGRADE_PLAN §4.3 rule 3). Returns the list of mismatched fields. */
export function compatibility(pool: Pool, product: Product, r: CompatInput): string[] {
  const bad: string[] = [];
  if (r.productId !== pool.productId) bad.push("product");
  if (r.incoterm !== pool.incoterm) bad.push("incoterm");
  if (r.destPort !== pool.destPort) bad.push("destination port");
  const overlap = Math.min(Date.parse(r.windowEnd), Date.parse(pool.windowEnd)) - Math.max(Date.parse(r.windowStart), Date.parse(pool.windowStart));
  if (overlap < 14 * DAY) bad.push("delivery window (needs ≥14 days overlap)");
  const verified = product.certs.filter((c) => c.status === "register_verified").map((c) => c.standard);
  for (const c of r.certsRequired) if (!verified.some((v) => v.startsWith(c))) bad.push(`certification ${c} (not register-verified)`);
  return bad;
}

// ----- state machines (ARCHITECTURE §5) ---------------------------------------------------------------------------
export const POOL_FLOW: Record<PoolState, Partial<Record<string, PoolState>>> = {
  DRAFT: { publish: "OPEN", cancel: "CANCELLED" },
  OPEN: { threshold_met: "QUOTE_PENDING", deadline_unmet: "FAILED_THRESHOLD", cancel: "CANCELLED" },
  QUOTE_PENDING: { quote: "QUOTED", decline: "SUPPLIER_DECLINED" },
  QUOTED: { quote: "QUOTED", open_confirmation: "CONFIRMATION" },
  CONFIRMATION: { quote: "QUOTED", confirm: "CONFIRMED", requote: "REQUOTE", fail: "FAILED_THRESHOLD" },
  REQUOTE: { quote: "QUOTED", decline: "SUPPLIER_DECLINED" },
  CONFIRMED: { close: "CLOSED" },
  CLOSED: {}, FAILED_THRESHOLD: {}, SUPPLIER_DECLINED: {}, CANCELLED: {},
};
export const MEMBER_FLOW: Record<MemberState, Partial<Record<string, MemberState>>> = {
  INTERESTED: { commit: "COMMITTED", withdraw: "WITHDRAWN", lapse: "LAPSED" },
  COMMITTED: { withdraw: "WITHDRAWN", accept: "ACCEPTED", release: "RELEASED", lapse: "LAPSED" },
  ACCEPTED: { requote: "COMMITTED", release: "RELEASED", order: "ORDERED", lapse: "LAPSED" },
  ORDERED: {}, WITHDRAWN: { commit: "COMMITTED" }, RELEASED: {}, LAPSED: {},
};
export const PO_FLOW: Record<PoState, Partial<Record<string, PoState>>> = {
  ISSUED: { supplier_accept: "SUPPLIER_ACCEPTED", cancel: "CANCELLED" },
  SUPPLIER_ACCEPTED: { await_advance: "AWAITING_ADVANCE", start: "IN_PRODUCTION" },
  AWAITING_ADVANCE: { advance_settled: "IN_PRODUCTION", cancel: "CANCELLED" },
  IN_PRODUCTION: { ready: "READY_TO_SHIP", dispute: "DISPUTED" },
  READY_TO_SHIP: { ship: "SHIPPED" },
  SHIPPED: { deliver: "DELIVERED", dispute: "DISPUTED" },
  DELIVERED: { complete: "COMPLETED", dispute: "DISPUTED" },
  DISPUTED: { resolve: "COMPLETED", cancel: "CANCELLED" },
  COMPLETED: {}, CANCELLED: {},
};
export const PAY_FLOW: Record<PayState, Partial<Record<string, PayState>>> = {
  UNQUOTED: { quote: "QUOTED" },
  QUOTED: { expire: "EXPIRED", initiate: "INITIATED", quote: "QUOTED" },
  EXPIRED: { quote: "QUOTED" },
  INITIATED: { pending: "PENDING", failed: "FAILED" },
  PENDING: { settled: "SETTLED", failed: "FAILED" },
  SETTLED: { refund: "REFUND_PENDING", reversed: "REVERSED", dispute: "DISPUTED" },
  REFUND_PENDING: { refunded: "REFUNDED" },
  DISPUTED: { won: "SETTLED", lost: "REVERSED" },
  FAILED: { quote: "QUOTED" }, REFUNDED: {}, REVERSED: {},
};
export function next<S extends string>(table: Record<S, Partial<Record<string, S>>>, from: S, event: string): S {
  const to = table[from]?.[event];
  if (!to) throw new Error(`illegal_transition: ${from} --${event}--> ?`);
  return to;
}

// ----- landed cost (UPGRADE_PLAN §6) ------------------------------------------------------------------------------
export type LineStatus = "CONFIRMED" | "QUOTED" | "ESTIMATE" | "UNKNOWN" | "NEEDS_PROFESSIONAL";
export type Category = "goods" | "freight" | "fees" | "duty" | "tax";
export interface CostLine {
  key: string;
  category: Category;
  label_en: string;
  label_ja: string;
  amount: Money | null;
  status: LineStatus;
  basis_en: string;
  basis_ja: string;
}
export type Scenario = "independent" | "pooled" | "shared";
export interface LandedCost {
  scenario: Scenario;
  purchasable: boolean;
  tier: PriceTier | null;
  lines: CostLine[];
  totalExTax: Money | null;
  status: LineStatus | "INCOMPLETE";
  byCategory: Record<Category, Money | null>;
}
const RANK: Record<LineStatus, number> = { CONFIRMED: 0, QUOTED: 1, ESTIMATE: 2, NEEDS_PROFESSIONAL: 3, UNKNOWN: 4 };

/** a × pct / 100, half-even, in integer arithmetic. `pct` is a decimal string ("0.30", "10"). */
export function pctOf(a: Money, pct: string): Money {
  const [w, f = ""] = pct.split(".");
  const num = BigInt(a.minor) * BigInt(w + f);
  const den = 100n * 10n ** BigInt(f.length);
  const q = num / den, r = num % den;
  const up = r * 2n > den || (r * 2n === den && q % 2n === 1n);
  return m(Number(up ? q + 1n : q), a.ccy);
}

export interface LandedInput {
  pool: Pool;
  product: Product;
  qty: number;
  poolTotal: number; // committed including this buyer
  fxRate: string; // JPY per INR
  scenario: Scenario;
}

export function landedCost({ pool, product, qty, poolTotal, fxRate, scenario }: LandedInput): LandedCost {
  const f = pool.freight;
  const tier = tierFor(product.tiers, scenario === "independent" ? qty : poolTotal);
  const lines: CostLine[] = [];
  const empty = { goods: null, freight: null, fees: null, duty: null, tax: null } as LandedCost["byCategory"];
  if (!tier) return { scenario, purchasable: false, tier: null, lines, totalExTax: null, status: "UNKNOWN", byCategory: empty };

  const goodsInr = times(tier.unit, qty);
  const goods = convert(goodsInr, "JPY", fxRate);
  lines.push({ key: "goods", category: "goods", label_en: "Goods (supplier tier price)", label_ja: "商品代金（数量単価）", amount: goods, status: "QUOTED",
    basis_en: `${qty.toLocaleString()} × ₹${(tier.unit.minor / 100).toFixed(2)} at the ${tier.min_qty.toLocaleString()}+ tier · FX ${fxRate} (SIMULATED)`,
    basis_ja: `${qty.toLocaleString()} × ₹${(tier.unit.minor / 100).toFixed(2)}（${tier.min_qty.toLocaleString()}以上の単価）・為替 ${fxRate}（シミュレーション）` });

  // Sea LCL is charged per revenue ton: max(cbm, tonnes), with a minimum.
  const rt = (q: number) => Math.max(q * product.cbmPerUnit, (q * product.kgPerUnit) / 1000);
  const own = rt(qty);
  const shared = scenario === "shared" && pool.sharedFreight;
  let freight: Money | null = null;
  let cfs: Money;
  if (shared) {
    const total = Math.max(f.minCbm, rt(poolTotal));
    const share = own / rt(poolTotal);
    freight = f.perCbm ? allocate(m(Math.round(f.perCbm.minor * total), "JPY"), [share, 1 - share])[0] : null;
    cfs = allocate(m(Math.round(f.cfsPerCbm.minor * total), "JPY"), [share, 1 - share])[0];
  } else {
    const chargeable = Math.max(f.minCbm, own);
    freight = f.perCbm ? m(Math.round(f.perCbm.minor * chargeable), "JPY") : null;
    cfs = m(Math.round(f.cfsPerCbm.minor * chargeable), "JPY");
  }
  lines.push({ key: "freight", category: "freight", label_en: shared ? "Sea freight (shared LCL, your share)" : "Sea freight (LCL, own shipment)",
    label_ja: shared ? "海上運賃（混載・按分）" : "海上運賃（LCL・単独）", amount: freight, status: freight ? "QUOTED" : "UNKNOWN",
    basis_en: freight ? (shared ? `Allocated by revenue ton (${own.toFixed(2)} RT of pool) · forwarder quote (illustrative)` : `${Math.max(f.minCbm, own).toFixed(2)} RT incl. minimum · forwarder quote (illustrative)`) : "No forwarder quote yet",
    basis_ja: freight ? (shared ? `容積・重量比で按分（${own.toFixed(2)} RT）・フォワーダー見積（例示）` : `最低料金込み ${Math.max(f.minCbm, own).toFixed(2)} RT・フォワーダー見積（例示）`) : "フォワーダー見積が未取得" });
  const insured = freight ? add(goods, freight) : goods;
  const insurance = pctOf(insured, f.insurancePct);
  lines.push({ key: "insurance", category: "freight", label_en: "Marine insurance", label_ja: "海上保険", amount: insurance, status: "ESTIMATE",
    basis_en: `${f.insurancePct}% of goods + freight`, basis_ja: `商品＋運賃の${f.insurancePct}%` });
  lines.push({ key: "cfs", category: "freight", label_en: shared ? "CFS / port handling (shared)" : "CFS / port handling", label_ja: shared ? "CFS・港湾荷役（按分）" : "CFS・港湾荷役",
    amount: cfs, status: "ESTIMATE", basis_en: "Per revenue ton, Japan side", basis_ja: "日本側・RT単位" });

  const cif = add(insured, insurance);
  const duty = pctOf(cif, product.dutyRatePct);
  lines.push({ key: "duty", category: "duty", label_en: `Import duty (HS ${product.hs_proposed}, ${product.dutyRatePct}%)`, label_ja: `関税（HS ${product.hs_proposed}・${product.dutyRatePct}%）`,
    amount: duty, status: "NEEDS_PROFESSIONAL", basis_en: "CIF basis · rate entered, not a customs determination — confirm with a licensed broker", basis_ja: "CIF課税・入力税率（税関の決定ではありません）。通関業者に確認してください" });
  lines.push({ key: "broker", category: "fees", label_en: "Customs broker (your own declaration)", label_ja: "通関手数料（自社申告）", amount: f.brokerPerDeclaration, status: "ESTIMATE",
    basis_en: "You are importer of record — one declaration per buyer", basis_ja: "各社が輸入者のため、申告は1社1件" });
  lines.push({ key: "delivery", category: "fees", label_en: "Domestic delivery to your plant", label_ja: "国内配送", amount: f.domesticDelivery, status: "ESTIMATE", basis_en: "Port → plant", basis_ja: "港→工場" });
  lines.push({ key: "bank", category: "fees", label_en: "Bank remittance fees (advance + balance)", label_ja: "送金手数料（前払＋残金）", amount: times(f.bankFeePerRemittance, 2), status: "ESTIMATE",
    basis_en: "Two SWIFT transfers from your bank", basis_ja: "自社銀行からの送金2回" });
  lines.push({ key: "intermediary", category: "fees", label_en: "Intermediary bank charges", label_ja: "中継銀行手数料", amount: f.intermediaryFee ? times(f.intermediaryFee, 2) : null,
    status: f.intermediaryFee ? "ESTIMATE" : "UNKNOWN", basis_en: f.intermediaryFee ? "Typical deduction per transfer (illustrative)" : "Not known until the bank confirms", basis_ja: f.intermediaryFee ? "1回あたりの想定控除（例示）" : "銀行確認まで不明" });
  lines.push({ key: "platform", category: "fees", label_en: "Shinrai facilitation fee", label_ja: "信頼 手数料", amount: zero("JPY"), status: "CONFIRMED", basis_en: "Not charged in the prototype", basis_ja: "プロトタイプでは無料" });
  const tax = pctOf(add(cif, duty), "10");
  lines.push({ key: "tax", category: "tax", label_en: "Import consumption tax 10% (normally creditable)", label_ja: "輸入消費税10%（通常は仕入税額控除）", amount: tax, status: "ESTIMATE",
    basis_en: "(CIF + duty) × 10% · shown, never counted as a saving", basis_ja: "（CIF＋関税）×10%・表示のみ、削減額には含めません" });

  const byCategory = { ...empty };
  for (const cat of ["goods", "freight", "fees", "duty", "tax"] as Category[]) {
    const ls = lines.filter((l) => l.category === cat);
    byCategory[cat] = ls.some((l) => l.amount === null) ? null : ls.reduce((s, l) => add(s, l.amount!), zero("JPY")); // any unknown line → category unknown
  }
  const costLines = lines.filter((l) => l.category !== "tax");
  const unknown = costLines.some((l) => l.amount === null);
  const totalExTax = unknown ? null : costLines.reduce((s, l) => add(s, l.amount!), zero("JPY"));
  const worst = costLines.reduce<LineStatus>((w, l) => (RANK[l.status] > RANK[w] ? l.status : w), "CONFIRMED");
  return { scenario, purchasable: true, tier, lines, totalExTax, status: unknown ? "INCOMPLETE" : worst, byCategory };
}

export function savings(base: LandedCost, alt: LandedCost): Partial<Record<Category, Money | null>> {
  const out: Partial<Record<Category, Money | null>> = {};
  for (const c of ["goods", "freight", "fees", "duty"] as Category[]) {
    const a = base.byCategory[c], b = alt.byCategory[c];
    out[c] = a && b ? sub(a, b) : null;
  }
  return out;
}

// ----- tamper-evident hash (demo: cyrb53, not cryptographic) ------------------------------------------------------
export function hash(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}
export const canonical = (o: unknown): string =>
  JSON.stringify(o, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));
