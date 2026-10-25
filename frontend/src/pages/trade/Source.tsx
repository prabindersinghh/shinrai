import { ArrowRight, Factory, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { badgeFor, committedQty } from "../../trade/logic";
import { nowOf, useTrade } from "../../trade/store";
import { Chip, Gloss, Prov, SupplierBadge, TradeShell, useL } from "../../trade/ui";

const CATS = [
  { k: "all", en: "All categories", ja: "すべて" }, { k: "fasteners", en: "Fasteners", ja: "締結部品" },
  { k: "machined", en: "Machined parts", ja: "機械加工部品" }, { k: "castings", en: "Castings", ja: "鋳物" },
];

export default function Source() {
  const s = useTrade();
  const { p, money } = useL();
  const [cat, setCat] = useState("all");
  const [minLevel, setMinLevel] = useState(0);
  const [q, setQ] = useState("");
  const now = nowOf(s);

  const rows = useMemo(() => s.suppliers.map((sup) => {
    const b = badgeFor(sup, now);
    const products = s.products.filter((x) => x.supplierId === sup.id && (cat === "all" || x.category === cat));
    return { sup, b, products };
  }).filter((r) => r.products.length && r.b.level >= minLevel && (!q || `${r.sup.name} ${r.sup.city} ${r.products.map((x) => x.title_en + x.title_ja).join(" ")}`.toLowerCase().includes(q.toLowerCase()))),
  [s, cat, minLevel, q, now]);

  return (
    <TradeShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label uppercase tracking-[0.14em]">{p("Supplier discovery", "サプライヤー検索")}</div>
            <h1 className="text-[26px] font-semibold tracking-tight text-ink">{p("Indian manufacturers, with the evidence behind them", "根拠付きで探す、インドの製造業者")}</h1>
          </div>
          <div className="relative w-full max-w-[380px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={p("Search product, material, city…", "製品・材質・都市で検索…")}
              className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm outline-none focus:border-ink" />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
          <aside className="space-y-5">
            <div>
              <div className="label mb-2">{p("Category", "カテゴリー")}</div>
              <div className="flex flex-wrap gap-1.5 lg:flex-col">
                {CATS.map((c) => (
                  <button key={c.k} onClick={() => setCat(c.k)} className={`rounded-lg px-3 py-1.5 text-left text-[13px] transition ${cat === c.k ? "bg-ink text-white" : "text-ink-2 hover:bg-stage"}`}>{p(c.en, c.ja)}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="label mb-2">{p("Minimum verification", "最低検証レベル")}</div>
              <div className="flex flex-wrap gap-1.5 lg:flex-col">
                {[0, 1, 2].map((l) => (
                  <button key={l} onClick={() => setMinLevel(l)} className={`rounded-lg px-3 py-1.5 text-left text-[13px] transition ${minLevel === l ? "bg-ink text-white" : "text-ink-2 hover:bg-stage"}`}>
                    {l === 0 ? p("Any (incl. not verified)", "すべて（未検証含む）") : l === 1 ? p("L1 registry-checked +", "L1 登記確認以上") : p("L2 verified +", "L2 検証済以上")}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-wash p-3 text-[11.5px] leading-relaxed text-ink-3">
              {p("Levels come from deterministic rules over stored evidence, never from a model's opinion. A connection or listing is not an endorsement.",
                "レベルは保存された根拠に対する決定的ルールで算出され、AIの判断ではありません。掲載や関係は推奨を意味しません。")}
            </div>
          </aside>

          <div className="space-y-3">
            {rows.length === 0 && <div className="panel p-10 text-center text-sm text-muted">{p("No suppliers match these filters.", "条件に合うサプライヤーがありません。")}</div>}
            {rows.map(({ sup, b, products }) => (
              <div key={sup.id} className={`panel overflow-hidden ${!b.eligible ? "opacity-90" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stage"><Factory size={20} className="text-ink-2" /></div>
                    <div className="min-w-0">
                      <Link to={`/supplier/${sup.id}`} className="text-[16px] font-semibold text-ink hover:underline">{p(sup.name, sup.name_ja)}</Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
                        <span className="flex items-center gap-1"><MapPin size={12} />{sup.city}, {sup.state}</span>
                        <span>{p(`since ${sup.since}`, `${sup.since}年〜`)}</span>
                        <span>{p("employees", "従業員")} {sup.employees}</span>
                        <span>{p("export:", "輸出経験：")} {sup.exportExperience}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">{sup.capabilities.map((c) => <Chip key={c}>{c}</Chip>)}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <SupplierBadge supplier={sup} />
                    <Prov kind="ILLUSTRATIVE" />
                  </div>
                </div>
                <div className="divide-y divide-line">
                  {products.map((prod) => {
                    const pools = s.pools.filter((x) => x.productId === prod.id && x.state === "OPEN");
                    const best = prod.tiers[prod.tiers.length - 1];
                    return (
                      <div key={prod.id} className="grid items-center gap-3 p-4 md:grid-cols-[1.6fr_1fr_1fr_auto]">
                        <div className="min-w-0">
                          <div className="font-medium text-ink">{p(prod.title_en, prod.title_ja)}</div>
                          <div className="mt-0.5 text-[11.5px] text-ink-3"><Gloss k="hs">HS {prod.hs_proposed}</Gloss> {p("(proposed)", "（提案）")} · <Gloss k="incoterm">{prod.incoterm}</Gloss> · {prod.lead_days} {p("days lead time", "日リードタイム")}</div>
                        </div>
                        <div className="text-[12px]">
                          <div className="label"><Gloss k="moq" /></div>
                          <div className="font-mono text-ink">{prod.moq.toLocaleString()} {prod.unit}</div>
                        </div>
                        <div className="text-[12px]">
                          <div className="label"><Gloss k="tier">{p("Price tiers", "数量単価")}</Gloss></div>
                          <div className="flex items-baseline gap-1.5 font-mono">
                            {prod.tiers.length > 1 && <><span className="text-ink-3 line-through decoration-ink-3/40">{money(prod.tiers[0].unit)}</span><ArrowRight size={11} className="text-muted" /></>}
                            <span className="font-semibold text-verified">{money(best.unit)}</span>
                            <span className="text-[10.5px] text-muted">@{best.min_qty.toLocaleString()}+</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {!b.eligible || !prod.poolable ? (
                            <span className="max-w-[220px] text-right text-[11.5px] text-ink-3">{p(prod.poolable_reason_en ?? "Not eligible", prod.poolable_reason_ja ?? "対象外")}</span>
                          ) : pools.length ? (
                            <Link to={`/pool/${pools[0].id}`} className="btn-ink text-[12.5px]">{p("Join open pool", "共同発注に参加")} · {Math.round((committedQty(pools[0]) / pools[0].minQty) * 100)}%</Link>
                          ) : (
                            <Link to={`/rfq/new?product=${prod.id}`} className="btn-ghost text-[12.5px]">{p("Request quote / open pool", "見積依頼・共同発注")}</Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TradeShell>
  );
}
