import { ArrowLeft, Check, CreditCard, FileUp, Flag, Printer, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { illustrativeDoc } from "../../trade/demo";
import { DOC, PAY_STATE, PO_FLOW_ORDER, PO_STATE } from "../../trade/labels";
import { fmtQty } from "../../trade/money";
import { PERSONAS, PORTS } from "../../trade/seed";
import { actions, nowOf, toast, useTrade } from "../../trade/store";
import TradeGlobe from "../../trade/three/TradeGlobe";
import type { DocKind } from "../../trade/types";
import { Chip, fmtDate, Gloss, Prov, SectionTitle, StatusHeader, SupplierBadge, TradeShell, useL } from "../../trade/ui";

const MAGIC: [string, number[]][] = [["pdf", [0x25, 0x50, 0x44, 0x46]], ["png", [0x89, 0x50, 0x4e, 0x47]], ["jpg", [0xff, 0xd8, 0xff]]];
async function inspect(file: File): Promise<{ ok: boolean; sha?: string; why_en?: string; why_ja?: string }> {
  if (file.size > 10 * 1024 * 1024) return { ok: false, why_en: "File is larger than 10 MB", why_ja: "10MBを超えています" };
  const buf = new Uint8Array(await file.arrayBuffer());
  if (!MAGIC.some(([, sig]) => sig.every((b, i) => buf[i] === b))) return { ok: false, why_en: "Only PDF, PNG or JPEG files are accepted (content check, not extension)", why_ja: "PDF・PNG・JPEGのみ（拡張子ではなく内容で判定）" };
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return { ok: true, sha: [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("") };
}

export default function OrderPage() {
  const { id } = useParams();
  const s = useTrade();
  const { p, ja, lang, money } = useL();
  const [dispute, setDispute] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<DocKind>("commercial_invoice");
  const o = s.pos.find((x) => x.id === id);
  if (!o) return <TradeShell><div className="p-10 text-center text-muted">{p("Order not found", "見つかりません")} · <Link to="/orders" className="underline">{p("orders", "発注一覧")}</Link></div></TradeShell>;
  const prod = s.products.find((x) => x.id === o.productId)!;
  const sup = s.suppliers.find((x) => x.id === o.supplierId)!;
  const pool = s.pools.find((x) => x.id === o.poolId)!;
  const me = s.persona, role = PERSONAS[me].role;
  const isBuyer = me === o.buyer, isSupplier = role === "supplier" && PERSONAS[me].supplierId === o.supplierId, isOps = role === "ops";
  if (!isBuyer && !isSupplier && !isOps) return <TradeShell><div className="mx-auto max-w-lg p-10 text-center"><div className="text-[15px] font-semibold text-ink">{p("Not a party to this order", "この発注の当事者ではありません")}</div><p className="mt-2 text-[12.5px] text-muted">{p("Orders, invoices and payments are visible only to the buyer, the supplier and audited ops staff.", "発注・請求・支払は買い手・サプライヤー・運営のみ閲覧できます。")}</p></div></TradeShell>;
  const st = PO_STATE[o.state];
  const pays = s.payments.filter((x) => x.poId === o.id);
  const adv = pays.find((x) => x.purpose === "advance"), bal = pays.find((x) => x.purpose === "balance");
  const advance = Math.round((o.subtotal.minor * o.advancePct) / 100);
  const now = nowOf(s);
  const shipProgress = o.state === "SHIPPED" && o.shipment ? Math.min(0.97, Math.max(0.03, (now - o.shipment.etd) / (o.shipment.eta - o.shipment.etd)))
    : ["DELIVERED", "COMPLETED"].includes(o.state) ? 1 : ["IN_PRODUCTION", "READY_TO_SHIP"].includes(o.state) ? 0 : null;
  const has = (k: DocKind) => o.docs.some((d) => d.kind === k);
  const idx = PO_FLOW_ORDER.indexOf(o.state === "SUPPLIER_ACCEPTED" ? "ISSUED" : o.state);

  const upload = async (file: File) => {
    const r = await inspect(file);
    if (!r.ok) return toast(r.why_en!, r.why_ja!, "err");
    actions.addDoc(o.id, uploadKind, file.name, r.sha!, me);
    toast(`${DOC[uploadKind][0]} stored · sha256 ${r.sha!.slice(0, 12)}…`, `${DOC[uploadKind][1]}を保存しました`);
  };

  const header = {
    happening: <>{o.number} · {p(st.l[0], st.l[1])}</>,
    commitment: ["CANCELLED"].includes(o.state) ? p("None — order cancelled", "なし（取消済）") : <>{p("Binding purchase order", "拘束力のある発注")}: <b>{money(o.subtotal)}</b> · {o.advancePct}% {p("advance", "前払")} ({money({ minor: advance, ccy: "INR" })})</>,
    next: <>{p(st.next[0], st.next[1])}</>,
    risk: o.state === "AWAITING_ADVANCE" ? p("If the advance isn't paid by the deadline the supplier may cancel. No money moves until you confirm.", "期限までに前払がない場合、取消の可能性があります。確認するまで送金は行われません。")
      : o.state === "SHIPPED" ? p("Inspect on arrival. Quality claims are raised as a dispute under this PO's terms.", "到着時に検品してください。品質問題はこの発注条件に基づき申立てます。")
      : p("Problems on this order never affect other buyers' orders from the same pool.", "この発注の問題は、同じ共同発注の他社の発注に影響しません。"),
    missing: o.state === "IN_PRODUCTION" && !(has("commercial_invoice") && has("packing_list")) ? p("Commercial invoice and packing list (supplier)", "商業送り状・梱包明細（サプライヤー）") : o.state === "READY_TO_SHIP" && !has("bill_of_lading") ? p("Bill of lading (supplier)", "B/L（サプライヤー）") : undefined,
    evidence: <span className="font-mono text-[11px]">terms {o.termsHash} · quote v{o.quoteVersion}</span>,
    tone: (st.tone === "green" ? "green" : st.tone === "red" ? "red" : st.tone === "amber" ? "amber" : "blue") as "green" | "red" | "amber" | "blue",
  };

  return (
    <TradeShell>
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link to="/orders" className="mb-1 inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink"><ArrowLeft size={13} />{p("Orders", "発注一覧")}</Link>
            <h1 className="flex flex-wrap items-center gap-2.5 text-[24px] font-semibold tracking-tight text-ink">{o.number}<Chip tone={st.tone}>{p(st.l[0], st.l[1])}</Chip><Prov kind="ILLUSTRATIVE" /></h1>
            <div className="mt-1 text-[12.5px] text-ink-3">{p(PERSONAS[o.buyer].name, PERSONAS[o.buyer].name_ja)} ← {p(sup.name, sup.name_ja)} · {p(prod.title_en, prod.title_ja)} · <Gloss k="ior">{p("buyer is importer of record", "買い手が輸入者")}</Gloss></div>
          </div>
          <button onClick={() => window.print()} className="btn-ghost text-[12.5px]"><Printer size={14} />{p("Print PO", "発注書を印刷")}</button>
        </div>

        <StatusHeader {...header} />

        {/* Stepper */}
        <div className="panel overflow-x-auto p-4">
          <ol className="flex min-w-[720px] items-center">
            {PO_FLOW_ORDER.map((k, i) => {
              const done = o.state !== "CANCELLED" && i < idx, cur = i === idx;
              return (
                <li key={k} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`grid h-8 w-8 place-items-center rounded-full text-[12px] font-semibold ring-2 transition ${done ? "bg-verified text-white ring-verified" : cur ? "bg-ink text-white ring-ink" : "bg-paper text-muted ring-line"}`}>{done ? <Check size={14} /> : i + 1}</div>
                    <div className={`whitespace-nowrap text-[11px] ${cur ? "font-semibold text-ink" : "text-muted"}`}>{p(PO_STATE[k].l[0], PO_STATE[k].l[1])}</div>
                  </div>
                  {i < PO_FLOW_ORDER.length - 1 && <div className={`mx-2 h-0.5 flex-1 rounded ${done ? "bg-verified" : "bg-line"}`} />}
                </li>
              );
            })}
          </ol>
          {["DISPUTED", "CANCELLED"].includes(o.state) && <div className="mt-3 rounded-lg bg-hinomaru-soft p-2.5 text-[12.5px] text-hinomaru-deep">{p(st.l[0], st.l[1])}{o.disputeNote && ` · ${o.disputeNote}`}</div>}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div><div className="label">{p("Shipment", "輸送")}</div><div className="text-[13px] font-medium text-ink">{p(PORTS[prod.originPort].name, PORTS[prod.originPort].name_ja)} → {p(PORTS[pool.destPort].name, PORTS[pool.destPort].name_ja)}</div></div>
              {o.shipment ? <div className="text-right text-[12px]"><div className="font-medium text-ink">{o.shipment.vessel}</div><div className="text-muted">B/L {o.shipment.bl} · ETA {fmtDate(o.shipment.eta, lang)}</div></div>
                : <span className="text-[12px] text-muted">{p("Not shipped yet", "未出荷")}</span>}
            </div>
            <TradeGlobe height={420} autoRotate={false} routes={[{ id: o.id, from: prod.originPort, to: pool.destPort, emphasis: true, progress: shipProgress }]}
              pins={[{ id: "sup", lat: sup.lat, lon: sup.lon, label: sup.name.split(" ")[0], tone: "green" }]} />
            {o.state === "SHIPPED" && <div className="border-t border-line px-4 py-2.5 text-[12px] text-ink-3">{p("Position is modelled from ETD/ETA on the demo clock, not live AIS tracking.", "位置はデモ時計上のETD/ETAから推定（実際のAIS追跡ではありません）。")} <button onClick={() => actions.advance(5 * 86_400_000)} className="ml-1 font-medium text-[#1E3A5F] underline">{p("+5 days", "+5日")}</button></div>}
          </div>

          <div className="space-y-5">
            {/* Actions */}
            <div className="panel p-4">
              <SectionTitle kicker={p("Your actions", "対応")} title={isSupplier ? p("Supplier", "サプライヤー") : isBuyer ? p("Buyer", "買い手") : p("Ops (override, audited)", "運営（記録対象）")} />
              <div className="flex flex-wrap gap-2">
                {(isSupplier || isOps) && o.state === "ISSUED" && <button onClick={() => actions.poEvent(o.id, "supplier_accept", me)} className="btn-red text-[12.5px]">{p("Confirm order", "受注確認")}</button>}
                {(isBuyer || isOps) && o.state === "ISSUED" && <button onClick={() => actions.poEvent(o.id, "cancel", me, "Cancelled before supplier acceptance")} className="btn-ghost text-[12.5px]">{p("Cancel before acceptance", "受注前に取消")}</button>}
                {isBuyer && o.state === "AWAITING_ADVANCE" && <Link to={`/pay/${o.id}?purpose=advance`} className="btn-red text-[12.5px]"><CreditCard size={14} />{p(`Pay ${o.advancePct}% advance`, `前払${o.advancePct}%を支払う`)}</Link>}
                {(isSupplier || isOps) && o.state === "IN_PRODUCTION" && <button onClick={() => actions.poEvent(o.id, "ready", me)} className="btn-red text-[12.5px]">{p("Mark ready to ship", "出荷準備完了")}</button>}
                {(isSupplier || isOps) && o.state === "READY_TO_SHIP" && <button onClick={() => actions.poEvent(o.id, "ship", me)} className="btn-red text-[12.5px]">{p("Mark shipped", "出荷済にする")}</button>}
                {(isBuyer || isOps) && o.state === "SHIPPED" && <button onClick={() => actions.poEvent(o.id, "deliver", me)} className="btn-red text-[12.5px]">{p("Confirm delivery", "受領確認")}</button>}
                {isBuyer && ["SHIPPED", "DELIVERED"].includes(o.state) && bal?.state !== "SETTLED" && <Link to={`/pay/${o.id}?purpose=balance`} className="btn-ink text-[12.5px]"><CreditCard size={14} />{p("Pay balance", "残金を支払う")}</Link>}
                {(isBuyer || isOps) && o.state === "DELIVERED" && <button onClick={() => actions.poEvent(o.id, "complete", me)} className="btn-red text-[12.5px]">{p("Complete order", "完了にする")}</button>}
                {o.state === "DISPUTED" && isOps && <button onClick={() => actions.poEvent(o.id, "resolve", me, "Resolved by the parties")} className="btn-ghost text-[12.5px]">{p("Record resolution", "解決を記録")}</button>}
              </div>
              {(isBuyer || isSupplier) && ["IN_PRODUCTION", "SHIPPED", "DELIVERED"].includes(o.state) && (
                <div className="mt-3 flex gap-2">
                  <input value={dispute} onChange={(e) => setDispute(e.target.value)} placeholder={p("Describe a quality / quantity issue…", "品質・数量の問題を記入…")} className="flex-1 rounded-lg border border-line px-3 py-1.5 text-[12.5px] outline-none focus:border-ink" />
                  <button disabled={!dispute.trim()} onClick={() => actions.poEvent(o.id, "dispute", me, dispute.trim())} className="btn-ghost text-[12.5px] text-hinomaru-deep"><Flag size={13} />{p("Dispute", "申立て")}</button>
                </div>
              )}
              <p className="mt-3 text-[11.5px] text-muted">{p("Shinrai records state and documents; it does not adjudicate disputes or hold funds.", "信頼は状況と書類を記録しますが、紛争の裁定や資金の保管は行いません。")}</p>
            </div>

            {/* Payments */}
            <div className="panel p-4">
              <SectionTitle kicker={p("Payments", "支払")} title={p("Advance and balance", "前払と残金")} right={<Prov kind="SIMULATED" />} />
              {[{ k: "advance", l: p(`Advance ${o.advancePct}%`, `前払${o.advancePct}%`), pay: adv, amt: advance }, { k: "balance", l: p("Balance (against B/L copy)", "残金（B/L写し受領後）"), pay: bal, amt: o.subtotal.minor - advance }].map((r) => (
                <div key={r.k} className="flex items-center justify-between border-b border-line py-2.5 last:border-0">
                  <div><div className="text-[13px] font-medium text-ink">{r.l}</div><div className="font-mono text-[12px] text-ink-3">{money({ minor: r.amt, ccy: "INR" })}{r.pay?.quote && ` → ${money(r.pay.quote.payable)}`}</div></div>
                  <div className="flex items-center gap-2">
                    <Chip tone={r.pay ? PAY_STATE[r.pay.state].tone : "muted"}>{r.pay ? p(PAY_STATE[r.pay.state].l[0], PAY_STATE[r.pay.state].l[1]) : p("Not started", "未着手")}</Chip>
                    {r.pay?.reconciliation && <Chip tone={r.pay.reconciliation.status === "matched" ? "green" : "red"}>{p("recon", "照合")}: {r.pay.reconciliation.status}</Chip>}
                    {isBuyer && <Link to={`/pay/${o.id}?purpose=${r.k}`} className="text-[12px] font-medium text-[#1E3A5F] hover:underline">{p("Open", "開く")}</Link>}
                  </div>
                </div>
              ))}
            </div>

            {/* Documents */}
            <div className="panel p-4">
              <SectionTitle kicker={p("Trade documents", "貿易書類")} title={p("Hashed on upload", "アップロード時にハッシュ化")} />
              <ul className="space-y-1.5">
                {(Object.keys(DOC) as DocKind[]).map((k) => {
                  const d = o.docs.find((x) => x.kind === k);
                  return (
                    <li key={k} className="flex items-center gap-2 text-[12.5px]">
                      {d ? <Check size={14} className="text-verified" /> : <span className="h-3.5 w-3.5 rounded-full border border-line-strong" />}
                      <span className="w-[200px] text-ink">{k === "certificate_of_origin" ? <Gloss k="cepa">{p(DOC[k][0], DOC[k][1])}</Gloss> : p(DOC[k][0], DOC[k][1])}</span>
                      {d ? <span className="truncate font-mono text-[11px] text-ink-3" title={d.sha}>{d.name} · {d.sha.slice(0, 10)}…</span> : <span className="text-[11px] text-muted">{p("not uploaded", "未登録")}</span>}
                    </li>
                  );
                })}
              </ul>
              {(isBuyer || isSupplier || isOps) && o.state !== "CANCELLED" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select value={uploadKind} onChange={(e) => setUploadKind(e.target.value as DocKind)} className="rounded-lg border border-line px-2 py-1.5 text-[12px]">
                    {(Object.keys(DOC) as DocKind[]).map((k) => <option key={k} value={k}>{ja ? DOC[k][1] : DOC[k][0]}</option>)}
                  </select>
                  <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
                  <button onClick={() => fileRef.current?.click()} className="btn-ghost text-[12px]"><FileUp size={13} />{p("Upload file", "ファイルを登録")}</button>
                  <button onClick={() => illustrativeDoc(o.id, uploadKind, me)} className="btn-ghost text-[12px]"><Sparkles size={13} />{p("Attach illustrative", "例示書類を添付")}</button>
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted">{p("PDF/PNG/JPEG only, ≤10 MB, type checked from file content. Files stay in your browser; only the name and SHA-256 are recorded.", "PDF/PNG/JPEGのみ・10MB以下・内容で形式判定。ファイルはブラウザ内に留まり、名前とSHA-256のみ記録します。")}</p>
            </div>
          </div>
        </div>

        {/* Printable PO */}
        <div className="panel avoid-break p-6">
          <div className="flex items-start justify-between border-b-2 border-ink pb-3">
            <div><div className="num text-[28px] leading-none">PURCHASE ORDER · 発注書</div><div className="mt-1 font-mono text-[12px] text-ink-3">{o.number} · {fmtDate(o.createdAt, lang)}</div></div>
            <div className="rotate-[-6deg] rounded border-2 border-hinomaru px-3 py-1 text-[12px] font-bold text-hinomaru">ILLUSTRATIVE · 説明用</div>
          </div>
          <div className="mt-4 grid gap-4 text-[12.5px] md:grid-cols-3">
            <div><div className="label">{p("Buyer / importer of record", "買い手・輸入者")}</div><div className="font-medium">{PERSONAS[o.buyer].name}</div><div>{PERSONAS[o.buyer].name_ja}</div><div className="text-ink-3">{PERSONAS[o.buyer].city}</div></div>
            <div><div className="label">{p("Supplier / exporter", "サプライヤー・輸出者")}</div><div className="font-medium">{sup.name}</div><div className="text-ink-3">{sup.city}, {sup.state} · CIN {sup.cin}</div><div className="mt-1"><SupplierBadge supplier={sup} /></div></div>
            <div><div className="label">{p("Terms", "条件")}</div><div>{pool.incoterm} · {p("deliver to", "仕向")} {PORTS[pool.destPort].name}</div><div>{o.advancePct}% {p("advance, balance against B/L copy", "前払・残金B/L写し受領後")}</div><div className="font-mono text-[11px] text-ink-3">terms {o.termsHash} (v{o.quoteVersion})</div></div>
          </div>
          <table className="mt-4 w-full text-[12.5px]">
            <thead><tr className="border-b border-line text-left text-muted"><th className="py-2">{p("Item", "品目")}</th><th>HS ({p("proposed", "提案")})</th><th className="text-right">{p("Qty", "数量")}</th><th className="text-right">{p("Unit", "単価")}</th><th className="text-right">{p("Amount", "金額")}</th></tr></thead>
            <tbody><tr className="border-b border-line"><td className="py-2">{prod.title_en}<div className="text-ink-3">{prod.title_ja}</div></td><td>{prod.hs_proposed}</td><td className="text-right font-mono">{fmtQty(o.qty, lang)}</td><td className="text-right font-mono">{money(o.unit)}</td><td className="text-right font-mono font-semibold">{money(o.subtotal)}</td></tr></tbody>
          </table>
          <p className="mt-3 text-[11px] text-muted">{p("Shinrai facilitated this order and is not a party to it. Prototype document — not a real order.", "信頼は本発注を仲介したのみで当事者ではありません。プロトタイプの書類であり、実際の注文ではありません。")}</p>
        </div>
      </div>
    </TradeShell>
  );
}
