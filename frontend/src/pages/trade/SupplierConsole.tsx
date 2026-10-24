import { ChevronRight, ClipboardList, FileSignature, Package, Truck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PO_STATE, POOL_STATE } from "../../trade/labels";
import { committedQty, memberBucket } from "../../trade/logic";
import { fmtQty, major } from "../../trade/money";
import { PERSONAS, PORTS } from "../../trade/seed";
import { actions, useTrade } from "../../trade/store";
import type { PriceTier } from "../../trade/types";
import { Chip, Countdown, Prov, SupplierBadge, TradeShell, useL } from "../../trade/ui";

function QuoteForm({ poolId }: { poolId: string }) {
  const s = useTrade();
  const { p, lang, money } = useL();
  const pool = s.pools.find((x) => x.id === poolId)!;
  const prod = s.products.find((x) => x.id === pool.productId)!;
  const [tiers, setTiers] = useState(prod.tiers.map((t) => ({ min: t.min_qty, price: (t.unit.minor / 100).toFixed(2) })));
  const [adv, setAdv] = useState(30);
  const [lead, setLead] = useState(prod.lead_days);
  const valid = tiers.every((t) => /^\d+(\.\d{1,2})?$/.test(t.price) && t.min > 0);
  const total = committedQty(pool);
  const issue = () => {
    const ts: PriceTier[] = tiers.map((t) => ({ min_qty: t.min, unit: major(t.price, "INR") }));
    actions.issueQuote(pool.id, ts, adv, lead);
  };
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-stage p-3 text-[13px]">
        <div className="label">{p("Aggregate demand (buyers anonymous)", "合計需要（買い手は匿名）")}</div>
        <div className="num text-[32px] leading-none text-ink">{fmtQty(total, lang)} <span className="font-sans text-[13px] text-muted">{prod.unit}</span></div>
        <div className="mt-1 text-[12px] text-ink-3">{memberBucket(pool.members.filter((m) => ["COMMITTED", "ACCEPTED"].includes(m.state)).length)} {p("buyers", "社")} · {PORTS[pool.destPort].name} · {pool.windowStart} – {pool.windowEnd}</div>
      </div>
      <div className="label">{p("Price tiers (₹ per unit)", "数量単価（₹/個）")}</div>
      {tiers.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-24 shrink-0 font-mono text-[13px] text-ink-3">{fmtQty(t.min, lang)}+</span>
          <input inputMode="decimal" value={t.price} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
            className={`h-12 flex-1 rounded-xl border px-3 font-mono text-[16px] outline-none focus:border-ink ${total >= t.min && (!tiers[i + 1] || total < tiers[i + 1].min) ? "border-verified bg-verified-soft" : "border-line"}`} />
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[12px]"><span className="label">{p("Advance %", "前払%")}</span><input type="number" min={0} max={100} value={adv} onChange={(e) => setAdv(Math.min(100, Math.max(0, Number(e.target.value))))} className="mt-1 h-12 w-full rounded-xl border border-line px-3 text-[16px]" /></label>
        <label className="text-[12px]"><span className="label">{p("Lead time (days)", "リードタイム（日）")}</span><input type="number" min={1} value={lead} onChange={(e) => setLead(Math.max(1, Number(e.target.value)))} className="mt-1 h-12 w-full rounded-xl border border-line px-3 text-[16px]" /></label>
      </div>
      <button disabled={!valid} onClick={issue} className="btn-red h-12 w-full text-[15px]"><FileSignature size={16} />{pool.quotes.length ? p(`Issue revised quote v${pool.quotes.length + 1}`, `改訂見積v${pool.quotes.length + 1}を発行`) : p("Issue quote v1", "見積v1を発行")}</button>
      <p className="text-[11.5px] text-ink-3">{p("Quotes are immutable once issued. A revision resets every buyer's acceptance.", "発行後の見積は変更不可。改訂すると全買い手の承諾がリセットされます。")} {money(major(tiers[0]?.price || "0", "INR"))}</p>
    </div>
  );
}

export default function SupplierConsole() {
  const s = useTrade();
  const { p, lang, money } = useL();
  const [tab, setTab] = useState<"rfq" | "orders" | "catalogue">("rfq");
  const supplierId = PERSONAS.supplier.supplierId!;
  const sup = s.suppliers.find((x) => x.id === supplierId)!;
  const products = s.products.filter((x) => x.supplierId === supplierId);
  const pools = s.pools.filter((x) => products.some((pr) => pr.id === x.productId));
  const orders = s.pos.filter((o) => o.supplierId === supplierId);
  const isSupplier = s.persona === "supplier";
  const [openPool, setOpenPool] = useState<string | null>(null);

  return (
    <TradeShell wide={false}>
      <div className="mx-auto max-w-[460px] px-4 py-5">
        {!isSupplier && (
          <div className="mb-3 rounded-xl border border-amber/40 bg-amber-soft p-3 text-[12.5px] text-[#8a4b05]">
            {p("You are viewing as a buyer. Switch to the Supplier persona to act.", "買い手として表示中です。操作するにはサプライヤーに切り替えてください。")}
            <button onClick={() => actions.setPersona("supplier")} className="ml-2 font-semibold underline">{p("Switch", "切替")}</button>
          </div>
        )}
        <div className="rounded-2xl bg-ink p-4 text-white">
          <div className="flex items-center justify-between"><div className="text-[11px] uppercase tracking-wider text-white/60">{p("Supplier console", "サプライヤー画面")}</div><Prov kind="ILLUSTRATIVE" /></div>
          <div className="mt-1 text-[18px] font-semibold">{sup.name}</div>
          <div className="mt-2"><SupplierBadge supplier={sup} /></div>
        </div>
        <div className="sticky top-[118px] z-10 mt-3 grid grid-cols-3 gap-1 rounded-xl bg-stage p-1">
          {([["rfq", ClipboardList, "Pooled RFQs", "共同見積"], ["orders", Truck, "Orders", "受注"], ["catalogue", Package, "Catalogue", "カタログ"]] as const).map(([k, I, en, ja]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium ${tab === k ? "bg-paper shadow-card" : "text-ink-3"}`}><I size={15} />{p(en, ja)}</button>
          ))}
        </div>

        <div className="mt-3 space-y-3">
          {tab === "rfq" && pools.map((pl) => {
            const prod = products.find((x) => x.id === pl.productId)!;
            const st = POOL_STATE[pl.state];
            const actionable = ["QUOTE_PENDING", "REQUOTE", "CONFIRMATION"].includes(pl.state);
            return (
              <div key={pl.id} className="panel overflow-hidden">
                <button onClick={() => setOpenPool(openPool === pl.id ? null : pl.id)} className="flex w-full items-center gap-3 p-4 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><Chip tone={st.tone}>{p(st.l[0], st.l[1])}</Chip>{actionable && <span className="h-2 w-2 animate-pulse rounded-full bg-hinomaru" />}</div>
                    <div className="mt-1.5 truncate text-[14px] font-semibold text-ink">{p(prod.title_en, prod.title_ja)}</div>
                    <div className="text-[12px] text-ink-3">{fmtQty(committedQty(pl), lang)} {prod.unit} · {pl.state === "OPEN" ? <><Countdown to={pl.closesAt} /> {p("left", "残り")}</> : PORTS[pl.destPort].name}</div>
                  </div>
                  <ChevronRight size={18} className={`text-muted transition ${openPool === pl.id ? "rotate-90" : ""}`} />
                </button>
                {openPool === pl.id && (
                  <div className="border-t border-line p-4">
                    {actionable && isSupplier ? <QuoteForm poolId={pl.id} /> : <p className="text-[12.5px] text-ink-3">{pl.state === "OPEN" ? p("Buyers are still committing. You'll quote when the pool closes at or above the threshold.", "買い手が確約中です。目標到達で締切後に見積します。") : p(st.d[0], st.d[1])}</p>}
                  </div>
                )}
              </div>
            );
          })}

          {tab === "orders" && (orders.length === 0 ? <div className="panel p-6 text-center text-[13px] text-muted">{p("No orders yet.", "受注はまだありません。")}</div> : orders.map((o) => {
            const st = PO_STATE[o.state];
            return (
              <Link key={o.id} to={`/orders/${o.id}`} className="panel flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="font-mono text-[13px] font-semibold">{o.number}</span><Chip tone={st.tone}>{p(st.l[0], st.l[1])}</Chip></div>
                  <div className="mt-1 text-[12px] text-ink-3">{p("Buyer", "買い手")} {PERSONAS[o.buyer].name} · {fmtQty(o.qty, lang)} · {money(o.subtotal)}</div>
                  <div className="mt-0.5 text-[11.5px] text-[#1E3A5F]">{p(st.next[0], st.next[1])}</div>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </Link>
            );
          }))}

          {tab === "catalogue" && products.map((pr) => (
            <div key={pr.id} className="panel p-4">
              <div className="text-[14px] font-semibold text-ink">{p(pr.title_en, pr.title_ja)}</div>
              <div className="mt-1 text-[12px] text-ink-3">MOQ {fmtQty(pr.moq, lang)} · {pr.incoterm} · {pr.lead_days} {p("days", "日")}</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">{pr.tiers.map((t) => <div key={t.min_qty} className="rounded-lg bg-stage px-2.5 py-1.5 text-[12px]"><span className="text-muted">{fmtQty(t.min_qty, lang)}+</span> <b className="font-mono">{money(t.unit)}</b></div>)}</div>
            </div>
          ))}
        </div>
      </div>
    </TradeShell>
  );
}
