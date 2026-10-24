import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Shell, { rememberSme } from "../components/Shell";
import { useI18n } from "../i18n";
import { api } from "../lib/api";

type Opt = [string, string, string];
const INDUSTRIES: Opt[] = [["auto_parts", "自動車部品", "Auto components"], ["electronics", "電子部品", "Electronics"], ["food", "食品加工", "Food processing"], ["machinery", "機械・設備", "Machinery"], ["chemicals", "化学・樹脂", "Chemicals"], ["medical", "医療機器", "Medical devices"]];
const GOALS: Opt[] = [["sell", "インドで販売", "Sell in India"], ["manufacture", "インドで製造", "Manufacture in India"], ["source", "インドから調達", "Source from India"], ["export_hub", "輸出拠点（China+1）", "Export hub (China+1)"]];
const BANDS: Opt[] = [["lt50m", "5,000万円未満", "Under ¥50M"], ["50m_300m", "5,000万〜3億円", "¥50M–300M"], ["300m_1b", "3億〜10億円", "¥300M–1B"], ["gt1b", "10億円以上", "Over ¥1B"]];
const TIMELINES: Opt[] = [["6", "6か月", "6 months"], ["12", "12か月", "12 months"], ["24", "24か月", "24 months"]];
const MODES: Opt[] = [["distributor", "販売代理店・エージェント", "Distributor / agent"], ["jv", "合弁", "Joint venture"], ["wos", "100%子会社", "Wholly owned subsidiary"], ["liaison", "駐在員事務所・支店", "Liaison or branch office"], ["contract_mfg", "製造委託", "Contract manufacturing"], ["undecided", "未定", "Undecided"]];
const SEEKING: Opt[] = [["distributor", "販売代理店", "Distributor"], ["jv", "合弁パートナー", "JV partner"], ["supplier", "仕入先", "Supplier"], ["contract_mfg", "製造委託先", "Contract manufacturer"]];
const MUSTS: Opt[] = [["japanese_community", "日本人コミュニティ・日本人学校", "Japanese community or schools"], ["port", "港湾へのアクセス", "Port access"], ["power", "安定した電力", "Reliable power"], ["skilled_labour", "熟練労働者", "Skilled labour"], ["english", "英語での業務", "English-speaking workforce"]];
const STATES = ["Haryana", "Rajasthan", "Gujarat", "Maharashtra", "Karnataka", "Tamil Nadu"];
const APPETITE: [string, string, string, string, string][] = [
  ["conservative", "保守的", "Conservative", "日系企業の集積と支援体制を重視し、信頼スコアの影響を強くします。", "Weights Japanese clusters and support more; the trust score weighs heavily on fit."],
  ["balanced", "標準", "Balanced", "リスクと機会のバランスを取ります。", "Balances risk against opportunity."],
  ["aggressive", "積極的", "Aggressive", "成長性と投資の勢いを重視します。", "Weights growth momentum more; accepts managed risk."],
];

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`rounded-lg border px-3.5 py-2.5 text-left text-[13px] transition-colors ${active ? "border-ink bg-ink text-white" : "border-line bg-paper hover:border-line-strong"}`}>
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><span className="label">{label}</span><div className="mt-2">{children}</div></div>;
}

const EMPTY = {
  name: "", name_ja: "", industry: "auto_parts", products: "", hs_chapter: "", export_markets: [] as string[], goal: "sell",
  investment_band: "50m_300m", headcount_y1: 10, timeline_months: 12, entry_mode: "undecided", seeking: "distributor",
  target_states: [] as string[], must_haves: [] as string[], risk_appetite: "balanced", deal_band: "mid", language: "en",
};

export default function Onboarding() {
  const { lang } = useI18n();
  const ja = lang === "ja";
  const nav = useNavigate();
  const [params] = useSearchParams();
  const editId = Number(params.get("edit")) || null;
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [markets, setMarkets] = useState("");
  const set = (k: keyof typeof EMPTY, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: "target_states" | "must_haves", v: string) => set(k, form[k].includes(v) ? form[k].filter((x) => x !== v) : [...form[k], v]);

  useEffect(() => {
    if (!editId) return;
    api.getSme(editId).then((s: any) => {
      setForm({ ...EMPTY, ...s, export_markets: s.export_markets ?? [], target_states: s.target_states ?? [], must_haves: s.must_haves ?? [] });
      setMarkets((s.export_markets ?? []).join(", "));
    });
  }, [editId]);

  const steps = ja ? ["会社と製品", "目的と規模", "条件とリスク"] : ["Company and products", "Goal and scale", "Must-haves and risk"];
  const finish = async () => {
    setBusy(true);
    try {
      const body = { ...form, export_markets: markets.split(",").map((m) => m.trim()).filter(Boolean), language: lang };
      const sme = editId ? await (await fetch(`/api/sme/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json() : await api.createSme(body);
      rememberSme(sme.id);
      nav(`/advisor/${sme.id}`);
    } finally {
      setBusy(false);
    }
  };
  const opts = (list: Opt[], k: keyof typeof EMPTY, cols = "sm:grid-cols-3") => (
    <div className={`grid grid-cols-2 gap-2 ${cols}`}>{list.map(([v, j, e]) => <Choice key={v} active={String(form[k]) === v} onClick={() => set(k, k === "timeline_months" ? Number(v) : v)}>{ja ? j : e}</Choice>)}</div>
  );

  return (
    <Shell>
      <section className="mx-auto max-w-[820px] px-4 py-12 sm:px-6">
        <div className="label">{editId ? (ja ? "プロフィールの編集" : "Edit profile") : ja ? "新規エンゲージメント" : "New engagement"}</div>
        <h1 className="jp mt-1 text-[32px] font-bold tracking-tight">{ja ? "貴社のインド戦略を教えてください" : "Tell us about your India plans"}</h1>
        <p className={`mt-2 text-[14px] text-ink-3 ${ja ? "jp" : ""}`}>{ja ? "回答に基づいて、立地・参入形態・手続き・契約条件を提案します。" : "Your answers drive the location fit, entry route, compliance roadmap and contract terms."}</p>
        <ol className="mt-6 flex gap-2">
          {steps.map((s, i) => (
            <li key={s} className="flex-1">
              <div className={`h-1 rounded-full transition-colors ${i <= step ? "bg-hinomaru" : "bg-line"}`} />
              <div className={`mt-2 text-[12px] font-medium ${i === step ? "text-ink" : "text-muted"}`}><span className="num mr-1 text-[14px]">{i + 1}</span>{s}</div>
            </li>
          ))}
        </ol>

        <div className="relative mt-8 min-h-[420px]">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-6">
              {step === 0 && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block"><span className="label">{ja ? "会社名（英語）" : "Company name"}</span>
                      <input className="mt-1 w-full rounded-lg border border-line px-3.5 py-2.5 text-[15px]" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Tanaka Seiko K.K." /></label>
                    <label className="block"><span className="label">{ja ? "会社名（日本語）" : "Company name (Japanese)"}</span>
                      <input className="jp mt-1 w-full rounded-lg border border-line px-3.5 py-2.5 text-[15px]" value={form.name_ja} onChange={(e) => set("name_ja", e.target.value)} placeholder="田中精工株式会社" /></label>
                  </div>
                  <Field label={ja ? "業種" : "Industry"}>{opts(INDUSTRIES, "industry")}</Field>
                  <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                    <label className="block"><span className="label">{ja ? "主な製品" : "Main products"}</span>
                      <input className="mt-1 w-full rounded-lg border border-line px-3.5 py-2.5 text-[14px]" value={form.products} onChange={(e) => set("products", e.target.value)} placeholder={ja ? "精密歯車・シャフト" : "Precision gears and shafts"} /></label>
                    <label className="block"><span className="label">{ja ? "HS章" : "HS chapter"}</span>
                      <input className="mt-1 w-full rounded-lg border border-line px-3.5 py-2.5 font-mono text-[14px]" value={form.hs_chapter} onChange={(e) => set("hs_chapter", e.target.value)} placeholder="87" /></label>
                  </div>
                  <label className="block"><span className="label">{ja ? "現在の輸出先（カンマ区切り）" : "Current export markets (comma separated)"}</span>
                    <input className="mt-1 w-full rounded-lg border border-line px-3.5 py-2.5 text-[14px]" value={markets} onChange={(e) => setMarkets(e.target.value)} placeholder="Thailand, Indonesia" /></label>
                </>
              )}
              {step === 1 && (
                <>
                  <Field label={ja ? "インドでの目的" : "Goal in India"}>{opts(GOALS, "goal", "sm:grid-cols-4")}</Field>
                  <Field label={ja ? "投資規模" : "Investment band"}>{opts(BANDS, "investment_band", "sm:grid-cols-4")}</Field>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label={ja ? "期間" : "Timeline"}>{opts(TIMELINES, "timeline_months")}</Field>
                    <label className="block"><span className="label">{ja ? "初年度の人員" : "First-year headcount"}</span>
                      <input type="number" min={0} className="mt-2 w-full rounded-lg border border-line px-3.5 py-2.5 text-[14px]" value={form.headcount_y1} onChange={(e) => set("headcount_y1", Number(e.target.value))} /></label>
                  </div>
                  <Field label={ja ? "希望する参入形態" : "Preferred entry mode"}>{opts(MODES, "entry_mode")}</Field>
                  <Field label={ja ? "探しているパートナー" : "Partner you are looking for"}>{opts(SEEKING, "seeking", "sm:grid-cols-4")}</Field>
                </>
              )}
              {step === 2 && (
                <>
                  <Field label={ja ? "必須条件" : "Must-haves"}>
                    <div className="flex flex-wrap gap-2">{MUSTS.map(([v, j, e]) => <Choice key={v} active={form.must_haves.includes(v)} onClick={() => toggle("must_haves", v)}>{ja ? j : e}</Choice>)}</div>
                  </Field>
                  <Field label={ja ? "関心のある州（任意）" : "States you are already considering (optional)"}>
                    <div className="flex flex-wrap gap-2">{STATES.map((s) => <Choice key={s} active={form.target_states.includes(s)} onClick={() => toggle("target_states", s)}>{s}</Choice>)}</div>
                  </Field>
                  <Field label={ja ? "リスク許容度" : "Risk appetite"}>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {APPETITE.map(([v, j, e, dj, de]) => (
                        <Choice key={v} active={form.risk_appetite === v} onClick={() => set("risk_appetite", v)}>
                          <div className="jp text-[14px] font-semibold">{ja ? j : e}</div>
                          <div className={`jp mt-0.5 text-[12px] ${form.risk_appetite === v ? "text-white/75" : "text-muted"}`}>{ja ? dj : de}</div>
                        </Choice>
                      ))}
                    </div>
                  </Field>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex justify-between border-t border-line pt-6">
          <button className="btn-ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ArrowLeft size={15} /> {ja ? "戻る" : "Back"}</button>
          {step < 2 ? (
            <button className="btn-ink" disabled={step === 0 && !form.name && !form.name_ja} onClick={() => setStep((s) => s + 1)}>{ja ? "次へ" : "Next"} <ArrowRight size={15} /></button>
          ) : (
            <button className="btn-red" disabled={busy} onClick={finish}>{busy && <Loader2 size={15} className="animate-spin" />} {ja ? "分析を開始" : "Run the market analysis"} <ArrowRight size={15} /></button>
          )}
        </div>
      </section>
    </Shell>
  );
}
