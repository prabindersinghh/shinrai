/** Client-side trade store. Everything runs in the browser and is ILLUSTRATIVE / SIMULATED: no money moves, no orders exist.
 *  ponytail: one structuredClone per action and localStorage persistence; fine for demo-sized state, move to a backend for real use. */
import { useSyncExternalStore } from "react";
import { canonical, committedQty, acceptedQty, hash, MEMBER_FLOW, next, PAY_FLOW, PO_FLOW, POOL_FLOW, tierFor, landedCost } from "./logic";
import { convert, m, times, type Money } from "./money";
import { DAY, makePools, makeSuppliers, PERSONAS, PRODUCTS } from "./seed";
import type {
  DocKind, DomainEvent, FxQuote, Membership, PaymentIntent, PersonaId, Pool, PoState, PriceTier, Product, ProviderEvent, PurchaseOrder, Supplier,
} from "./types";

const KEY = "shinrai.trade.v1";
const SIM_RATE = "1.7832"; // JPY per INR — SIMULATED, not a market rate
const QUOTE_TTL = 10 * 60_000; // payment quote validity (wall clock)
const PROVIDER_SECRET = "shinrai-sim-webhook-secret"; // demo only: lives in the browser by design

export interface Toast { id: number; text_en: string; text_ja: string; tone: "ok" | "warn" | "err" }
export interface TradeState {
  version: 1;
  seededAt: number;
  offset: number; // demo clock offset (ms)
  persona: PersonaId;
  suppliers: Supplier[];
  products: Product[];
  pools: Pool[];
  pos: PurchaseOrder[];
  payments: PaymentIntent[];
  events: DomainEvent[];
  idem: Record<string, string>; // idempotency key -> intent id
  seq: { po: number; pay: number; pool: number };
}

function seed(): TradeState {
  const now = Date.now();
  const s: TradeState = {
    version: 1, seededAt: now, offset: 0, persona: "buyerA", suppliers: makeSuppliers(now), products: structuredClone(PRODUCTS), pools: makePools(now),
    pos: [], payments: [], events: [], idem: {}, seq: { po: 0, pay: 0, pool: 3 },
  };
  log(s, "system", "seed", "system", "system", "Illustrative workspace created (fictional companies, simulated payments)", "説明用ワークスペースを作成（架空の企業・模擬決済）");
  return s;
}

function load(): TradeState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as TradeState;
      if (s.version === 1) return s;
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return seed();
}

let state: TradeState = load();
let toasts: Toast[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function commit(s: TradeState) {
  state = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked: state stays in memory */
  }
  emit();
}
/** Run a mutation on a clone; errors become toasts and leave state untouched. */
function act(fn: (s: TradeState) => void): boolean {
  const s = structuredClone(state);
  try {
    fn(s);
    process(s);
    commit(s);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    toast(msg, msg, "err");
    return false;
  }
}

let toastId = 0;
export function toast(text_en: string, text_ja: string, tone: Toast["tone"] = "ok") {
  const t = { id: ++toastId, text_en, text_ja, tone };
  toasts = [...toasts, t];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    emit();
  }, 4200);
}

export function nowOf(s: TradeState) {
  return Date.now() + s.offset;
}

function log(s: TradeState, aggregate: DomainEvent["aggregate"], aggregateId: string, type: string, actor: DomainEvent["actor"], text_en: string, text_ja: string) {
  const prev = s.events.length ? s.events[s.events.length - 1].hash : "genesis";
  const body = { seq: s.events.length + 1, aggregate, aggregateId, type, actor, text_en, text_ja, at: nowOf(s), prev };
  s.events.push({ ...body, hash: hash(prev + canonical(body)) });
}

export function verifyChain(events: DomainEvent[]): { ok: boolean; brokenAt?: number } {
  let prev = "genesis";
  for (const e of events) {
    const { hash: h, ...body } = e;
    if (e.prev !== prev || hash(prev + canonical(body)) !== h) return { ok: false, brokenAt: e.seq };
    prev = h;
  }
  return { ok: true };
}

// ----- lookups --------------------------------------------------------------------------------------------------
const pool = (s: TradeState, id: string) => {
  const p = s.pools.find((x) => x.id === id);
  if (!p) throw new Error("Pool not found");
  return p;
};
const product = (s: TradeState, id: string) => s.products.find((x) => x.id === id)!;
const po = (s: TradeState, id: string) => {
  const o = s.pos.find((x) => x.id === id);
  if (!o) throw new Error("Order not found");
  return o;
};
const who = (id: PersonaId) => PERSONAS[id];
const latestQuote = (p: Pool) => p.quotes.find((q) => q.status === "issued") ?? null;

function memberTo(s: TradeState, p: Pool, mem: Membership, event: string, reason?: string) {
  mem.state = next(MEMBER_FLOW, mem.state, event);
  if (reason) mem.reason = reason;
  log(s, "membership", `${p.id}:${mem.persona}`, `membership.${event}`, mem.persona, `${who(mem.persona).name}: ${event} → ${mem.state}`, `${who(mem.persona).name_ja}：${mem.state}`);
}
function poolTo(s: TradeState, p: Pool, event: string, actor: DomainEvent["actor"], en: string, ja: string) {
  p.state = next(POOL_FLOW, p.state, event);
  log(s, "pool", p.id, `pool.${event}`, actor, en, ja);
}

// ----- deadline processor (P0-12): lazy, runs after every action and on a timer --------------------------------
function process(s: TradeState) {
  const now = nowOf(s);
  for (const p of s.pools) {
    if (p.state === "OPEN" && now >= p.closesAt) closeOpen(s, p, "system");
    if (p.state === "CONFIRMATION" && p.confirmUntil && now >= p.confirmUntil) finalize(s, p);
  }
  for (const pay of s.payments) if (pay.state === "QUOTED" && pay.quote && Date.now() > pay.quote.expiresAt) {
    pay.state = next(PAY_FLOW, pay.state, "expire");
    log(s, "payment", pay.id, "payment.expired", "system", `FX quote ${pay.quote.id} expired`, `為替見積 ${pay.quote.id} が期限切れ`);
  }
}

function closeOpen(s: TradeState, p: Pool, actor: DomainEvent["actor"]) {
  const c = committedQty(p);
  for (const mem of p.members) if (mem.state === "INTERESTED") memberTo(s, p, mem, "lapse", "Interest only — not counted at close");
  if (c >= p.minQty) {
    poolTo(s, p, "threshold_met", actor, `Pool closed with ${c.toLocaleString()} committed ≥ ${p.minQty.toLocaleString()} — quote requested`, `確定数量${c.toLocaleString()}で締切・見積依頼`);
  } else {
    poolTo(s, p, "deadline_unmet", actor, `Threshold not met (${c.toLocaleString()} of ${p.minQty.toLocaleString()}) — no obligations, no charges`, `目標未達（${c.toLocaleString()}/${p.minQty.toLocaleString()}）・義務も費用も発生しません`);
    for (const mem of p.members) if (["COMMITTED"].includes(mem.state)) memberTo(s, p, mem, "lapse", "Pool failed its threshold");
  }
}

function finalize(s: TradeState, p: Pool) {
  const q = latestQuote(p)!;
  const prod = product(s, p.productId);
  const committedAtQuote = q.tiers.length ? tierFor(q.tiers, committedQty(p)) : null;
  const acc = acceptedQty(p);
  const accTier = tierFor(q.tiers, acc);
  for (const mem of p.members) if (mem.state === "COMMITTED") memberTo(s, p, mem, "release", "Did not accept within the window");
  if (accTier && committedAtQuote && accTier.min_qty === committedAtQuote.min_qty) {
    poolTo(s, p, "confirm", "system", `Confirmed: ${acc.toLocaleString()} accepted at the ${accTier.min_qty.toLocaleString()}+ tier`, `確定：${acc.toLocaleString()}が単価帯${accTier.min_qty.toLocaleString()}+で承諾`);
    issuePOs(s, p, accTier);
    poolTo(s, p, "close", "system", "Pool closed — one purchase order per buyer", "締切：各社に個別の発注書を発行");
  } else if (acc >= prod.moq) {
    poolTo(s, p, "requote", "system", `Accepted volume fell to ${acc.toLocaleString()} — supplier may requote for the lower tier`, `承諾数量が${acc.toLocaleString()}に減少・下位単価で再見積可能`);
    for (const mem of p.members) if (mem.state === "ACCEPTED") memberTo(s, p, mem, "requote");
  } else {
    poolTo(s, p, "fail", "system", "Accepted volume below MOQ — pool failed, no obligations", "承諾数量がMOQ未満・不成立（義務なし）");
    for (const mem of p.members) if (mem.state === "ACCEPTED") memberTo(s, p, mem, "lapse");
  }
}

function issuePOs(s: TradeState, p: Pool, tier: PriceTier) {
  const q = latestQuote(p)!;
  const prod = product(s, p.productId);
  for (const mem of p.members.filter((x) => x.state === "ACCEPTED")) {
    s.seq.po += 1;
    const id = `po_${s.seq.po}`;
    const order: PurchaseOrder = {
      id, number: `PO-${new Date(nowOf(s)).getFullYear()}-${String(s.seq.po).padStart(4, "0")}`, poolId: p.id, productId: p.productId, buyer: mem.persona,
      supplierId: prod.supplierId, qty: mem.qty, unit: tier.unit, subtotal: times(tier.unit, mem.qty), termsHash: q.hash, quoteVersion: q.version,
      advancePct: q.advancePct, state: "ISSUED", docs: [], createdAt: nowOf(s), is_demo: true,
    };
    s.pos.push(order);
    memberTo(s, p, mem, "order");
    log(s, "po", id, "po.issued", "system", `${order.number} issued to ${who(mem.persona).name} · ${mem.qty.toLocaleString()} pcs · terms ${q.hash.slice(0, 8)}`, `${order.number} を ${who(mem.persona).name_ja} に発行`);
  }
}

// ----- pool actions ---------------------------------------------------------------------------------------------
export const actions = {
  setPersona(id: PersonaId) {
    act((s) => void (s.persona = id));
  },
  advance(ms: number) {
    act((s) => {
      s.offset += ms;
      log(s, "system", "clock", "clock.advanced", "ops", `Demo clock advanced ${Math.round(ms / 3_600_000)} h`, `デモ時計を${Math.round(ms / 3_600_000)}時間進めました`);
    });
  },
  reset() {
    commit(seed());
    toast("Workspace reset to the illustrative starting point", "説明用の初期状態に戻しました");
  },
  tick() {
    const before = JSON.stringify(state.pools.map((p) => p.state)) + state.payments.map((p) => p.state).join();
    const s = structuredClone(state);
    process(s);
    if (JSON.stringify(s.pools.map((p) => p.state)) + s.payments.map((p) => p.state).join() !== before) commit(s);
  },

  join(poolId: string, persona: PersonaId, qty: number, ceiling: Money | null, mode: "INTERESTED" | "COMMITTED") {
    return act((s) => {
      const p = pool(s, poolId);
      if (p.state !== "OPEN") throw new Error("This pool is no longer open");
      if (!Number.isInteger(qty) || qty <= 0) throw new Error("Enter a whole quantity above zero");
      if (mode === "COMMITTED" && !ceiling) throw new Error("Set your maximum unit price to commit");
      const existing = p.members.find((x) => x.persona === persona);
      const otherCommitted = committedQty(p) - (existing && existing.state === "COMMITTED" ? existing.qty : 0);
      if (mode === "COMMITTED" && otherCommitted + qty > p.maxQty)
        throw new Error(`capacity_exceeded: only ${(p.maxQty - otherCommitted).toLocaleString()} units remain in this pool`);
      if (existing && ["INTERESTED", "COMMITTED", "WITHDRAWN"].includes(existing.state)) {
        if (mode === "COMMITTED" && existing.state !== "COMMITTED") memberTo(s, p, existing, "commit");
        else if (mode === "INTERESTED" && existing.state !== "INTERESTED") throw new Error("To step back from a commitment, withdraw instead");
        existing.qty = qty;
        existing.ceiling = ceiling;
        log(s, "membership", `${p.id}:${persona}`, "membership.updated", persona, `${who(persona).name} updated to ${qty.toLocaleString()} (${mode.toLowerCase()})`, `${who(persona).name_ja} が数量を${qty.toLocaleString()}に更新`);
      } else if (!existing) {
        p.members.push({ persona, qty, ceiling, state: mode, at: nowOf(s) });
        log(s, "membership", `${p.id}:${persona}`, `membership.${mode.toLowerCase()}`, persona, `${who(persona).name} ${mode === "COMMITTED" ? "committed" : "registered interest in"} ${qty.toLocaleString()}`, `${who(persona).name_ja} が${qty.toLocaleString()}を${mode === "COMMITTED" ? "確約" : "関心登録"}`);
      } else throw new Error("You can no longer change this membership");
      toast(mode === "COMMITTED" ? "Commitment recorded — not a purchase yet" : "Interest registered (not counted toward the threshold)",
        mode === "COMMITTED" ? "確約を記録しました（まだ購入ではありません）" : "関心を登録しました（目標数量には含まれません）");
    });
  },
  withdraw(poolId: string, persona: PersonaId) {
    return act((s) => {
      const p = pool(s, poolId);
      if (p.state !== "OPEN") throw new Error("Withdrawal is only free while the pool is open");
      const mem = p.members.find((x) => x.persona === persona);
      if (!mem) throw new Error("You are not in this pool");
      memberTo(s, p, mem, "withdraw");
      toast("Withdrawn — no obligation", "辞退しました（義務なし）", "warn");
    });
  },
  closeEarly(poolId: string, persona: PersonaId) {
    return act((s) => {
      const p = pool(s, poolId);
      if (p.organiser !== persona && persona !== "ops") throw new Error("Only the organiser can close the pool early");
      if (committedQty(p) < p.minQty) throw new Error("Cannot close early before the threshold is reached");
      closeOpen(s, p, persona);
    });
  },
  openPool(input: { productId: string; persona: PersonaId; qty: number; ceiling: Money; destPort: Pool["destPort"]; windowStart: string; windowEnd: string; closesInDays: number; minQty: number }) {
    let id = "";
    act((s) => {
      const prod = product(s, input.productId);
      if (!prod.poolable) throw new Error(prod.poolable_reason_en ?? "Not poolable");
      if (input.minQty < prod.moq) throw new Error("Pool threshold must be at least the supplier MOQ");
      s.seq.pool += 1;
      id = `pool_${s.seq.pool}`;
      const now = nowOf(s);
      const template = s.pools.find((p) => p.productId === prod.id) ?? s.pools[0];
      s.pools.push({
        id, productId: prod.id, organiser: input.persona, destPort: input.destPort, incoterm: prod.incoterm, windowStart: input.windowStart, windowEnd: input.windowEnd,
        opensAt: now, closesAt: now + input.closesInDays * DAY, minQty: input.minQty, maxQty: Math.max(input.minQty * 2, prod.tiers[prod.tiers.length - 1].min_qty),
        state: "DRAFT", members: [{ persona: input.persona, qty: input.qty, ceiling: input.ceiling, state: "COMMITTED", at: now }], quotes: [],
        freight: template.freight, sharedFreight: false, is_demo: true,
      });
      const p = pool(s, id);
      log(s, "pool", id, "pool.created", input.persona, `${who(input.persona).name} drafted a pool for ${prod.title_en}`, `${who(input.persona).name_ja} が共同発注を作成`);
      poolTo(s, p, "publish", input.persona, "Pool published — specification frozen", "共同発注を公開（仕様を固定）");
    });
    return id;
  },

  // ----- supplier quote, buyer acceptance ---------------------------------------------------------------------------
  issueQuote(poolId: string, tiers: PriceTier[], advancePct: number, leadDays: number) {
    return act((s) => {
      const p = pool(s, poolId);
      if (!["QUOTE_PENDING", "QUOTED", "CONFIRMATION", "REQUOTE"].includes(p.state)) throw new Error("A quote can only be issued after the pool closes");
      for (const q of p.quotes) q.status = "superseded";
      const version = p.quotes.length + 1;
      const terms = { tiers, advancePct, leadDays, incoterm: p.incoterm, balance: "Against copy of B/L" };
      const quote = {
        version, tiers, advancePct, leadDays, balanceTerms_en: "Balance against copy of B/L", balanceTerms_ja: "残金はB/L写し受領後",
        validUntil: nowOf(s) + 14 * DAY, hash: hash(canonical(terms) + version), issuedAt: nowOf(s), status: "issued" as const,
      };
      p.quotes.push(quote);
      if (p.state === "CONFIRMATION") {
        for (const mem of p.members) if (mem.state === "ACCEPTED") memberTo(s, p, mem, "requote", "New quote version — re-acceptance required");
      }
      poolTo(s, p, "quote", "supplier", `Quote v${version} issued · terms ${quote.hash.slice(0, 8)}`, `見積 v${version} を発行`);
      const price = tierFor(tiers, committedQty(p));
      for (const mem of p.members) {
        if (mem.state === "COMMITTED" && price && mem.ceiling && price.unit.minor > mem.ceiling.minor) memberTo(s, p, mem, "release", "Final unit price above your maximum — released automatically");
      }
      poolTo(s, p, "open_confirmation", "system", "Acceptance window open for 72 hours", "承諾受付を72時間開始");
      p.confirmUntil = nowOf(s) + 3 * DAY;
    });
  },
  accept(poolId: string, persona: PersonaId, termsHash: string) {
    return act((s) => {
      const p = pool(s, poolId);
      const q = latestQuote(p);
      if (p.state !== "CONFIRMATION" || !q) throw new Error("No quote is open for acceptance");
      if (q.hash !== termsHash) throw new Error("terms_changed: the quote was updated — review the new version");
      const mem = p.members.find((x) => x.persona === persona);
      if (!mem || mem.state !== "COMMITTED") throw new Error("Only committed members can accept");
      memberTo(s, p, mem, "accept");
      mem.acceptedHash = termsHash;
      toast(`Accepted quote v${q.version} — your purchase order is created when the pool confirms`, `見積v${q.version}を承諾しました。確定時に発注書が作成されます`);
    });
  },
  decline(poolId: string, persona: PersonaId) {
    return act((s) => {
      const p = pool(s, poolId);
      const mem = p.members.find((x) => x.persona === persona);
      if (!mem || !["COMMITTED", "ACCEPTED"].includes(mem.state) || p.state !== "CONFIRMATION") throw new Error("Nothing to decline");
      memberTo(s, p, mem, "release", "Declined the final quote");
    });
  },
  finalizeNow(poolId: string) {
    return act((s) => {
      const p = pool(s, poolId);
      if (p.state !== "CONFIRMATION") throw new Error("Pool is not in confirmation");
      finalize(s, p);
    });
  },

  // ----- purchase orders ----------------------------------------------------------------------------------------
  poEvent(poId: string, event: string, persona: PersonaId, note?: string) {
    return act((s) => {
      const o = po(s, poId);
      const role = who(persona).role;
      const supplierOnly = ["supplier_accept", "ready", "ship"], buyerOnly = ["deliver", "complete"];
      if (supplierOnly.includes(event) && role !== "supplier" && role !== "ops") throw new Error("Only the supplier can do this");
      if (buyerOnly.includes(event) && persona !== o.buyer && role !== "ops") throw new Error("Only the buyer can do this");
      const has = (k: DocKind) => o.docs.some((d) => d.kind === k);
      if (event === "ready" && !(has("commercial_invoice") && has("packing_list"))) throw new Error("Upload the commercial invoice and packing list first");
      if (event === "ship" && !has("bill_of_lading")) throw new Error("Upload the bill of lading first");
      if (event === "complete") {
        const bal = s.payments.find((x) => x.poId === o.id && x.purpose === "balance");
        if (!bal || bal.state !== "SETTLED") throw new Error("The balance payment must be settled before completion");
      }
      const from = o.state;
      o.state = next(PO_FLOW, o.state, event);
      if (event === "ship") {
        const now = nowOf(s);
        o.shipment = { vessel: "MV Sakura Horizon (illustrative)", bl: o.docs.find((d) => d.kind === "bill_of_lading")!.name.replace(/\.\w+$/, ""), etd: now, eta: now + 18 * DAY };
      }
      if (event === "dispute") o.disputeNote = note;
      log(s, "po", o.id, `po.${event}`, persona, `${o.number}: ${from} → ${o.state}${note ? ` (${note})` : ""}`, `${o.number}：${from} → ${o.state}`);
      if (event === "supplier_accept") {
        o.state = next(PO_FLOW, o.state, o.advancePct > 0 ? "await_advance" : "start");
        log(s, "po", o.id, "po.awaiting_advance", "system", `${o.number}: awaiting ${o.advancePct}% advance`, `${o.number}：前払${o.advancePct}%待ち`);
      }
    });
  },
  addDoc(poId: string, kind: DocKind, name: string, sha: string, persona: PersonaId) {
    return act((s) => {
      const o = po(s, poId);
      if (persona !== o.buyer && who(persona).role === "buyer") throw new Error("Not a party to this order");
      o.docs = o.docs.filter((d) => d.kind !== kind);
      o.docs.push({ kind, name, sha, by: persona, at: nowOf(s) });
      log(s, "po", o.id, "po.document", persona, `${o.number}: ${kind.replace(/_/g, " ")} uploaded · sha256 ${sha.slice(0, 10)}…`, `${o.number}：書類アップロード（${kind}）`);
    });
  },

  // ----- payments (SIMULATED provider) ----------------------------------------------------------------------------
  quotePayment(poId: string, purpose: "advance" | "balance") {
    let intentId = "";
    act((s) => {
      const o = po(s, poId);
      let pay = s.payments.find((x) => x.poId === poId && x.purpose === purpose && !["SETTLED", "REFUNDED", "REVERSED"].includes(x.state));
      const share = purpose === "advance" ? Math.round((o.subtotal.minor * o.advancePct) / 100) : o.subtotal.minor - Math.round((o.subtotal.minor * o.advancePct) / 100);
      if (!pay) {
        s.seq.pay += 1;
        pay = { id: `pay_${s.seq.pay}`, poId, purpose, amount: m(share, "INR"), state: "UNQUOTED", idempotencyKey: "", events: [], createdAt: nowOf(s) };
        s.payments.push(pay);
      }
      const jitter = (s.seq.pay * 7 + pay.events.length * 3) % 9; // deterministic, visibly simulated
      const rate = `1.78${String(32 + jitter - 4).padStart(2, "0")}`;
      const quote: FxQuote = {
        id: `FXQ-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, rate, invoice: pay.amount, payable: convert(pay.amount, "JPY", rate, "ceil"),
        fee: m(800, "JPY"), quotedAt: Date.now(), expiresAt: Date.now() + QUOTE_TTL,
      };
      pay.quote = quote;
      pay.state = next(PAY_FLOW, pay.state, "quote");
      pay.idempotencyKey = `idem_${hash(quote.id)}`;
      intentId = pay.id;
      log(s, "payment", pay.id, "payment.quoted", o.buyer, `FX quote ${quote.id}: ₹${(pay.amount.minor / 100).toLocaleString()} → ¥${quote.payable.minor.toLocaleString()} @ ${rate} (SIMULATED)`, `為替見積 ${quote.id}（シミュレーション）`);
    });
    return intentId;
  },
  /** Idempotent: the same key returns the same intent and never creates a second instruction (QG-04 / P0-20). */
  initiate(intentId: string, idemKey: string) {
    return act((s) => {
      const pay = s.payments.find((x) => x.id === intentId)!;
      if (s.idem[idemKey]) {
        toast("Duplicate submit ignored — one payment instruction exists", "重複送信を無視しました（指示は1件のみ）", "warn");
        return;
      }
      if (!pay.quote || Date.now() > pay.quote.expiresAt) throw new Error("quote_expired: get a new FX quote");
      if (pay.state !== "QUOTED") throw new Error(`Cannot initiate from ${pay.state}`);
      s.idem[idemKey] = pay.id;
      pay.state = next(PAY_FLOW, pay.state, "initiate");
      log(s, "payment", pay.id, "payment.initiated", po(s, pay.poId).buyer, `Instruction sent to SIMULATED provider (key ${idemKey.slice(0, 10)}…)`, `模擬プロバイダーへ送金指示`);
    });
  },
  async providerSend(intentId: string, type: ProviderEvent["type"], opts: { forge?: boolean; short?: boolean; dupOf?: string } = {}) {
    const eventId = opts.dupOf ?? `evt_${crypto.randomUUID().slice(0, 12)}`;
    const body = canonical({ intentId, type, eventId, short: !!opts.short });
    const sig = await hmac(opts.forge ? "attacker-secret" : PROVIDER_SECRET, body);
    await receiveWebhook(body, sig);
  },
  tamper() {
    const s = structuredClone(state);
    const e = s.events[Math.max(0, s.events.length - 3)];
    if (e) e.text_en = e.text_en + " [edited]";
    commit(s);
    toast("One historic event was edited without re-hashing (demo)", "過去のイベントをハッシュ更新なしで改変（デモ）", "warn");
  },
};

async function hmac(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The webhook endpoint: verify signature, dedupe by event id, apply only legal transitions (QG-12/13). */
async function receiveWebhook(body: string, signature: string) {
  const expected = await hmac(PROVIDER_SECRET, body);
  const msg = JSON.parse(body) as { intentId: string; type: ProviderEvent["type"]; eventId: string; short: boolean };
  act((s) => {
    const pay = s.payments.find((x) => x.id === msg.intentId);
    if (!pay) throw new Error("Unknown payment");
    const valid = expected === signature;
    if (pay.events.some((e) => e.id === msg.eventId)) {
      toast("Duplicate provider event ignored", "重複イベントを無視しました", "warn");
      return;
    }
    const ev: ProviderEvent = { id: msg.eventId, type: msg.type, at: Date.now(), signatureValid: valid, applied: false };
    pay.events.push(ev);
    if (!valid) {
      ev.note = "Signature invalid — rejected (401)";
      log(s, "payment", pay.id, "webhook.rejected", "provider", `Webhook with invalid signature rejected for ${pay.id}`, `署名不正のWebhookを拒否`);
      toast("Forged webhook rejected: invalid signature", "署名不正のWebhookを拒否しました", "err");
      return;
    }
    const to = PAY_FLOW[pay.state]?.[msg.type];
    if (!to) {
      ev.note = `Ignored: ${pay.state} → ${msg.type} is not a legal transition`;
      log(s, "payment", pay.id, "webhook.ignored", "provider", `Out-of-order '${msg.type}' ignored in state ${pay.state}`, `順序外のイベントを無視`);
      return;
    }
    pay.state = to;
    ev.applied = true;
    log(s, "payment", pay.id, `payment.${msg.type}`, "provider", `SIMULATED provider: ${pay.id} → ${to}`, `模擬プロバイダー：${to}`);
    const o = po(s, pay.poId);
    if (to === "SETTLED") {
      const received = msg.short ? m(pay.amount.minor - 120_000, "INR") : pay.amount;
      const status = received.minor === pay.amount.minor ? "matched" : received.minor < pay.amount.minor ? "short" : "over";
      pay.reconciliation = { expected: pay.amount, received, status };
      log(s, "payment", pay.id, "reconciliation", "system", `Reconciliation ${status}: expected ₹${(pay.amount.minor / 100).toLocaleString()}, received ₹${(received.minor / 100).toLocaleString()}`, `照合：${status}`);
      if (pay.purpose === "advance" && o.state === "AWAITING_ADVANCE" && status === "matched") {
        o.state = next(PO_FLOW, o.state, "advance_settled");
        log(s, "po", o.id, "po.in_production", "system", `${o.number}: advance settled → in production`, `${o.number}：前払確認・生産開始`);
      }
    }
    if (to === "FAILED") toast("Payment failed (SIMULATED) — get a new quote to retry", "支払失敗（シミュレーション）・再見積してください", "err");
  });
}

/** Simulated provider lifecycle: acknowledges an instruction with a signed `pending` event shortly after initiation. */
export function scheduleProviderAck(intentId: string) {
  setTimeout(() => void actions.providerSend(intentId, "pending"), 1200);
}

// ----- selectors / hooks ------------------------------------------------------------------------------------------
export function useTrade(): TradeState {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state);
}
export function useToasts(): Toast[] {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => toasts);
}
export const getState = () => state;

export function poState(s: TradeState, id: string): PoState | undefined {
  return s.pos.find((x) => x.id === id)?.state;
}
export function myLanded(s: TradeState, p: Pool, persona: PersonaId, qtyOverride?: number) {
  const prod = s.products.find((x) => x.id === p.productId)!;
  const mine = p.members.find((x) => x.persona === persona && !["WITHDRAWN", "LAPSED", "RELEASED"].includes(x.state));
  const qty = qtyOverride ?? mine?.qty ?? 0;
  const mineCounted = mine && ["COMMITTED", "ACCEPTED", "ORDERED"].includes(mine.state) ? mine.qty : 0;
  const total = committedQty(p) - mineCounted + qty; // projected total if this buyer commits `qty`
  const base = { pool: p, product: prod, qty, poolTotal: total, fxRate: SIM_RATE };
  return {
    qty, total: base.poolTotal,
    independent: landedCost({ ...base, scenario: "independent" }),
    pooled: landedCost({ ...base, scenario: "pooled" }),
    shared: p.sharedFreight ? landedCost({ ...base, scenario: "shared" }) : null,
  };
}
export { SIM_RATE };

if (typeof window !== "undefined") setInterval(() => actions.tick(), 5000);
