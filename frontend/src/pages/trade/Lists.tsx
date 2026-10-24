import { ArrowRight, Package, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { MEMBER_STATE, PO_STATE, POOL_STATE } from "../../trade/labels";
import { committedQty, interestedQty } from "../../trade/logic";
import { fmtQty } from "../../trade/money";
import { PERSONAS, PORTS } from "../../trade/seed";
import { useTrade } from "../../trade/store";
import { Chip, Countdown, Prov, SectionTitle, TradeShell, useL } from "../../trade/ui";

export function Pools() {
  const s = useTrade();
  const { p, lang } = useL();
  return (
    <TradeShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <SectionTitle kicker={p("Order pools", "共同発注")} title={p("Combine demand to reach a supplier's tier", "需要をまとめて数量単価帯へ")}
          right={<Link to="/rfq/new" className="btn-red text-[13px]"><Plus size={14} />{p("New RFQ / pool", "新規見積依頼・共同発注")}</Link>} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {s.pools.map((pl) => {
            const prod = s.products.find((x) => x.id === pl.productId)!;
            const c = committedQty(pl), i = interestedQty(pl);
            const st = POOL_STATE[pl.state];
            const mine = pl.members.find((m) => m.persona === s.persona);
            return (
              <Link key={pl.id} to={`/pool/${pl.id}`} className="panel group flex flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start justify-between gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-stage"><Package size={18} className="text-ink-2" /></div>
                  <div className="flex flex-col items-end gap-1"><Chip tone={st.tone}>{p(st.l[0], st.l[1])}</Chip><Prov kind="ILLUSTRATIVE" /></div>
                </div>
                <div className="mt-3 text-[15px] font-semibold leading-snug text-ink">{p(prod.title_en, prod.title_ja)}</div>
                <div className="mt-1 text-[12px] text-ink-3">{pl.incoterm} → {p(PORTS[pl.destPort].name, PORTS[pl.destPort].name_ja)}</div>
                <div className="mt-4">
                  <div className="flex justify-between text-[11.5px]"><span className="font-mono text-ink">{fmtQty(c, lang)}</span><span className="text-muted">{p("min", "目標")} {fmtQty(pl.minQty, lang)}</span></div>
                  <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-stage">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-[repeating-linear-gradient(45deg,#d5d9e0_0,#d5d9e0_4px,transparent_4px,transparent_8px)]" style={{ width: `${Math.min(100, ((c + i) / pl.minQty) * 100)}%` }} />
                    <div className={`absolute inset-y-0 left-0 rounded-full ${c >= pl.minQty ? "bg-verified" : "bg-[#1E3A5F]"}`} style={{ width: `${Math.min(100, (c / pl.minQty) * 100)}%` }} />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[12px]">
                  <span className="text-ink-3">{pl.state === "OPEN" ? <>{p("closes in", "締切まで")} <Countdown to={pl.closesAt} /></> : p(st.d[0], st.d[1]).slice(0, 48) + "…"}</span>
                  {mine && <Chip tone={MEMBER_STATE[mine.state].tone}>{p("You:", "自社：")} {p(MEMBER_STATE[mine.state].l[0], MEMBER_STATE[mine.state].l[1])}</Chip>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </TradeShell>
  );
}

export function Orders() {
  const s = useTrade();
  const { p, lang, money } = useL();
  const role = PERSONAS[s.persona].role;
  const supplierId = PERSONAS[s.persona].supplierId;
  const rows = s.pos.filter((o) => role === "ops" || o.buyer === s.persona || (role === "supplier" && o.supplierId === supplierId));
  return (
    <TradeShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <SectionTitle kicker={p("Purchase orders", "発注書")} title={role === "supplier" ? p("Orders from Japanese buyers", "日本の買い手からの発注") : role === "ops" ? p("All orders (ops view)", "全発注（運営ビュー）") : p("Your orders", "自社の発注")} />
        {rows.length === 0 ? (
          <div className="panel p-10 text-center">
            <div className="text-[14px] text-ink-2">{p("No purchase orders yet.", "発注書はまだありません。")}</div>
            <p className="mt-1 text-[12.5px] text-muted">{p("Orders are created when a pool confirms and you have accepted the quote.", "共同発注が確定し、見積を承諾すると発注書が作成されます。")}</p>
            <Link to="/trade" className="btn-ink mt-4 text-[12.5px]">{p("Go to scenarios", "シナリオへ")} <ArrowRight size={13} /></Link>
          </div>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead><tr className="border-b border-line text-left text-[11.5px] text-muted">
                {[p("PO", "発注番号"), p("Product", "製品"), p("Buyer", "買い手"), p("Quantity", "数量"), p("Value", "金額"), p("Status", "状況"), p("Next", "次の対応"), ""].map((h, i) => <th key={i} className="px-4 py-2.5 font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((o) => {
                  const prod = s.products.find((x) => x.id === o.productId)!;
                  const st = PO_STATE[o.state];
                  return (
                    <tr key={o.id} className="border-b border-line last:border-0 hover:bg-wash">
                      <td className="px-4 py-3 font-mono font-semibold">{o.number}</td>
                      <td className="px-4 py-3">{p(prod.title_en, prod.title_ja)}</td>
                      <td className="px-4 py-3">{p(PERSONAS[o.buyer].name, PERSONAS[o.buyer].name_ja)}</td>
                      <td className="px-4 py-3 font-mono">{fmtQty(o.qty, lang)}</td>
                      <td className="px-4 py-3 font-mono">{money(o.subtotal)}</td>
                      <td className="px-4 py-3"><Chip tone={st.tone}>{p(st.l[0], st.l[1])}</Chip></td>
                      <td className="px-4 py-3 text-[12px] text-ink-3">{p(st.next[0], st.next[1])}</td>
                      <td className="px-4 py-3 text-right"><Link to={`/orders/${o.id}`} className="btn-ghost text-[12px]">{p("Open", "開く")}</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TradeShell>
  );
}
