import { motion } from "framer-motion";
import { ArrowLeft, Check, EyeOff, FileSignature, Lock, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MEMBER_STATE, POOL_STATE } from "../../trade/labels";
import { acceptedQty, committedQty, interestedQty, memberBucket, tierFor } from "../../trade/logic";
import { fmtQty, major } from "../../trade/money";
import { PERSONAS, PORTS } from "../../trade/seed";
import { actions, myLanded, useTrade } from "../../trade/store";
import PoolContainer, { type CrateSegment } from "../../trade/three/PoolContainer";
import TierStairs from "../../trade/three/TierStairs";
import { Chip, Countdown, fmtDate, Gloss, LandedCompare, Prov, SectionTitle, StatusHeader, SupplierBadge, TradeShell, useL } from "../../trade/ui";

export default function PoolPage() {
  const { id } = useParams();
  const s = useTrade();
  const { p, ja, lang, money } = useL();
  const pool = s.pools.find((x) => x.id === id);
  const me = s.persona;
  const role = PERSONAS[me].role;
  const prod = pool && s.products.find((x) => x.id === pool.productId)!;
  const sup = prod && s.suppliers.find((x) => x.id === prod.supplierId)!;
  const mine = pool?.members.find((x) => x.persona === me);
  const [qty, setQty] = useState<number>(mine?.qty ?? (prod ? (prod.moq >= 10_000 ? Math.round((prod.moq * 1.2) / 1000) * 1000 : prod.moq) : 1000));
  const [ceiling, setCeiling] = useState<string>(mine?.ceiling ? (mine.ceiling.minor / 100).toFixed(2) : prod ? (prod.tiers[1]?.unit.minor / 100 + 0.3).toFixed(2) : "0");
  const projected = useMemo(() => (pool ? myLanded(s, pool, me, role === "buyer" ? qty : undefined) : null), [s, pool, me, qty, role]);

  if (!pool || !prod || !sup) return <TradeShell><div className="p-10 text-center text-muted">{p("Pool not found", "見つかりません")}</div></TradeShell>;
  const st = POOL_STATE[pool.state];
  const committed = committedQty(pool), interested = interestedQty(pool), accepted = acceptedQty(pool);
  const reached = committed >= pool.minQty;
  const q = pool.quotes.find((x) => x.status === "issued");
  const activeMembers = pool.members.filter((m) => !["WITHDRAWN", "LAPSED", "RELEASED"].includes(m.state)).length;
  const myActive = mine && !["WITHDRAWN", "LAPSED", "RELEASED"].includes(mine.state);
  const myCounted = mine && ["COMMITTED", "ACCEPTED", "ORDERED"].includes(mine.state) ? mine.qty : 0;
  const tierNow = tierFor((q?.tiers ?? prod.tiers), committed);
  const isOrganiser = pool.organiser === me;
  const canSeeMembers = role === "ops";

  const segments: CrateSegment[] = [
    { key: "others", qty: committed - myCounted, kind: "other" },
    ...(myCounted ? [{ key: "mine", qty: myCounted, kind: "mine" as const }] : []),
    { key: "interest", qty: interested, kind: "interested" },
  ];

  const ceilingMoney = (() => {
    try {
      return /^\d+(\.\d{1,2})?$/.test(ceiling) ? major(ceiling, "INR") : null;
    } catch {
      return null;
    }
  })();

  // Seven-question header content per state and role.
  const header = (() => {
    const deadline = <><Countdown to={pool.closesAt} /> <span className="text-muted">({fmtDate(pool.closesAt, lang)})</span></>;
    if (pool.state === "OPEN") return {
      happening: <>{p("Pool open", "受付中")} · {fmtQty(committed, lang)} / {fmtQty(pool.minQty, lang)} {p("committed", "確約済")} {reached && <Chip tone="green">{p("threshold reached", "目標到達")}</Chip>}</>,
      commitment: myCounted ? p(`Conditional: ${fmtQty(myCounted, lang)} pcs, only if the final price ≤ your maximum and you accept`, `条件付き：${fmtQty(myCounted, lang)}個（最終単価が上限以下かつ承諾時のみ）`) : p("None yet", "まだありません"),
      risk: reached ? p("If you withdraw now the tier may drop for everyone.", "今辞退すると全員の単価帯が下がる可能性があります。") : <>{p("If the minimum isn't reached by the deadline, the pool closes and nobody is charged.", "締切までに目標未達なら終了し、誰にも費用は発生しません。")}</>,
      next: <>{p("Buyers commit until", "締切まで各社が確約")} {deadline}</>, tone: "blue" as const,
      missing: myActive ? undefined : p("Your quantity and maximum unit price", "数量と上限単価"),
    };
    if (pool.state === "QUOTE_PENDING" || pool.state === "REQUOTE") return {
      happening: p("Waiting for the supplier's quote on the combined volume", "サプライヤーの見積待ち"), commitment: myCounted ? p("Conditional — nothing binding until you accept a quote version", "条件付き・見積版を承諾するまで拘束なし") : p("None", "なし"),
      risk: p("The supplier may decline; then everyone is released.", "辞退された場合は全員解除されます。"), next: <>{p(sup.name, sup.name_ja)} · {p("issues quote", "見積を発行")}</>, tone: "amber" as const,
    };
    if (pool.state === "CONFIRMATION" && q) return {
      happening: <>{p(`Quote v${q.version} issued — accept to receive your own purchase order`, `見積v${q.version}発行・承諾で自社の発注書を受領`)}</>,
      commitment: mine?.state === "ACCEPTED" ? p(`You accepted terms ${q.hash.slice(0, 8)} — binding once the pool confirms`, `条件${q.hash.slice(0, 8)}を承諾済・確定時に拘束`) : myCounted ? p("Conditional until you accept", "承諾まで条件付き") : p("None", "なし"),
      risk: p("If accepted volume falls below the tier, the supplier may requote and everyone re-accepts.", "承諾数量が単価帯を下回ると再見積・再承諾になります。"),
      next: <>{p("Each buyer accepts within", "各社の承諾期限")} {pool.confirmUntil && <Countdown to={pool.confirmUntil} />}</>, tone: "amber" as const,
      evidence: <span className="font-mono text-[11.5px]">terms {q.hash}</span>,
    };
    if (pool.state === "CLOSED") return {
      happening: p("Closed — each accepted buyer has its own purchase order", "締切・各社に個別の発注書"), commitment: mine?.state === "ORDERED" ? p("Binding: your purchase order", "拘束：自社の発注書") : p("None", "なし"),
      risk: p("Other buyers' delays or cancellations don't change your order.", "他社の遅延・取消は自社の発注に影響しません。"), next: p("Supplier confirms each PO", "サプライヤーが各発注を確認"), tone: "green" as const,
    };
    return { happening: p(st.d[0], st.d[1]), commitment: p("None — no obligations", "なし・義務は発生しません"), risk: "—", next: p("No further action", "対応不要"), tone: "red" as const };
  })();

  const visibleEvents = s.events.filter((e) => (e.aggregate === "pool" && e.aggregateId === pool.id) || (e.aggregate === "membership" && e.aggregateId === `${pool.id}:${me}`) || (role === "ops" && e.aggregateId.startsWith(pool.id))).slice(-14).reverse();

  return (
    <TradeShell>
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/pools" className="mb-1 inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink"><ArrowLeft size={13} />{p("All pools", "共同発注一覧")}</Link>
            <h1 className="flex flex-wrap items-center gap-2.5 text-[24px] font-semibold tracking-tight text-ink">
              {p(prod.title_en, prod.title_ja)} <Chip tone={st.tone}>{p(st.l[0], st.l[1])}</Chip>
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
              <span><Gloss k="incoterm">{pool.incoterm}</Gloss> → {p(PORTS[pool.destPort].name, PORTS[pool.destPort].name_ja)}</span>
              <span>{p("Delivery window", "納期")} {pool.windowStart} – {pool.windowEnd}</span>
              <span className="flex items-center gap-1"><Users size={12} />{memberBucket(activeMembers)} {p("buyers", "社")}</span>
              <span>{p("Organiser: facilitator only", "主催者：仲介のみ")} {isOrganiser && <Chip tone="ink">{p("you", "自社")}</Chip>}</span>
            </div>
          </div>
          <div className="flex items-center gap-2"><SupplierBadge supplier={sup} /><Prov kind="ILLUSTRATIVE" /></div>
        </div>

        <StatusHeader {...header}
          action={role === "buyer" && pool.state === "OPEN" ? undefined : role === "supplier" && ["QUOTE_PENDING", "REQUOTE"].includes(pool.state)
            ? <Link to="/s" className="btn-red text-[12.5px]"><FileSignature size={14} />{p("Issue quote in supplier console", "サプライヤー画面で見積")}</Link> : undefined} />

        <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
          {/* 3D container + stats */}
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <div className="label">{p("Pooled demand", "まとめた需要")}</div>
                <div className="flex items-baseline gap-2">
                  <span className="num text-[34px] leading-none text-ink">{fmtQty(committed, lang)}</span>
                  <span className="text-[12.5px] text-muted">/ {fmtQty(pool.minQty, lang)} {p("min", "目標")} · {fmtQty(pool.maxQty, lang)} {p("capacity", "上限")}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] text-ink-3">
                <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-[#1E3A5F]" />{p("Your crates", "自社分")}</span>
                <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-[#C8A97E]" />{p("Other buyers (anonymous)", "他社（匿名）")}</span>
                <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border border-line-strong bg-white" />{p("Interest only", "関心のみ")}</span>
              </div>
            </div>
            <div className="stage-grid">
              <PoolContainer capacity={pool.maxQty} threshold={pool.minQty} segments={segments} reached={reached} height={400}
                thresholdLabel={reached ? p(`Threshold ${fmtQty(pool.minQty, lang)} ✓`, `目標${fmtQty(pool.minQty, lang)} ✓`) : p(`Threshold ${fmtQty(pool.minQty, lang)}`, `目標 ${fmtQty(pool.minQty, lang)}`)} />
            </div>
            <div className="grid grid-cols-2 border-t border-line text-[12px] sm:grid-cols-4">
              {[
                [p("Committed", "確約"), fmtQty(committed, lang)], [p("Interested", "関心"), fmtQty(interested, lang)],
                [p("Tier reached", "到達単価"), tierNow ? `${money(tierNow.unit)} @${fmtQty(tierNow.min_qty, lang)}+` : p("below MOQ", "MOQ未満")],
                [pool.state === "OPEN" ? p("Closes in", "締切まで") : p("Accepted", "承諾"), pool.state === "OPEN" ? <Countdown to={pool.closesAt} /> : fmtQty(accepted, lang)],
              ].map(([k, v], i) => <div key={i} className="border-line p-3 [&:not(:last-child)]:border-r"><div className="label">{k}</div><div className="mt-0.5 font-semibold text-ink">{v}</div></div>)}
            </div>
          </div>

          {/* Action panel */}
          <div className="space-y-5">
            {role === "buyer" && pool.state === "OPEN" && (
              <motion.div layout className="panel p-4">
                <SectionTitle kicker={p("Your commitment", "自社の確約")} title={myActive ? p(MEMBER_STATE[mine!.state].l[0], MEMBER_STATE[mine!.state].l[1]) : p("Join this pool", "この共同発注に参加")} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-[12px]"><span className="label"><Gloss k="moq">{p("Quantity (pcs)", "数量（個）")}</Gloss></span>
                    <input type="number" min={1} step={Math.max(1, Math.round(prod.moq / 10))} value={qty} onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value))))}
                      className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-mono text-[14px] outline-none focus:border-ink" />
                  </label>
                  <label className="text-[12px]"><span className="label"><Gloss k="ceiling" /> (₹)</span>
                    <input value={ceiling} onChange={(e) => setCeiling(e.target.value)} inputMode="decimal"
                      className={`mt-1 w-full rounded-lg border px-3 py-2 font-mono text-[14px] outline-none focus:border-ink ${ceilingMoney ? "border-line" : "border-hinomaru"}`} />
                  </label>
                </div>
                <input type="range" min={Math.max(1, Math.round(prod.moq / 10))} max={pool.maxQty} step={Math.max(1, Math.round(prod.moq / 10))} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="mt-3 w-full accent-[#1E3A5F]" aria-label="quantity" />
                <div className="mt-2 rounded-lg bg-wash p-2.5 text-[12px] text-ink-2">
                  <EyeOff size={12} className="mr-1 inline" />{p("Your name, quantity and maximum price are never shown to other buyers. The supplier never sees your maximum.", "社名・数量・上限単価は他社に表示されません。上限単価はサプライヤーにも非表示です。")}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={!ceilingMoney || qty <= 0} onClick={() => actions.join(pool.id, me, qty, ceilingMoney, "COMMITTED")} className="btn-red text-[13px]"><Lock size={13} />{myActive && mine!.state === "COMMITTED" ? p("Update commitment", "確約を更新") : p("Commit (conditional)", "確約する（条件付き）")}</button>
                  {(!myActive || mine!.state === "INTERESTED") && <button disabled={qty <= 0} onClick={() => actions.join(pool.id, me, qty, null, "INTERESTED")} className="btn-ghost text-[13px]">{p("Register interest only", "関心のみ登録")}</button>}
                  {myActive && <button onClick={() => actions.withdraw(pool.id, me)} className="btn-ghost text-[13px] text-hinomaru-deep">{p("Withdraw (free)", "辞退（無料）")}</button>}
                  {isOrganiser && reached && <button onClick={() => actions.closeEarly(pool.id, me)} className="btn-ink text-[13px]">{p("Close early & request quote", "早期締切・見積依頼")}</button>}
                </div>
                <p className="mt-2 text-[11.5px] text-muted">{p("Committing is not a purchase. You confirm your own purchase order only after the final quote.", "確約は購入ではありません。最終見積の後に自社の発注を確定します。")}</p>
              </motion.div>
            )}

            {pool.state === "CONFIRMATION" && q && (
              <div className="panel overflow-hidden">
                <div className="flex items-center justify-between border-b border-line bg-ink px-4 py-3 text-white">
                  <div><div className="text-[11px] uppercase tracking-wider text-white/60">{p("Supplier quote", "サプライヤー見積")}</div><div className="text-[16px] font-semibold">v{q.version} · {p("valid until", "有効期限")} {new Date(q.validUntil).toISOString().slice(0, 10)}</div></div>
                  <span className="rounded bg-white/10 px-2 py-1 font-mono text-[11px]">#{q.hash.slice(0, 10)}</span>
                </div>
                <div className="p-4">
                  <table className="w-full text-[12.5px]"><tbody>
                    {q.tiers.map((t) => <tr key={t.min_qty} className={`border-b border-line ${tierNow?.min_qty === t.min_qty ? "bg-verified-soft font-semibold text-verified" : ""}`}><td className="py-1.5 pl-2">{fmtQty(t.min_qty, lang)}+</td><td className="py-1.5 pr-2 text-right font-mono">{money(t.unit)}</td></tr>)}
                  </tbody></table>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                    <div><span className="label">{p("Payment terms", "支払条件")}</span><div>{q.advancePct}% {p("advance", "前払")} · {p(q.balanceTerms_en, q.balanceTerms_ja)}</div></div>
                    <div><span className="label">{p("Lead time", "リードタイム")}</span><div>{q.leadDays} {p("days", "日")}</div></div>
                  </div>
                  {role === "buyer" && mine && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {mine.state === "COMMITTED" && <button onClick={() => actions.accept(pool.id, me, q.hash)} className="btn-red text-[13px]"><Check size={14} />{p(`Accept v${q.version} for ${fmtQty(mine.qty, lang)} pcs`, `v${q.version}を${fmtQty(mine.qty, lang)}個で承諾`)}</button>}
                      {mine.state === "ACCEPTED" && <Chip tone="green">✓ {p("You accepted these exact terms", "この条件で承諾済")}</Chip>}
                      {["COMMITTED", "ACCEPTED"].includes(mine.state) && <button onClick={() => actions.decline(pool.id, me)} className="btn-ghost text-[13px]">{p("Decline", "辞退")}</button>}
                      {!["COMMITTED", "ACCEPTED"].includes(mine.state) && <Chip tone={MEMBER_STATE[mine.state].tone}>{p(MEMBER_STATE[mine.state].l[0], MEMBER_STATE[mine.state].l[1])} {mine.reason && `· ${mine.reason}`}</Chip>}
                    </div>
                  )}
                  {(role === "ops" || isOrganiser) && <button onClick={() => actions.finalizeNow(pool.id)} className="btn-ghost mt-3 text-[12px]">{p("Close acceptance window now (demo)", "承諾受付を締切（デモ）")}</button>}
                </div>
              </div>
            )}

            {mine && !myActive && (
              <div className="panel p-4 text-[13px]"><Chip tone={MEMBER_STATE[mine.state].tone}>{p(MEMBER_STATE[mine.state].l[0], MEMBER_STATE[mine.state].l[1])}</Chip><p className="mt-2 text-ink-3">{mine.reason ?? p("You have no obligation in this pool.", "この共同発注に義務はありません。")}</p></div>
            )}
            {mine?.state === "ORDERED" && (() => {
              const o = s.pos.find((x) => x.poolId === pool.id && x.buyer === me);
              return o ? <Link to={`/orders/${o.id}`} className="panel flex items-center justify-between p-4 text-[13px] hover:bg-wash"><span><b>{o.number}</b> · {p("your purchase order", "自社の発注書")}</span><span className="btn-ink text-[12px]">{p("Open", "開く")}</span></Link> : null;
            })()}

            <div className="panel p-4">
              <SectionTitle kicker={p("Price tiers", "数量単価帯")} title={<Gloss k="tier">{p("Where the pool stands", "現在の到達単価")}</Gloss>} />
              <div className="rounded-xl bg-wash">
                <TierStairs tiers={q?.tiers ?? prod.tiers} qty={projected?.total ?? committed} own={role === "buyer" ? qty : undefined} maxQty={pool.maxQty} height={230}
                  fmtPrice={(minor) => money({ minor, ccy: "INR" })} fmtQty={(n) => fmtQty(n, lang)} />
              </div>
              <div className="mt-2 flex gap-4 text-[11px] text-ink-3">
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#1E3A5F]" />{p("Pool (incl. your quantity)", "共同（自社含む）")}</span>
                {role === "buyer" && <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#9AA3B0]" />{p("You alone", "単独")}</span>}
              </div>
            </div>
          </div>
        </div>

        {projected && role === "buyer" && projected.qty > 0 && (
          <LandedCompare independent={projected.independent} pooled={projected.pooled} shared={projected.shared} qty={projected.qty} unitLabel={ja ? prod.unitLabel_ja : prod.unit} />
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="panel p-4">
            <SectionTitle kicker={p("Audit trail", "監査証跡")} title={p("What happened in this pool", "この共同発注の経緯")} right={<Link to="/ops" className="text-[12px] text-[#1E3A5F] hover:underline">{p("Full hash-chained log", "ハッシュ連鎖ログ")}</Link>} />
            <ol className="space-y-2">
              {visibleEvents.map((e) => (
                <li key={e.seq} className="flex gap-3 text-[12.5px]">
                  <span className="w-[120px] shrink-0 font-mono text-[11px] text-muted">{fmtDate(e.at, lang).replace(/ JST|GMT\+9/, "")}</span>
                  <span className="text-ink-2">{ja ? e.text_ja : e.text_en}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] text-muted">{p("Other buyers' membership events are hidden from you.", "他社の参加イベントは表示されません。")}</p>
          </div>
          <div className="panel p-4">
            <SectionTitle kicker={p("Rules of this pool", "この共同発注のルール")} title={p("No surprises", "想定外をなくす")} />
            <ul className="space-y-2 text-[12.5px] text-ink-2">
              {[
                ["Interest is non-binding and isn't counted toward the threshold.", "関心登録は拘束がなく、目標数量に含まれません。"],
                ["A commitment binds only if the final unit price is at or below your maximum and you accept that exact quote version.", "確約は、最終単価が上限以下で、その見積版を承諾した場合のみ拘束されます。"],
                ["Every quote is immutable and hashed. Any change creates a new version and resets acceptances.", "見積は変更不可でハッシュ化。変更時は新版となり承諾はリセットされます。"],
                ["Each buyer gets its own PO, invoice, payment and import. The organiser carries no duty for others.", "発注・請求・支払・輸入は各社個別。主催者は他社への責任を負いません。"],
                ["Pools never set members' resale prices, output or customers.", "共同発注は各社の再販価格・生産量・顧客を拘束しません。"],
              ].map(([en, jaT]) => <li key={en} className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-verified" />{p(en, jaT)}</li>)}
            </ul>
            {canSeeMembers && (
              <div className="mt-4 rounded-lg border border-line p-3">
                <div className="label mb-1.5">{p("Ops view — full membership (audited access)", "運営ビュー：全参加者（アクセス記録対象）")}</div>
                {pool.members.map((m) => <div key={m.persona} className="flex justify-between text-[12px]"><span>{PERSONAS[m.persona].name}</span><span className="font-mono">{fmtQty(m.qty, lang)} · {m.state}</span></div>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </TradeShell>
  );
}
