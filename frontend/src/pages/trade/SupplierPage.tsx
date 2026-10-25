import { ArrowLeft, ExternalLink, Factory, MapPin } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CHECK } from "../../trade/labels";
import { badgeFor } from "../../trade/logic";
import { fmtQty } from "../../trade/money";
import { PERSONAS, PORTS } from "../../trade/seed";
import { nowOf, useTrade } from "../../trade/store";
import RelationshipGraph, { EDGE_STYLE, type RLink, type RNode } from "../../trade/three/RelationshipGraph";
import TierStairs from "../../trade/three/TierStairs";
import { CheckIcon, Chip, Gloss, Prov, SectionTitle, SupplierBadge, TradeShell, useL } from "../../trade/ui";

export default function SupplierPage() {
  const { id } = useParams();
  const s = useTrade();
  const { p, ja, lang, money } = useL();
  const sup = s.suppliers.find((x) => x.id === id);
  const products = s.products.filter((x) => x.supplierId === id);
  const [sel, setSel] = useState(products[0]?.id);
  const prod = products.find((x) => x.id === sel) ?? products[0];

  const graph = useMemo(() => {
    if (!sup) return { nodes: [] as RNode[], links: [] as RLink[] };
    const nodes: RNode[] = [{ id: sup.id, label: sup.name.replace(/ (Pvt Ltd|LLP)$/, ""), kind: "supplier" }];
    const links: RLink[] = [];
    const add = (n: RNode, l: Omit<RLink, "source"> & { source?: string }) => {
      if (!nodes.some((x) => x.id === n.id)) nodes.push(n);
      links.push({ source: l.source ?? sup.id, target: l.target, type: l.type, status: l.status });
    };
    const inv = sup.investigation;
    const st = (cid: string) => inv?.checks.find((c) => c.id === cid)?.status;
    if (inv && st("network") !== "not_checked") {
      ["Director A", "Director B", "Director C"].forEach((d, i) => add({ id: `${sup.id}:d${i}`, label: d, kind: "person" }, { target: `${sup.id}:d${i}`, type: "DIRECTOR_OF", status: "verified" }));
      if (st("network") === "fail") add({ id: `${sup.id}:struck`, label: p("2 struck-off cos.", "抹消会社2社"), kind: "unknown" }, { source: `${sup.id}:d1`, target: `${sup.id}:struck`, type: "DIRECTOR_OF (past)", status: "verified" });
    } else add({ id: `${sup.id}:dn`, label: p("Directors: not checked", "取締役：未確認"), kind: "unknown" }, { target: `${sup.id}:dn`, type: "DIRECTOR_OF", status: "unavailable" });
    add({ id: `${sup.id}:addr`, label: `${sup.city}`, kind: "address" }, { target: `${sup.id}:addr`, type: "REGISTERED_AT", status: inv ? "verified" : "reported" });
    for (const pr of products) {
      add({ id: pr.id, label: pr.title_en.split(",")[0], kind: "product" }, { target: pr.id, type: "SUPPLIES", status: "reported" });
      for (const c of pr.certs) add({ id: `cert:${c.standard}:${sup.id}`, label: c.standard.split(" ")[0] + " " + (c.standard.match(/\d{4,5}/)?.[0] ?? ""), kind: "cert" }, { source: pr.id, target: `cert:${c.standard}:${sup.id}`, type: "CERTIFIED", status: c.status === "register_verified" ? "verified" : c.status === "claimed" ? "reported" : "stale" });
      add({ id: `port:${pr.originPort}`, label: PORTS[pr.originPort].name, kind: "port" }, { target: `port:${pr.originPort}`, type: "SHIPS_FROM", status: "reported" });
    }
    // Platform-observed edges are visible only to the parties (the viewing buyer and this supplier).
    const me = s.persona;
    for (const pl of s.pools.filter((x) => products.some((pr) => pr.id === x.productId))) {
      const mine = pl.members.find((m) => m.persona === me && !["WITHDRAWN", "LAPSED"].includes(m.state));
      if (mine) add({ id: "you", label: p(`You · ${PERSONAS[me].name.split(" ")[0]}`, `自社・${PERSONAS[me].name_ja.slice(0, 4)}`), kind: "you" }, { source: "you", target: pl.productId, type: "POOL_MEMBER_OF", status: "platform" });
    }
    for (const o of s.pos.filter((x) => x.supplierId === sup.id && x.buyer === me)) add({ id: "you", label: p("You", "自社"), kind: "you" }, { source: "you", target: sup.id, type: `ORDERED_FROM ${o.number}`, status: "platform" });
    return { nodes, links };
  }, [sup, products, s.pools, s.pos, s.persona, ja]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sup) return <TradeShell><div className="p-10 text-center text-muted">{p("Supplier not found", "見つかりません")}</div></TradeShell>;
  const b = badgeFor(sup, nowOf(s));
  const readiness: [keyof typeof sup.readiness, string, string][] = [
    ["iec", "Importer-Exporter Code (DGFT)", "輸出入者コード（DGFT）"], ["lut", "GST LUT for zero-rated export (RFD-11)", "輸出免税のGST LUT（RFD-11）"],
    ["adBank", "Authorised dealer bank designated", "外為取扱銀行（AD銀行）"], ["icegate", "ICEGATE (shipping bills)", "ICEGATE（船積書類）"], ["coo", "Can obtain CEPA certificate of origin (EIC)", "CEPA原産地証明書の取得（EIC）"],
  ];

  return (
    <TradeShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <Link to="/source" className="mb-3 inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink"><ArrowLeft size={13} />{p("All suppliers", "サプライヤー一覧")}</Link>
        <div className="grid gap-5 xl:grid-cols-[1fr_440px]">
          <div className="space-y-5">
            <div className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-white"><Factory size={24} /></div>
                  <div>
                    <h1 className="text-[24px] font-semibold tracking-tight text-ink">{p(sup.name, sup.name_ja)}</h1>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
                      <span className="flex items-center gap-1"><MapPin size={12} />{sup.city}, {sup.state}</span>
                      <span className="font-mono">CIN {sup.cin}</span><span>{p("Languages", "言語")}: {sup.languages.join(", ")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {sup.investigation && <div className="text-right"><span className="label">{p("Trust score", "信頼スコア")}</span><div className={`num text-[40px] leading-none ${sup.investigation.band === "high" ? "text-hinomaru" : sup.investigation.band === "low" ? "text-verified" : "text-ink"}`}>{sup.investigation.score}</div></div>}
                  <Prov kind="ILLUSTRATIVE" />
                </div>
              </div>
              <SupplierBadge supplier={sup} detailed />
              {sup.investigation?.demoScenario && (
                <Link to="/demo" className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#1E3A5F] hover:underline">
                  <ExternalLink size={13} />{p(`Replay the full investigation in Verify ("${sup.investigation.demoScenario}")`, `Verifyで調査全体を再生（「${sup.investigation.demoScenario}」）`)}
                </Link>
              )}
            </div>

            <div className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
                <SectionTitle kicker={p("Catalogue", "カタログ")} title={p("Products and quantity pricing", "製品と数量単価")} />
                <div className="flex flex-wrap gap-1.5">
                  {products.map((pr) => <button key={pr.id} onClick={() => setSel(pr.id)} className={`rounded-lg px-3 py-1.5 text-[12.5px] ${pr.id === prod?.id ? "bg-ink text-white" : "bg-stage text-ink-2"}`}>{p(pr.title_en.split(",")[0], pr.title_ja.split("（")[0])}</button>)}
                </div>
              </div>
              {prod && (
                <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr]">
                  <div>
                    <div className="text-[15px] font-semibold text-ink">{p(prod.title_en, prod.title_ja)}</div>
                    <dl className="mt-3 grid grid-cols-[130px_1fr] gap-y-1.5 text-[12.5px]">
                      {Object.entries(prod.spec).map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd className="text-ink">{v}</dd></Fragment>)}
                      <dt className="text-muted"><Gloss k="hs" /></dt><dd>{prod.hs_proposed} <Chip tone="amber">{p("proposal · broker to confirm", "提案・要通関業者確認")}</Chip></dd>
                      <dt className="text-muted"><Gloss k="moq" /></dt><dd className="font-mono">{fmtQty(prod.moq, lang)} {prod.unit}</dd>
                      <dt className="text-muted"><Gloss k="incoterm" /></dt><dd>{prod.incoterm}</dd>
                      <dt className="text-muted">{p("Certifications", "認証")}</dt>
                      <dd className="flex flex-wrap gap-1">{prod.certs.map((c) => <Chip key={c.standard} tone={c.status === "register_verified" ? "green" : c.status === "claimed" ? "amber" : "red"}>{c.standard} · {c.status.replace("_", " ")}</Chip>)}</dd>
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {b.eligible && prod.poolable ? <Link to={`/rfq/new?product=${prod.id}`} className="btn-red text-[12.5px]">{p("Request quote / pool demand", "見積依頼・共同発注")}</Link>
                        : <span className="rounded-lg bg-stage px-3 py-2 text-[12px] text-ink-3">{p(prod.poolable_reason_en ?? "Not eligible for pools", prod.poolable_reason_ja ?? "共同発注の対象外")}</span>}
                    </div>
                  </div>
                  <div className="rounded-xl bg-wash">
                    <TierStairs tiers={prod.tiers} qty={prod.moq} maxQty={prod.tiers[prod.tiers.length - 1].min_qty * 1.3} height={250}
                      fmtPrice={(minor) => money({ minor, ccy: prod.tiers[0].unit.ccy })} fmtQty={(n) => fmtQty(n, lang)} />
                    <div className="px-3 pb-3 text-[11px] text-muted">{p("Steps get cheaper as the total quantity grows. Marker: the MOQ.", "合計数量が増えるほど単価が下がります。マーカー：MOQ。")}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="panel p-4">
              <SectionTitle kicker={p("Export readiness", "輸出準備")} title={p("Can this supplier ship to Japan?", "日本へ出荷できるか")} />
              <ul className="space-y-2">
                {readiness.map(([k, en, jaT]) => (
                  <li key={k} className="flex items-center gap-2 text-[12.5px]"><CheckIcon s={sup.readiness[k]} /><span className="flex-1 text-ink">{p(en, jaT)}</span>
                    <span className="text-[11px] text-muted">{sup.readiness[k] === "pass" ? p("seen", "確認済") : sup.readiness[k] === "fail" ? p("missing", "なし") : p("unknown", "不明")}</span></li>
                ))}
              </ul>
            </div>
            <div className="panel p-4">
              <SectionTitle kicker={p("Relationship graph", "関係グラフ")} title={p("What is known, and how", "何が、どの根拠で分かっているか")} />
              <RelationshipGraph nodes={graph.nodes} links={graph.links} height={380} />
              <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
                {Object.entries(EDGE_STYLE).map(([k, v]) => <span key={k} className="flex items-center gap-1.5 text-ink-3"><i className="h-0.5 w-4 rounded" style={{ background: v.color }} />{p(v.en, v.ja)}</span>)}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{p("A directorship is never shown as a trading relationship. Platform edges (pools, orders) are visible only to the parties. Unknown stays unknown.", "取締役関係を取引関係として表示しません。共同発注・発注の関係は当事者にのみ表示。不明は不明のまま。")}</p>
            </div>
            <div className="panel p-4">
              <div className="label mb-2">{p("Checks behind the score", "スコアの根拠")}</div>
              {(sup.investigation?.checks ?? []).map((c) => <div key={c.id} className="flex items-center gap-2 py-1 text-[12px]"><CheckIcon s={c.status} /><span className="w-[150px] text-ink">{p(CHECK[c.id][0], CHECK[c.id][1])}</span><span className="text-ink-3">{ja ? c.note_ja : c.note_en}</span></div>)}
              {!sup.investigation && <div className="text-[12px] text-ink-3">{p("No checks run yet.", "未実施")}</div>}
            </div>
          </div>
        </div>
      </div>
    </TradeShell>
  );
}
