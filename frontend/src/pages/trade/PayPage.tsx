import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Landmark, Lock, RefreshCcw, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PAY_STATE } from "../../trade/labels";
import { PERSONAS } from "../../trade/seed";
import { actions, scheduleProviderAck, useTrade } from "../../trade/store";
import { Chip, Countdown, fmtDate, Gloss, Prov, SectionTitle, StatusHeader, TradeShell, useL } from "../../trade/ui";

export default function PayPage() {
  const { poId } = useParams();
  const [params] = useSearchParams();
  const purpose = (params.get("purpose") === "balance" ? "balance" : "advance") as "advance" | "balance";
  const s = useTrade();
  const { p, lang, money } = useL();
  const [busy, setBusy] = useState(false);
  const o = s.pos.find((x) => x.id === poId);
  if (!o) return <TradeShell><div className="p-10 text-center text-muted">{p("Order not found", "見つかりません")}</div></TradeShell>;
  const me = s.persona;
  const sup = s.suppliers.find((x) => x.id === o.supplierId)!;
  const pay = [...s.payments].reverse().find((x) => x.poId === o.id && x.purpose === purpose);
  const isBuyer = me === o.buyer, isOps = PERSONAS[me].role === "ops";
  const share = purpose === "advance" ? Math.round((o.subtotal.minor * o.advancePct) / 100) : o.subtotal.minor - Math.round((o.subtotal.minor * o.advancePct) / 100);
  const st = pay ? PAY_STATE[pay.state] : PAY_STATE.UNQUOTED;
  const eligible = purpose === "advance" ? o.state === "AWAITING_ADVANCE" : ["SHIPPED", "DELIVERED"].includes(o.state);
  const quoteLive = pay?.state === "QUOTED" && pay.quote && Date.now() < pay.quote.expiresAt;

  const getQuote = () => actions.quotePayment(o.id, purpose);
  const confirm = () => {
    if (!pay) return;
    if (actions.initiate(pay.id, pay.idempotencyKey)) scheduleProviderAck(pay.id);
  };
  const doubleSubmit = () => {
    if (!pay) return;
    actions.initiate(pay.id, pay.idempotencyKey);
    actions.initiate(pay.id, pay.idempotencyKey); // same key: second is ignored
    scheduleProviderAck(pay.id);
  };
  const sim = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <TradeShell>
      <div className="mx-auto max-w-[1300px] space-y-5 px-4 py-6 sm:px-6">
        <div>
          <Link to={`/orders/${o.id}`} className="mb-1 inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink"><ArrowLeft size={13} />{o.number}</Link>
          <h1 className="flex flex-wrap items-center gap-2.5 text-[24px] font-semibold tracking-tight text-ink">
            {purpose === "advance" ? p(`Pay ${o.advancePct}% advance`, `前払${o.advancePct}%の支払`) : p("Pay balance", "残金の支払")}
            <Chip tone={st.tone}>{p(st.l[0], st.l[1])}</Chip><Prov kind="SIMULATED" />
          </h1>
        </div>

        <StatusHeader
          happening={pay ? p(st.l[0], st.l[1]) : p("No quote yet — get a JPY quote for the supplier's INR invoice", "未見積：INR請求に対する円建て見積を取得")}
          commitment={pay && ["INITIATED", "PENDING", "SETTLED"].includes(pay.state) ? <>{p("Instruction sent for", "送金指示額")} <b>{money(pay.quote!.payable)}</b></> : p("Nothing moves until you confirm a live quote", "有効な見積を確認するまで送金されません")}
          risk={p("The quote expires; the supplier's bank may deduct intermediary fees; a payment can fail and must be re-quoted.", "見積は期限切れになります。中継銀行手数料が差し引かれる場合や、支払失敗時は再見積が必要です。")}
          next={pay?.state === "PENDING" ? p("Provider settles or fails the transfer", "プロバイダーが着金または失敗を通知") : pay?.state === "SETTLED" ? p("Reconciled — order moves on", "照合済・発注が進行") : p("You (buyer)", "買い手")}
          missing={!eligible && pay?.state !== "SETTLED" ? p(`Not payable in order state ${o.state}`, `発注状況${o.state}では支払不可`) : undefined}
          tone={pay?.state === "SETTLED" ? "green" : pay?.state === "FAILED" || pay?.state === "REVERSED" ? "red" : "blue"}
          evidence={pay && <span className="font-mono text-[11px]">{pay.id} · idem {pay.idempotencyKey.slice(0, 14)}…</span>} />

        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          {/* Quote card */}
          <div className="panel overflow-hidden">
            <div className="relative overflow-hidden bg-ink px-5 py-5 text-white">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-hinomaru/30 blur-3xl" />
              <div className="relative grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-white/60">{p("Supplier invoice", "サプライヤー請求")}</div>
                  <div className="num text-[34px] leading-none">{money({ minor: share, ccy: "INR" })}</div>
                  <div className="mt-1 font-mono text-[11px] text-white/60">SI/{o.number.slice(-4)} · {sup.name.split(" ")[0]}</div>
                </div>
                <motion.div animate={{ x: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.8 }} className="hidden sm:block"><ArrowRight className="text-white/50" /></motion.div>
                <div className="sm:text-right">
                  <div className="text-[11px] uppercase tracking-wider text-white/60">{p("You pay", "お支払額")}</div>
                  <div className="num text-[34px] leading-none text-white">{pay?.quote ? money(pay.quote.payable) : "¥ —"}</div>
                  <div className="mt-1 text-[11px] text-white/60">{pay?.quote ? <>1 INR = ¥{pay.quote.rate} · {fmtDate(pay.quote.quotedAt, lang)}</> : <Gloss k="fx">{p("FX quote needed", "為替見積が必要")}</Gloss>}</div>
                </div>
              </div>
            </div>
            <div className="p-5">
              {pay?.quote && (
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-wash p-3"><div className="label">{p("Quote expires", "見積期限")}</div><div className="text-[15px] font-semibold">{quoteLive ? <Countdown to={pay.quote.expiresAt} wall /> : ["INITIATED", "PENDING", "SETTLED"].includes(pay.state) ? <span className="text-verified">{p("used", "使用済")}</span> : <span className="text-hinomaru-deep">{p("expired", "期限切れ")}</span>}</div></div>
                  <div className="rounded-lg bg-wash p-3"><div className="label">{p("Provider fee", "プロバイダー手数料")}</div><div className="text-[15px] font-semibold">{money(pay.quote.fee)} <span className="text-[10px] font-normal text-muted">{p("quoted", "見積")}</span></div></div>
                  <div className="rounded-lg bg-wash p-3"><div className="label">{p("Intermediary bank", "中継銀行")}</div><div className="text-[15px] font-semibold text-amber">{p("Unknown", "不明")}</div></div>
                </div>
              )}
              <div className="rounded-lg border border-line p-3 text-[12px]">
                <div className="label mb-1">{p("Not included in this payment", "この支払に含まれないもの")}</div>
                <div className="flex flex-wrap gap-1.5">{[p("Sea freight", "海上運賃"), p("Insurance", "保険"), p("Japanese import duty", "関税"), p("Import consumption tax", "輸入消費税"), p("Customs broker", "通関手数料"), p("Domestic delivery", "国内配送")].map((x) => <Chip key={x}>{x}</Chip>)}</div>
              </div>
              {isBuyer && eligible && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {(!pay || ["UNQUOTED", "EXPIRED", "FAILED"].includes(pay.state) || (pay.state === "QUOTED" && !quoteLive)) && <button onClick={getQuote} className="btn-ink text-[13px]"><RefreshCcw size={14} />{pay ? p("Get a new quote", "再見積") : p("Get JPY quote", "円建て見積を取得")}</button>}
                  {quoteLive && <button onClick={confirm} className="btn-red text-[13px]"><Lock size={14} />{p(`Confirm & send ${money(pay!.quote!.payable)}`, `${money(pay!.quote!.payable)}を確定・送金指示`)}</button>}
                  {quoteLive && <button onClick={doubleSubmit} className="btn-ghost text-[12px]" title="idempotency demo">{p("Double-submit test", "二重送信テスト")}</button>}
                </div>
              )}
              {pay?.state === "SETTLED" && <div className="mt-4 flex items-center gap-2 rounded-lg bg-verified-soft p-3 text-[13px] text-verified"><CheckCircle2 size={16} />{p("Settled (SIMULATED) and reconciled:", "着金（シミュレーション）・照合：")} {pay.reconciliation?.status}{pay.reconciliation?.status !== "matched" && ` — ${p("expected", "予定")} ${money(pay.reconciliation!.expected)}, ${p("received", "受領")} ${money(pay.reconciliation!.received)}`}</div>}
            </div>
          </div>

          <div className="space-y-5">
            <div className="panel p-4">
              <SectionTitle kicker={p("Payment path", "支払経路")} title={p("How the money would move", "資金の流れ")} />
              <div className="flex items-center justify-between gap-2 text-center text-[11px]">
                {[{ i: Building2, en: "Your bank (JP)", ja: "自社銀行（日本）" }, { i: Zap, en: "Provider (SIMULATED)", ja: "プロバイダー（模擬）" }, { i: Landmark, en: "Supplier's AD bank (IN)", ja: "サプライヤーのAD銀行" }].map((x, i, arr) => (
                  <div key={x.en} className="flex flex-1 items-center gap-2">
                    <div className="flex flex-1 flex-col items-center gap-1"><div className={`grid h-11 w-11 place-items-center rounded-full ${i === 1 ? "bg-amber text-white" : "bg-stage text-ink-2"}`}><x.i size={18} /></div>{p(x.en, x.ja)}</div>
                    {i < arr.length - 1 && <ArrowRight size={14} className="text-muted" />}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-ink-3">{p("Prototype: a SIMULATED provider; no money moves. Pilot: a bank transfer from your bank to the supplier's Indian authorised-dealer bank, with Shinrai recording the quote, proof and reconciliation. Shinrai never holds funds. UPI is not used — it has no Japan→India B2B product.",
                "試作：模擬プロバイダーで送金は発生しません。パイロット：自社銀行からサプライヤーのインドAD銀行への送金を、信頼が見積・証憑・照合として記録します。信頼は資金を預かりません。UPIは使用しません。")}</p>
            </div>

            <div className="panel p-4">
              <SectionTitle kicker={p("Provider events", "プロバイダーイベント")} title={p("Signed webhooks", "署名付きWebhook")} />
              {pay?.events.length ? (
                <ol className="space-y-2">
                  {pay.events.map((e) => (
                    <li key={e.id} className="flex items-start gap-2 text-[12px]">
                      {e.signatureValid ? <ShieldCheck size={14} className="mt-0.5 text-verified" /> : <ShieldAlert size={14} className="mt-0.5 text-hinomaru" />}
                      <div><span className="font-mono font-semibold">{e.type}</span> <span className="font-mono text-[10.5px] text-muted">{e.id}</span>
                        <div className="text-ink-3">{e.signatureValid ? (e.applied ? p("HMAC verified · applied", "HMAC検証済・適用") : e.note) : e.note}</div></div>
                    </li>
                  ))}
                </ol>
              ) : <div className="text-[12px] text-muted">{p("No events yet.", "イベントなし")}</div>}
            </div>

            {pay && ["INITIATED", "PENDING", "SETTLED"].includes(pay.state) && (isBuyer || isOps) && (
              <div className="panel border-amber/50 p-4">
                <div className="mb-2 flex items-center gap-2"><Prov kind="SIMULATED" /><span className="text-[13px] font-semibold text-ink">{p("Provider simulator", "プロバイダー・シミュレーター")}</span></div>
                <p className="mb-3 text-[11.5px] text-ink-3">{p("Stands in for a regulated provider's signed webhooks, so every outcome can be demonstrated.", "規制下のプロバイダーの署名付きWebhookの代わりに、各結果を再現します。")}</p>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy} onClick={() => sim(() => actions.providerSend(pay.id, "settled"))} className="btn-ghost text-[12px] text-verified">{p("Settle", "着金")}</button>
                  <button disabled={busy} onClick={() => sim(() => actions.providerSend(pay.id, "settled", { short: true }))} className="btn-ghost text-[12px]">{p("Settle short", "不足額で着金")}</button>
                  <button disabled={busy} onClick={() => sim(() => actions.providerSend(pay.id, "failed"))} className="btn-ghost text-[12px] text-hinomaru-deep">{p("Fail", "失敗")}</button>
                  <button disabled={busy} onClick={() => sim(() => actions.providerSend(pay.id, "reversed"))} className="btn-ghost text-[12px]">{p("Reverse", "組戻し")}</button>
                  <button disabled={busy || !pay.events.length} onClick={() => sim(() => actions.providerSend(pay.id, pay.events[pay.events.length - 1].type, { dupOf: pay.events[pay.events.length - 1].id }))} className="btn-ghost text-[12px]">{p("Duplicate last event", "直前イベントを重複送信")}</button>
                  <button disabled={busy} onClick={() => sim(() => actions.providerSend(pay.id, "settled", { forge: true }))} className="btn-ghost text-[12px]">{p("Forged webhook", "偽造Webhook")}</button>
                  <button disabled={busy} onClick={() => sim(() => actions.providerSend(pay.id, "pending"))} className="btn-ghost text-[12px]">{p("Out-of-order 'pending'", "順序外の pending")}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TradeShell>
  );
}
