import { AlertTriangle, ArrowRight, CheckCircle2, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { badgeFor, compatibility } from "../../trade/logic";
import { major } from "../../trade/money";
import { DAY, PORTS } from "../../trade/seed";
import { actions, nowOf, toast, useTrade } from "../../trade/store";
import type { PortId } from "../../trade/types";
import { Gloss, Prov, SectionTitle, SupplierBadge, TradeShell, useL } from "../../trade/ui";

const iso = (d: number) => new Date(d).toISOString().slice(0, 10);

export default function NewRfq() {
  const [params] = useSearchParams();
  const s = useTrade();
  const nav = useNavigate();
  const { p, ja } = useL();
  const now = nowOf(s);
  const [productId, setProductId] = useState(params.get("product") ?? "p_bolt_m8");
  const prod = s.products.find((x) => x.id === productId)!;
  const sup = s.suppliers.find((x) => x.id === prod.supplierId)!;
  const initial = (pr: typeof prod) => ({
    qty: Math.max(pr.moq, pr.unit === "pcs" ? 12_000 : pr.moq), ceiling: (pr.tiers[Math.min(1, pr.tiers.length - 1)].unit.minor / 100 * 1.03).toFixed(2),
    destPort: (pr.originPort === "INMAA" ? "JPUKB" : "JPYOK") as PortId, windowStart: iso(now + 50 * DAY), windowEnd: iso(now + 85 * DAY), certs: [] as string[], closesInDays: 10,
    minQty: pr.tiers[Math.min(2, pr.tiers.length - 1)].min_qty,
  });
  const [f, setF] = useState(() => initial(prod));
  const set = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const errors: string[] = [];
  if (!(f.qty > 0)) errors.push(p("Quantity must be above zero", "数量は1以上"));
  if (!/^\d+(\.\d{1,2})?$/.test(f.ceiling)) errors.push(p("Maximum unit price: e.g. 12.50", "上限単価の形式：例 12.50"));
  if (f.windowEnd <= f.windowStart) errors.push(p("Delivery window end must be after its start", "納期の終了日は開始日より後"));
  if (f.minQty < prod.moq) errors.push(p(`Pool minimum must be at least the MOQ (${prod.moq.toLocaleString()})`, `目標数量はMOQ（${prod.moq.toLocaleString()}）以上`));

  const pools = s.pools.filter((x) => x.productId === prod.id && x.state === "OPEN");
  const checks = useMemo(() => pools.map((pl) => ({ pool: pl, bad: compatibility(pl, prod, { productId: prod.id, incoterm: prod.incoterm, destPort: f.destPort, windowStart: f.windowStart, windowEnd: f.windowEnd, certsRequired: f.certs }) })), [pools, prod, f]);
  const compatible = checks.find((c) => c.bad.length === 0);
  const eligible = badgeFor(sup, now).eligible && prod.poolable;

  const open = () => {
    if (errors.length) return;
    const id = actions.openPool({ productId: prod.id, persona: s.persona, qty: f.qty, ceiling: major(f.ceiling, "INR"), destPort: f.destPort, windowStart: f.windowStart, windowEnd: f.windowEnd, closesInDays: f.closesInDays, minQty: f.minQty });
    if (id) nav(`/pool/${id}`);
  };
  const join = () => {
    if (!compatible) return;
    if (actions.join(compatible.pool.id, s.persona, f.qty, major(f.ceiling, "INR"), "COMMITTED")) nav(`/pool/${compatible.pool.id}`);
  };

  const input = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-[13.5px] outline-none focus:border-ink";
  return (
    <TradeShell>
      <div className="mx-auto grid max-w-[1200px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel p-5">
          <SectionTitle kicker={p("Request for quotation", "見積依頼")} title={p("Define your requirement", "要件を入力")} right={<Prov kind="ILLUSTRATIVE" />} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 text-[12px]"><span className="label">{p("Product", "製品")}</span>
              <select value={productId} onChange={(e) => { setProductId(e.target.value); setF(initial(s.products.find((x) => x.id === e.target.value)!)); }} className={input}>
                {s.products.map((x) => <option key={x.id} value={x.id}>{ja ? x.title_ja : x.title_en}</option>)}
              </select>
            </label>
            <div className="sm:col-span-2 rounded-lg bg-wash p-3 text-[12px] text-ink-2">
              {Object.entries(prod.spec).map(([k, v]) => <span key={k} className="mr-3 inline-block"><span className="text-muted">{k}:</span> {v}</span>)}
              <div className="mt-1 text-muted">{p("Specification is frozen when a pool opens, so every member buys the identical item.", "共同発注の公開時に仕様は固定され、全員が同一品を購入します。")}</div>
            </div>
            <label className="text-[12px]"><span className="label">{p("Quantity", "数量")} ({prod.unit}) · <Gloss k="moq">MOQ {prod.moq.toLocaleString()}</Gloss></span>
              <input type="number" value={f.qty} onChange={(e) => set("qty", Math.floor(Number(e.target.value)))} className={input} /></label>
            <label className="text-[12px]"><span className="label"><Gloss k="ceiling" /> (₹ / {prod.unit})</span>
              <input value={f.ceiling} onChange={(e) => set("ceiling", e.target.value)} className={input} /></label>
            <label className="text-[12px]"><span className="label">{p("Destination port", "仕向港")}</span>
              <select value={f.destPort} onChange={(e) => set("destPort", e.target.value)} className={input}>
                {(["JPYOK", "JPUKB", "JPNGO"] as PortId[]).map((x) => <option key={x} value={x}>{ja ? PORTS[x].name_ja : PORTS[x].name}</option>)}
              </select></label>
            <label className="text-[12px]"><span className="label"><Gloss k="incoterm" /></span><input disabled value={prod.incoterm} className={`${input} bg-stage`} /></label>
            <label className="text-[12px]"><span className="label">{p("Delivery from", "納期（開始）")}</span><input type="date" value={f.windowStart} onChange={(e) => set("windowStart", e.target.value)} className={input} /></label>
            <label className="text-[12px]"><span className="label">{p("Delivery by", "納期（終了）")}</span><input type="date" value={f.windowEnd} onChange={(e) => set("windowEnd", e.target.value)} className={input} /></label>
            <fieldset className="sm:col-span-2 text-[12px]"><legend className="label">{p("Required certifications", "必要な認証")}</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {["ISO 9001", "ISO 14001", "IATF 16949"].map((c) => (
                  <label key={c} className={`cursor-pointer rounded-lg border px-3 py-1.5 ${f.certs.includes(c) ? "border-ink bg-ink text-white" : "border-line"}`}>
                    <input type="checkbox" className="sr-only" checked={f.certs.includes(c)} onChange={() => set("certs", f.certs.includes(c) ? f.certs.filter((x) => x !== c) : [...f.certs, c])} />{c}
                  </label>
                ))}
              </div></fieldset>
          </div>
          {errors.length > 0 && <ul className="mt-4 space-y-1 rounded-lg bg-hinomaru-soft p-3 text-[12px] text-hinomaru-deep">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>}
        </div>

        <div className="space-y-4">
          <div className="panel p-4">
            <div className="label mb-1.5">{p("Supplier", "サプライヤー")}</div>
            <Link to={`/supplier/${sup.id}`} className="font-semibold text-ink hover:underline">{ja ? sup.name_ja : sup.name}</Link>
            <div className="mt-2"><SupplierBadge supplier={sup} /></div>
          </div>
          {!eligible ? (
            <div className="panel border-amber/40 bg-amber-soft p-4 text-[13px] text-[#8a4b05]">
              <AlertTriangle size={16} className="mb-1" />{p(prod.poolable_reason_en ?? "This supplier is not eligible for pools.", prod.poolable_reason_ja ?? "このサプライヤーは対象外です。")}
              {prod.poolable && <div className="mt-2 text-[12px]">{p("Run a full verification first.", "まず検証を実施してください。")}</div>}
              <button disabled={errors.length > 0 || !badgeFor(sup, now).eligible} onClick={() => toast("Private RFQ sent to the supplier (illustrative)", "非公開の見積依頼を送信しました（例示）")} className="btn-ink mt-3 text-[12.5px]"><Send size={13} />{p("Send private RFQ instead", "非公開で見積依頼")}</button>
            </div>
          ) : (
            <div className="panel p-4">
              <SectionTitle kicker={p("Compatibility", "適合確認")} title={compatible ? p("A compatible pool is open", "適合する共同発注があります") : p("Open a new pool", "新しい共同発注を作成")} />
              {checks.map(({ pool, bad }) => (
                <div key={pool.id} className={`mb-2 rounded-lg border p-3 text-[12px] ${bad.length ? "border-line" : "border-verified/40 bg-verified-soft"}`}>
                  <div className="flex items-center gap-1.5 font-medium text-ink">{bad.length ? <AlertTriangle size={13} className="text-amber" /> : <CheckCircle2 size={13} className="text-verified" />}{p("Pool", "共同発注")} {pool.id} · {p("closes", "締切")} {new Date(pool.closesAt).toISOString().slice(0, 10)}</div>
                  {bad.length > 0 && <div className="mt-1 text-ink-3">{p("Not compatible:", "不適合：")} {bad.join(", ")}</div>}
                </div>
              ))}
              {compatible ? (
                <button disabled={errors.length > 0} onClick={join} className="btn-red mt-2 w-full text-[13px]">{p(`Join and commit ${f.qty.toLocaleString()} pcs`, `${f.qty.toLocaleString()}個で参加・確約`)} <ArrowRight size={14} /></button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <label><span className="label">{p("Pool minimum", "目標数量")}</span><input type="number" value={f.minQty} onChange={(e) => set("minQty", Number(e.target.value))} className={input} /></label>
                    <label><span className="label">{p("Open for (days)", "受付日数")}</span><input type="number" min={7} max={30} value={f.closesInDays} onChange={(e) => set("closesInDays", Math.min(30, Math.max(7, Number(e.target.value))))} className={input} /></label>
                  </div>
                  <button disabled={errors.length > 0} onClick={open} className="btn-red mt-3 w-full text-[13px]">{p("Publish pool (you organise as facilitator)", "共同発注を公開（主催は仲介のみ）")} <ArrowRight size={14} /></button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </TradeShell>
  );
}
