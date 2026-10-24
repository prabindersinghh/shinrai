import type { Ccy, Money } from "./money";

export type PersonaId = "buyerA" | "buyerB" | "buyerC" | "buyerD" | "supplier" | "ops";
export type Role = "buyer" | "supplier" | "ops";
export interface Persona {
  id: PersonaId;
  role: Role;
  name: string;
  name_ja: string;
  city: string;
  city_ja: string;
  supplierId?: string;
}

export type Provenance = "LIVE" | "CACHED" | "ILLUSTRATIVE" | "SIMULATED" | "USER_REPORTED" | "PLATFORM_OBSERVED" | "ESTIMATE" | "UNKNOWN";

export type CheckStatus = "pass" | "fail" | "not_checked" | "warn";
export interface VerificationCheck {
  id: "registry" | "gst" | "iec" | "network" | "legal" | "claims" | "ground" | "audit" | "cert";
  status: CheckStatus;
  note_en: string;
  note_ja: string;
  checked_at?: string;
}
export interface Investigation {
  score: number | null;
  band: "low" | "standard" | "caution" | "high" | "insufficient";
  flags: { high: number; critical: number; medium: number };
  checked_at: string;
  mode: Provenance;
  checks: VerificationCheck[];
  demoScenario?: string; // existing Verify demo card this maps to
}

export interface Supplier {
  id: string;
  name: string;
  name_ja: string;
  cin: string;
  state: string;
  city: string;
  lat: number;
  lon: number;
  since: number;
  employees: string;
  capabilities: string[];
  languages: string[];
  exportExperience: "none" | "indirect" | "direct";
  investigation: Investigation | null;
  readiness: { iec: CheckStatus; lut: CheckStatus; adBank: CheckStatus; icegate: CheckStatus; coo: CheckStatus };
  is_demo: true;
}

export interface PriceTier {
  min_qty: number;
  unit: Money;
}
export type CertStatus = "claimed" | "register_verified" | "expired" | "contradicted";
export interface Certification {
  standard: string;
  status: CertStatus;
  valid_until?: string;
  issuer?: string;
}
export interface Product {
  id: string;
  supplierId: string;
  title_en: string;
  title_ja: string;
  category: "fasteners" | "machined" | "castings";
  spec: Record<string, string>;
  hs_proposed: string;
  hs_status: "unverified" | "broker_confirmed";
  unit: "pcs" | "sets" | "kg";
  unitLabel_ja: string;
  moq: number;
  lead_days: number;
  incoterm: string; // e.g. FOB Nhava Sheva
  originPort: PortId;
  tiers: PriceTier[];
  poolable: boolean;
  poolable_reason_en?: string;
  poolable_reason_ja?: string;
  kgPerUnit: number;
  cbmPerUnit: number;
  certs: Certification[];
  dutyRatePct: string; // user-entered, status NEEDS_PROFESSIONAL
  is_demo: true;
}

export type PortId = "INNSA" | "INMAA" | "JPYOK" | "JPUKB" | "JPNGO";

export type PoolState = "DRAFT" | "OPEN" | "QUOTE_PENDING" | "QUOTED" | "CONFIRMATION" | "REQUOTE" | "CONFIRMED" | "CLOSED"
  | "FAILED_THRESHOLD" | "SUPPLIER_DECLINED" | "CANCELLED";
export type MemberState = "INTERESTED" | "COMMITTED" | "ACCEPTED" | "ORDERED" | "WITHDRAWN" | "RELEASED" | "LAPSED";

export interface Membership {
  persona: PersonaId;
  qty: number;
  ceiling: Money | null;
  state: MemberState;
  acceptedHash?: string;
  at: number;
  reason?: string;
}
export interface SupplierQuote {
  version: number;
  tiers: PriceTier[];
  advancePct: number;
  balanceTerms_en: string;
  balanceTerms_ja: string;
  leadDays: number;
  validUntil: number;
  hash: string;
  issuedAt: number;
  status: "issued" | "superseded";
}
export interface FreightInput {
  perCbm: Money | null; // forwarder LCL quote (null = not yet quoted)
  minCbm: number;
  cfsPerCbm: Money;
  brokerPerDeclaration: Money;
  domesticDelivery: Money;
  insurancePct: string;
  bankFeePerRemittance: Money;
  intermediaryFee: Money | null;
}
export interface Pool {
  id: string;
  productId: string;
  organiser: PersonaId;
  destPort: PortId;
  incoterm: string;
  windowStart: string;
  windowEnd: string;
  opensAt: number;
  closesAt: number;
  confirmUntil?: number;
  minQty: number;
  maxQty: number;
  state: PoolState;
  members: Membership[];
  quotes: SupplierQuote[];
  freight: FreightInput;
  sharedFreight: boolean;
  is_demo: true;
}

export type PoState = "ISSUED" | "SUPPLIER_ACCEPTED" | "AWAITING_ADVANCE" | "IN_PRODUCTION" | "READY_TO_SHIP" | "SHIPPED" | "DELIVERED"
  | "COMPLETED" | "DISPUTED" | "CANCELLED";
export type DocKind = "commercial_invoice" | "packing_list" | "bill_of_lading" | "certificate_of_origin" | "inspection_report";
export interface TradeDoc {
  kind: DocKind;
  name: string;
  sha: string;
  by: PersonaId;
  at: number;
}
export interface PurchaseOrder {
  id: string;
  number: string;
  poolId: string;
  productId: string;
  buyer: PersonaId;
  supplierId: string;
  qty: number;
  unit: Money;
  subtotal: Money;
  termsHash: string;
  quoteVersion: number;
  advancePct: number;
  state: PoState;
  docs: TradeDoc[];
  shipment?: { vessel: string; bl: string; etd: number; eta: number };
  disputeNote?: string;
  createdAt: number;
  is_demo: true;
}

export type PayState = "UNQUOTED" | "QUOTED" | "EXPIRED" | "INITIATED" | "PENDING" | "SETTLED" | "FAILED" | "REFUND_PENDING" | "REFUNDED"
  | "REVERSED" | "DISPUTED";
export interface FxQuote {
  id: string;
  rate: string; // JPY per INR
  invoice: Money;
  payable: Money;
  fee: Money;
  quotedAt: number; // wall clock (ms)
  expiresAt: number;
}
export interface ProviderEvent {
  id: string;
  type: "pending" | "settled" | "failed" | "reversed";
  at: number;
  signatureValid: boolean;
  applied: boolean;
  note?: string;
}
export interface PaymentIntent {
  id: string;
  poId: string;
  purpose: "advance" | "balance";
  amount: Money; // INR invoice share
  state: PayState;
  quote?: FxQuote;
  idempotencyKey: string;
  events: ProviderEvent[];
  reconciliation?: { expected: Money; received: Money; status: "matched" | "short" | "over" };
  createdAt: number;
}

export interface DomainEvent {
  seq: number;
  aggregate: "pool" | "membership" | "quote" | "po" | "payment" | "shipment" | "system";
  aggregateId: string;
  type: string;
  actor: PersonaId | "system" | "provider";
  text_en: string;
  text_ja: string;
  at: number;
  prev: string;
  hash: string;
}

export type { Ccy };
