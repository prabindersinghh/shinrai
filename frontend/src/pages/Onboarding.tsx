import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Shell, { rememberSme } from "../components/Shell";
import { useI18n } from "../i18n";
import { api } from "../lib/api";

const INDUSTRIES = [
  ["auto_parts", "自動車部品", "Auto parts"], ["machinery", "機械・設備", "Machinery"], ["electronics", "電子部品", "Electronics"],
  ["chemicals", "化学・樹脂", "Chemicals & polymers"], ["food", "食品", "Food"], ["textiles", "繊維", "Textiles"], ["medical", "医療機器", "Medical"],
];
const SEEKING = [
  ["distributor", "販売代理店", "Distributor"], ["jv", "合弁パートナー", "JV partner"], ["supplier", "仕入先", "Supplier"], ["contract_mfg", "製造委託先", "Contract manufacturer"],
];
const STATES = ["Haryana", "Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat", "Delhi", "Uttar Pradesh", "Telangana", "Rajasthan", "West Bengal"];
const DEALS = [["small", "〜5,000万円", "Up to ¥50M"], ["mid", "5,000万〜5億円", "¥50M–¥500M"], ["large", "5億円〜", "Over ¥500M"]];
const APPETITE = [
  ["conservative", "保守的", "Conservative", "小さなリスクでも慎重に判断します。適合度はスコアの影響を強く受けます。", "Small risks weigh heavily; fit depends strongly on the trust score."],
  ["balanced", "標準", "Balanced", "リスクと事業機会のバランスを取ります。", "Balances risk against opportunity."],
  ["aggressive", "積極的", "Aggressive", "条件付きでもスピードを優先します。", "Prioritises speed and accepts managed risk."],
];

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`rounded-lg border px-3.5 py-2.5 text-left text-[13px] transition-colors ${active ? "border-ink bg-ink text-white" : "border-line bg-paper hover:border-line-strong"}`}>
      {children}
    </button>
  );
}

export default function Onboarding() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const demo = params.get("demo") === "1";
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: demo ? "Tanaka Seiko K.K." : "", name_ja: demo ? "田中精工株式会社" : "", industry: "auto_parts",
    seeking: "distributor", target_states: demo ? ["Haryana"] : [] as string[], deal_band: "mid",
    risk_appetite: demo ? "conservative" : "balanced", language: lang,
  });
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const ja = lang === "ja";
  const steps = [t("onboard.step1"), t("onboard.step2"), t("onboard.step3")];

  const finish = async () => {
    setBusy(true);
    try {
      const sme = await api.createSme({ ...form, language: lang });
      rememberSme(sme.id);
      nav(`/partners/${sme.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <section className="mx-auto max-w-[760px] px-4 py-14 sm:px-6">
        <h1 className="jp text-[32px] font-bold tracking-tight">{t("onboard.title")}</h1>
        <ol className="mt-6 flex gap-2">
          {steps.map((s, i) => (
            <li key={s} className="flex-1">
              <div className={`h-1 rounded-full ${i <= step ? "bg-hinomaru" : "bg-line"}`} />
              <div className={`mt-2 text-[12px] font-medium ${i === step ? "text-ink" : "text-muted"}`}>
                <span className="num mr-1 text-[14px]">{i + 1}</span>{s}
              </div>
            </li>
          ))}
        </ol>

        <div className="relative mt-8 min-h-[330px]">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }} className="space-y-6">
              {step === 0 && (
                <>
                  <label className="block">
                    <span className="label">{t("onboard.name_ja")}</span>
                    <input className="jp mt-1 w-full rounded-lg border border-line px-3.5 py-2.5 text-[15px]" value={form.name_ja} onChange={(e) => set("name_ja", e.target.value)} placeholder="田中精工株式会社" />
                  </label>
                  <label className="block">
                    <span className="label">{t("onboard.name")}</span>
                    <input className="mt-1 w-full rounded-lg border border-line px-3.5 py-2.5 text-[15px]" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Tanaka Seiko K.K." />
                  </label>
                  <div>
                    <span className="label">{t("onboard.industry")}</span>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {INDUSTRIES.map(([v, j, e]) => <Choice key={v} active={form.industry === v} onClick={() => set("industry", v)}>{ja ? j : e}</Choice>)}
                    </div>
                  </div>
                </>
              )}
              {step === 1 && (
                <>
                  <div>
                    <span className="label">{t("onboard.seeking")}</span>
                    <div className="mt-2 grid grid-cols-2 gap-2">{SEEKING.map(([v, j, e]) => <Choice key={v} active={form.seeking === v} onClick={() => set("seeking", v)}>{ja ? j : e}</Choice>)}</div>
                  </div>
                  <div>
                    <span className="label">{t("onboard.states")}</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {STATES.map((s) => (
                        <Choice key={s} active={form.target_states.includes(s)}
                          onClick={() => set("target_states", form.target_states.includes(s) ? form.target_states.filter((x) => x !== s) : [...form.target_states, s])}>{s}</Choice>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="label">{t("onboard.deal")}</span>
                    <div className="mt-2 grid grid-cols-3 gap-2">{DEALS.map(([v, j, e]) => <Choice key={v} active={form.deal_band === v} onClick={() => set("deal_band", v)}>{ja ? j : e}</Choice>)}</div>
                  </div>
                </>
              )}
              {step === 2 && (
                <div className="grid gap-3">
                  {APPETITE.map(([v, j, e, dj, de]) => (
                    <Choice key={v} active={form.risk_appetite === v} onClick={() => set("risk_appetite", v)}>
                      <div className="jp text-[15px] font-semibold">{ja ? j : e}</div>
                      <div className={`jp mt-0.5 text-[12.5px] ${form.risk_appetite === v ? "text-white/75" : "text-muted"}`}>{ja ? dj : de}</div>
                    </Choice>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex justify-between border-t border-line pt-6">
          <button className="btn-ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ArrowLeft size={15} /> {t("onboard.back")}</button>
          {step < 2 ? (
            <button className="btn-ink" disabled={step === 0 && !form.name && !form.name_ja} onClick={() => setStep((s) => s + 1)}>{t("onboard.next")} <ArrowRight size={15} /></button>
          ) : (
            <button className="btn-red" disabled={busy} onClick={finish}>{t("onboard.finish")} <ArrowRight size={15} /></button>
          )}
        </div>
      </section>
    </Shell>
  );
}
