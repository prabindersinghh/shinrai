import { motion } from "framer-motion";
import { ArrowRight, Ban, Boxes, CreditCard, FileCheck2, Handshake, Play, RotateCcw, Search, ShieldCheck, Ship, XOctagon } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ffToShipped, myPo, scenarioCancelBeforeAcceptance, scenarioFailedPayment } from "../../trade/demo";
import { badgeFor, committedQty } from "../../trade/logic";
import { DAY, PORTS } from "../../trade/seed";
import { actions, nowOf, useTrade } from "../../trade/store";
import TradeGlobe from "../../trade/three/TradeGlobe";
import { Chip, Prov, SectionTitle, TradeShell, useL } from "../../trade/ui";

export default function TradeHub() {
  const s = useTrade();
  const { p, ja } = useL();
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const now = nowOf(s);
  const verified = s.suppliers.filter((x) => badgeFor(x, now).level >= 2).length;
  const open = s.pools.filter((x) => x.state === "OPEN").length;
  const settled = s.payments.filter((x) => x.state === "SETTLED").length;
  const shipped = s.pos.filter((o) => o.state === "SHIPPED");
  const progress = (o: (typeof s.pos)[number]) => (o.shipment ? Math.min(1, (now - o.shipment.etd) / (o.shipment.eta - o.shipment.etd)) : 0);

  const run = async (id: string, fn: () => unknown, to: () => string) => {
    setBusy(id);
    try {
      await fn();
      nav(to());
    } finally {
      setBusy(null);
    }
  };

  const steps = [
    { icon: ShieldCheck, en: "Verify", ja: "検証", d_en: "Evidence-backed supplier levels from registry, GST, network, site and audit checks.", d_ja: "登記・GST・ネットワーク・拠点・監査に基づく検証レベル。" },
    { icon: Boxes, en: "Pool demand", ja: "需要をまとめる", d_en: "Japanese SMEs commit quantities privately until the supplier's tier is reached.", d_ja: "各社が非公開で数量を確約し、数量単価帯に到達。" },
    { icon: FileCheck2, en: "Versioned quote", ja: "版管理の見積", d_en: "The supplier prices the combined volume. Terms are hashed and cannot change silently.", d_ja: "合計数量で見積。条件はハッシュ化され、無断変更できません。" },
    { icon: Handshake, en: "Your own PO", ja: "自社の発注書", d_en: "Each buyer gets its own order, invoice, payment and import. Shinrai is never a party.", d_ja: "発注・請求・支払・輸入は各社個別。信頼は当事者になりません。" },
    { icon: Ship, en: "Pay & track", ja: "支払・追跡", d_en: "JPY payable quote, signed provider events, documents and shipment tracking.", d_ja: "円建て支払見積、署名付きイベント、書類と輸送追跡。" },
  ];

  const scenarios = [
    { id: "pos", tone: "green" as const, en: "Positive: pool reaches its tier", ja: "成功例：単価帯に到達", d_en: "Join the stainless-bolt pool as Tanaka Seiko with 12,000 pcs. Alone you'd pay the 10k tier; together you reach 50k.", d_ja: "田中精工として12,000個で参加。単独では10k単価、共同で50k単価に。",
      cta: p("Open pool", "共同発注を開く"), go: () => (actions.setPersona("buyerA"), nav("/pool/pool_bolt")) },
    { id: "ff", tone: "blue" as const, en: "Fast-forward: quote → POs → shipped", ja: "早送り：見積→発注→出荷", d_en: "Runs the same state machines: close, quote v1, three acceptances, three separate POs, advance settled (SIMULATED), shipped.", d_ja: "同じ状態遷移で締切→見積→3社承諾→個別発注→前払（模擬）→出荷まで進めます。",
      cta: p("Fast-forward", "早送り"), go: () => run("ff", async () => (await ffToShipped("buyerA"), actions.setPersona("buyerA")), () => `/orders/${myPo("buyerA")?.id ?? ""}`) },
    { id: "unk", tone: "amber" as const, en: "Unavailable data", ja: "データ不足", d_en: "Coromandel Castings has no investigation (L0) and no freight quote: the landed cost shows INCOMPLETE, never a fake figure.", d_ja: "調査なし（L0）・運賃見積なし。工場着コストは「不完全」と表示し、数字を捏造しません。",
      cta: p("Open pool", "開く"), go: () => (actions.setPersona("buyerA"), nav("/pool/pool_housing")) },
    { id: "fail", tone: "red" as const, en: "Failed pool", ja: "不成立", d_en: "The M8 nut pool has 31,000 of 50,000 with under a day left. Advance the clock: everyone is released, nobody is charged.", d_ja: "M8ナットは31,000/50,000で残り1日未満。時計を進めると全員解除・費用なし。",
      cta: p("Advance 1 day", "1日進める"), go: () => (actions.advance(DAY), nav("/pool/pool_nut")) },
    { id: "pay", tone: "red" as const, en: "Failed payment", ja: "支払失敗", d_en: "Hokuriku Kikai's advance fails at the SIMULATED provider. The PO stays unpaid; a fresh quote is needed to retry.", d_ja: "北陸機械の前払が模擬プロバイダーで失敗。発注は未払のまま、再見積が必要。",
      cta: p("Run", "実行"), go: () => run("pay", async () => (await scenarioFailedPayment(), actions.setPersona("buyerB")), () => `/pay/${myPo("buyerB")?.id ?? ""}?purpose=advance`) },
    { id: "cancel", tone: "muted" as const, en: "Cancelled order", ja: "注文取消", d_en: "Setouchi Pump cancels its own PO before the supplier accepts. The other buyers' orders are untouched.", d_ja: "瀬戸内ポンプが受注確認前に自社の発注を取消。他社の発注には影響しません。",
      cta: p("Run", "実行"), go: () => run("cancel", () => (scenarioCancelBeforeAcceptance(), actions.setPersona("buyerC")), () => "/orders") },
  ];

  return (
    <TradeShell>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-[radial-gradient(ellipse_at_70%_40%,#EEF2F8_0%,#FFFFFF_60%)]">
        <div className="mx-auto grid max-w-[1600px] items-center gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_1.15fr]">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Chip tone="ink">{p("NEW", "新機能")}</Chip>
              <span className="label uppercase tracking-[0.16em]">{p("Trust-backed procurement · India → Japan", "信頼に基づく調達・インド→日本")}</span>
            </div>
            <h1 className="text-[40px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[52px]">
              {ja ? <>検証済みのインド企業から、<br /><span className="text-hinomaru">まとめて</span>安全に仕入れる。</> : <>Buy from verified Indian suppliers, <span className="text-hinomaru">together</span>, without the guesswork.</>}
            </h1>
            <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-ink-2">
              {p("Shinrai's evidence-backed verification now leads straight into sourcing. Pool demand with other Japanese SMEs to reach a supplier's price tier. Each company keeps its own order, payment and import, and sees a landed cost it can explain to its 稟議.",
                "信頼の検証結果から、そのまま調達へ。他の日本企業と需要をまとめて数量単価帯に到達し、発注・支払・輸入は各社個別のまま、稟議で説明できる工場着コストを確認できます。")}
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link to="/source" className="btn-red px-5 py-2.5"><Search size={15} />{p("Find suppliers", "サプライヤーを探す")}</Link>
              <button onClick={scenarios[0].go} className="btn-ink px-5 py-2.5"><Play size={15} />{p("Join the live pool", "受付中の共同発注へ")}</button>
            </div>
            <div className="mt-8 grid max-w-[560px] grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { v: verified, en: "verified suppliers", ja: "検証済サプライヤー" }, { v: open, en: "open pools", ja: "受付中の共同発注" },
                { v: s.pos.length, en: "purchase orders", ja: "発注書" }, { v: settled, en: "payments settled", ja: "着金済" },
              ].map((k) => (
                <div key={k.en} className="rounded-xl border border-line bg-white/80 p-3 backdrop-blur">
                  <div className="num text-[30px] leading-none text-ink">{k.v}</div>
                  <div className="mt-1 text-[11px] text-muted">{p(k.en, k.ja)}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted"><Prov kind="ILLUSTRATIVE" /><Prov kind="SIMULATED" /> {p("counts from this browser's demo workspace", "このブラウザのデモ環境の件数")}</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.1 }} className="relative">
            <TradeGlobe height={560}
              routes={[
                { id: "nsa", from: "INNSA", to: "JPYOK", emphasis: true, progress: shipped[0] ? progress(shipped[0]) : 0.42 },
                { id: "maa", from: "INMAA", to: "JPUKB", progress: null },
              ]}
              pins={s.suppliers.map((x) => {
                const b = badgeFor(x, now);
                return { id: x.id, lat: x.lat, lon: x.lon, label: "", tone: !b.eligible ? "red" as const : b.level >= 2 ? "green" as const : "ink" as const };
              })} />
            <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-line bg-white/90 p-3 text-[11.5px] shadow-card backdrop-blur">
              <div className="label mb-1">{p("Corridor", "航路")}</div>
              <div className="font-medium text-ink">{p(PORTS.INNSA.name, PORTS.INNSA.name_ja)} → {p(PORTS.JPYOK.name, PORTS.JPYOK.name_ja)}</div>
              <div className="text-muted">{p("Sea LCL · ~18 days (illustrative)", "海上LCL・約18日（例示）")}</div>
              <div className="mt-2 flex gap-2.5 text-[10.5px]">
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-verified" />{p("Verified", "検証済")}</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-ink" />{p("Not verified", "未検証")}</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-hinomaru" />{p("Not eligible", "対象外")}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] space-y-10 px-4 py-10 sm:px-6">
        {/* How it works */}
        <section>
          <SectionTitle kicker={p("How it works", "仕組み")} title={p("Trust first, then a purchase you can explain", "まず信頼、そして説明できる購買へ")} />
          <div className="grid gap-3 md:grid-cols-5">
            {steps.map((st, i) => (
              <motion.div key={st.en} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className="panel relative p-4">
                <div className="num absolute right-3 top-2 text-[34px] leading-none text-line">{String(i + 1).padStart(2, "0")}</div>
                <st.icon size={20} className="text-hinomaru" />
                <div className="mt-2 text-[14px] font-semibold text-ink">{p(st.en, st.ja)}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-3">{p(st.d_en, st.d_ja)}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Scenarios */}
        <section>
          <SectionTitle kicker={p("Demo scenarios", "デモシナリオ")} title={p("Happy path and the ways it can go wrong", "成功例と、うまくいかない場合")}
            right={<button onClick={() => actions.reset()} className="btn-ghost text-[12px]"><RotateCcw size={13} />{p("Reset workspace", "初期化")}</button>} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {scenarios.map((sc) => (
              <div key={sc.id} className="panel flex flex-col p-4">
                <div className="flex items-center gap-2">
                  <Chip tone={sc.tone}>{sc.tone === "green" ? "✓" : sc.tone === "red" ? "✕" : sc.tone === "amber" ? "?" : sc.tone === "blue" ? "»" : "–"}</Chip>
                  <div className="text-[14px] font-semibold text-ink">{p(sc.en, sc.ja)}</div>
                </div>
                <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-ink-3">{p(sc.d_en, sc.d_ja)}</p>
                <button disabled={busy !== null} onClick={sc.go} className="btn-ink mt-3 self-start text-[12.5px]">
                  {busy === sc.id ? p("Running…", "実行中…") : sc.cta} <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Boundaries */}
        <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="panel p-5">
            <div className="label uppercase tracking-[0.14em]">{p("What Shinrai never does", "信頼がしないこと")}</div>
            <ul className="mt-3 space-y-2.5 text-[13px] text-ink-2">
              {[
                [Ban, "Hold your money. Payments go from your bank to the supplier's bank, or through a regulated partner.", "資金を預かりません。支払は自社銀行からサプライヤーの銀行へ、または規制下のパートナー経由。"],
                [XOctagon, "Promise tax savings. Pooling changes price tiers and freight, never duty or consumption tax.", "税の削減を約束しません。共同発注で変わるのは単価と運賃で、関税・消費税は変わりません。"],
                [CreditCard, "Use UPI for business imports. UPI has no Japan→India B2B product.", "輸入代金にUPIは使いません（日本→インドのB2B向け機能はありません）。"],
                [Handshake, "Become the buyer or seller. Each company is its own importer of record.", "売買の当事者になりません。各社が自社名義で輸入します。"],
              ].map(([Icon, en, jaT]) => {
                const I = Icon as typeof Ban;
                return <li key={en as string} className="flex gap-2.5"><I size={16} className="mt-0.5 shrink-0 text-hinomaru" />{p(en as string, jaT as string)}</li>;
              })}
            </ul>
          </div>
          <div className="panel p-5">
            <div className="label uppercase tracking-[0.14em]">{p("Live pools", "受付中の共同発注")}</div>
            <div className="mt-3 space-y-2.5">
              {s.pools.map((pl) => {
                const prod = s.products.find((x) => x.id === pl.productId)!;
                const c = committedQty(pl);
                return (
                  <Link key={pl.id} to={`/pool/${pl.id}`} className="block rounded-lg border border-line p-3 transition hover:border-line-strong hover:bg-wash">
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="truncate font-medium text-ink">{p(prod.title_en, prod.title_ja)}</span>
                      <span className="shrink-0 font-mono text-[11px] text-muted">{c.toLocaleString()} / {pl.minQty.toLocaleString()}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stage">
                      <div className={`h-full rounded-full ${c >= pl.minQty ? "bg-verified" : "bg-[#1E3A5F]"}`} style={{ width: `${Math.min(100, (c / pl.minQty) * 100)}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </TradeShell>
  );
}
