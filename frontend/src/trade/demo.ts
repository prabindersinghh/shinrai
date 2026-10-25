/** Demo autopilot: drives the real actions (same state machines a user would trigger) to reach a given stage. */
import { major } from "./money";
import { actions, getState, scheduleProviderAck } from "./store";
import type { DocKind, PersonaId } from "./types";

const POOL = "pool_bolt";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ffToPurchaseOrders() {
  const s0 = getState();
  const pool = s0.pools.find((p) => p.id === POOL)!;
  if (pool.state === "CLOSED") return;
  if (pool.state === "OPEN") {
    if (!pool.members.some((m) => m.persona === "buyerA" && m.state === "COMMITTED")) actions.join(POOL, "buyerA", 12_000, major("12.50", "INR"), "COMMITTED");
    actions.closeEarly(POOL, "buyerB");
  }
  const p1 = getState().pools.find((p) => p.id === POOL)!;
  if (["QUOTE_PENDING", "REQUOTE"].includes(p1.state)) {
    const prod = getState().products.find((x) => x.id === p1.productId)!;
    actions.issueQuote(POOL, prod.tiers, 30, 35);
  }
  for (const who of ["buyerA", "buyerB", "buyerC"] as PersonaId[]) {
    const p = getState().pools.find((x) => x.id === POOL)!;
    const q = p.quotes.find((x) => x.status === "issued");
    if (q && p.members.find((m) => m.persona === who)?.state === "COMMITTED") actions.accept(POOL, who, q.hash);
  }
  if (getState().pools.find((x) => x.id === POOL)!.state === "CONFIRMATION") actions.finalizeNow(POOL);
}

export function ffSupplierAccepts() {
  ffToPurchaseOrders();
  for (const o of getState().pos.filter((x) => x.poolId === POOL && x.state === "ISSUED")) actions.poEvent(o.id, "supplier_accept", "supplier");
}

export const myPo = (persona: PersonaId = "buyerA") => getState().pos.find((x) => x.poolId === POOL && x.buyer === persona);

export async function payAdvance(persona: PersonaId = "buyerA", outcome: "settled" | "failed" = "settled") {
  ffSupplierAccepts();
  const o = myPo(persona);
  if (!o || o.state !== "AWAITING_ADVANCE") return;
  const id = actions.quotePayment(o.id, "advance");
  const pay = getState().payments.find((x) => x.id === id)!;
  actions.initiate(id, pay.idempotencyKey);
  await actions.providerSend(id, "pending");
  await wait(300);
  await actions.providerSend(id, outcome);
}

export function illustrativeDoc(poId: string, kind: DocKind, by: PersonaId) {
  const o = getState().pos.find((x) => x.id === poId)!;
  const name = { commercial_invoice: `SI-${o.number.slice(-4)}.pdf`, packing_list: `PL-${o.number.slice(-4)}.pdf`, bill_of_lading: `BL-NSAYOK-${o.number.slice(-4)}.pdf`, certificate_of_origin: `CoO-EIC-${o.number.slice(-4)}.pdf`, inspection_report: `INSP-${o.number.slice(-4)}.pdf` }[kind];
  const sha = Array.from(name + kind + o.id).reduce((h, c) => ((h * 31 + c.charCodeAt(0)) >>> 0), 7).toString(16).padStart(8, "0").repeat(8);
  actions.addDoc(poId, kind, `${name} (illustrative)`, sha, by);
}

export async function ffToShipped(persona: PersonaId = "buyerA") {
  await payAdvance(persona);
  const o = myPo(persona);
  if (!o) return;
  if (o.state === "IN_PRODUCTION") {
    illustrativeDoc(o.id, "commercial_invoice", "supplier");
    illustrativeDoc(o.id, "packing_list", "supplier");
    illustrativeDoc(o.id, "certificate_of_origin", "supplier");
    actions.poEvent(o.id, "ready", "supplier");
  }
  if (myPo(persona)!.state === "READY_TO_SHIP") {
    illustrativeDoc(o.id, "bill_of_lading", "supplier");
    actions.poEvent(o.id, "ship", "supplier");
  }
}

export async function scenarioFailedPayment() {
  ffSupplierAccepts();
  const o = myPo("buyerB");
  if (!o || o.state !== "AWAITING_ADVANCE") return;
  await payAdvance("buyerB", "failed");
}

export function scenarioCancelBeforeAcceptance() {
  ffToPurchaseOrders();
  const o = myPo("buyerC");
  if (o && o.state === "ISSUED") actions.poEvent(o.id, "cancel", "buyerC", "Buyer cancelled before supplier acceptance");
}

export { scheduleProviderAck };
