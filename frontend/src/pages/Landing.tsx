import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import HankoSeal from "../components/HankoSeal";
import Shell from "../components/Shell";
const IndiaMap3D = lazy(() => import("../components/IndiaMap3D"));
import { useI18n } from "../i18n";

const PILLARS = [
  { key: "paper", kanji: "書類", n: "01" },
  { key: "ground", kanji: "現地", n: "02" },
  { key: "money", kanji: "資金", n: "03" },
  { key: "action", kanji: "行動", n: "04" },
];

function ReportCard() {
  const { lang } = useI18n();
  const rows = [
    { ja: "取締役が登記抹消済みの会社2社に関与", en: "A director is linked to 2 struck-off companies", src: "MCA21", bad: true },
    { ja: "GST登録：取消（2024年）", en: "GST registration cancelled in 2024", src: "GST", bad: true },
    { ja: "主張工場の建物は2022年に出現（主張：2005年〜）", en: "Claimed factory first appears in 2022 (claimed since 2005)", src: "Satellite", bad: true },
    { ja: "法人登記：有効", en: "Company status: Active", src: "MCA21", bad: false },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-2xl border border-line bg-paper p-6 shadow-lift">
      <div className="flex items-start justify-between">
        <div>
          <div className="label">{lang === "ja" ? "信頼レポート · 41秒で作成" : "Trust report · generated in 41 s"}</div>
          <div className="mt-1 text-[15px] font-semibold">Sunrise Auto Components Pvt Ltd</div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-muted">
            U29304HR2023PTC110482 <span className="chip bg-stage text-ink-3 ring-1 ring-line">{lang === "ja" ? "説明用ケース" : "Illustrative case"}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-baseline justify-end gap-1"><span className="num text-[64px] leading-[0.85] text-hinomaru">14</span><span className="num text-lg text-muted">/100</span></div>
          <div className="jp text-[13px] font-bold text-hinomaru">高リスク · {lang === "ja" ? "見送り推奨" : "Do not proceed"}</div>
        </div>
      </div>
      <div className="mt-5 space-y-2.5">
        {rows.map((r) => (
          <div key={r.en} className="flex items-start gap-3 border-t border-line pt-2.5">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${r.bad ? "bg-hinomaru" : "bg-verified"}`} />
            <div className="min-w-0 flex-1">
              <div className="jp text-[13px] text-ink">{r.ja}</div>
              <div className="text-[11.5px] text-muted">{r.en}</div>
            </div>
            <span className="font-mono text-[10px] text-ink-3">{r.src} ↗</span>
          </div>
        ))}
      </div>
      <div className="absolute -bottom-7 -right-5"><HankoSeal band="high" size={104} delay={0.7} /></div>
    </motion.div>
  );
}

function MapBand() {
  const { lang } = useI18n();
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    fetch("/api/advisor/preview").then((r) => r.json()).then(setD).catch(() => setD(null));
  }, []);
  const scores = d ? Object.fromEntries(d.states.map((s: any) => [s.state, s])) : {};
  const pins = d ? [...d.support_network.offices.map((o: any) => ({ id: o.id, name: o.name, kind: o.kind === "jetro" ? "jetro" : "consulate", lat: o.lat, lon: o.lon })),
    ...d.support_network.jits.map((j: any) => ({ id: j.id, name: j.name, kind: "jit", lat: j.lat, lon: j.lon }))] : [];
  return (
    <section className="border-t border-line">
      <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.5fr]">
        <div>
          <h2 className="jp text-[28px] font-bold leading-snug tracking-tight">{lang === "ja" ? "どの州で、どの規模で参入すべきか。" : "Where in India, and at what scale."}</h2>
          <p className={`mt-4 text-[15px] leading-relaxed text-ink-2 ${lang === "ja" ? "jp" : ""}`}>
            {lang === "ja" ? "製造業の厚み、日系企業の集積、日本工業団地、港湾、投資の勢いから各州の適合度を算出します。すべての数値に公的な出典があります。"
              : "Shinrai scores each state on manufacturing depth, Japanese company clusters, Japan Industrial Townships, port access and investment momentum. Every figure carries its official source."}
          </p>
          {d && (
            <ol className="mt-6 space-y-2">
              {d.top.map((t: any, i: number) => (
                <li key={t.state} className="flex items-baseline gap-3 border-b border-line pb-2">
                  <span className="num text-[20px] text-hinomaru">{i + 1}</span>
                  <span className="flex-1 text-[15px] font-semibold">{lang === "ja" ? t.name_ja : t.state}</span>
                  <span className="num text-[20px]">{t.fit}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-[11.5px] text-muted">{lang === "ja" ? "例：インドで販売・標準的なリスク許容度" : "Example profile: sell in India, balanced risk appetite"}</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
          <Suspense fallback={<div className="h-[520px] animate-pulse bg-stage" />}>
            <IndiaMap3D scores={scores} layer="fit" pins={pins} height={520} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { t, lang } = useI18n();
  return (
    <Shell>
      <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="jp flex items-center gap-3 text-[13px] font-medium text-ink-3">
            <span className="h-px w-8 bg-hinomaru" /> JETRO × Thapar Japan Hackathon 2026 · 01JETRO-PS-01
          </div>
          <h1 className="jp mt-5 text-[44px] font-bold leading-[1.18] tracking-tight text-ink sm:text-[56px]">
            {lang === "ja" ? <>判を押す前に、<br />相手を知る。</> : <>Know who you sign with,<br />before the hanko.</>}
          </h1>
          <p className={`mt-6 max-w-[38rem] text-[17px] leading-relaxed text-ink-2 ${lang === "ja" ? "jp" : ""}`}>{t("brand.position")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/demo" className="btn-red px-5 py-3 text-[15px]">{t("landing.demo")} <ArrowRight size={17} /></Link>
            <Link to="/onboarding" className="btn-ghost px-5 py-3 text-[15px]">{t("landing.cta")}</Link>
          </div>
          <dl className="mt-12 grid max-w-[34rem] grid-cols-3 gap-6 border-t border-line pt-6">
            {[
              ["1,434", lang === "ja" ? "インドの日本企業（2018年からほぼ横ばい）" : "Japanese firms in India, flat since 2018"],
              ["~20%", lang === "ja" ? "うち中小企業の割合" : "of them are SMEs"],
              ["< 60s", lang === "ja" ? "社名から日本語レポートまで" : "name to Japanese report"],
            ].map(([n, l]) => (
              <div key={n}>
                <dt className="num text-[34px] leading-none text-ink">{n}</dt>
                <dd className="jp mt-1.5 text-[12px] leading-snug text-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ReportCard />
      </section>

      <MapBand />

      <section className="border-t border-line bg-wash">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
          <h2 className={`text-[13px] font-semibold text-ink-3 ${lang === "ja" ? "jp" : ""}`}>{t("landing.pillars")}</h2>
          <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
            {PILLARS.map((p) => (
              <div key={p.key} className="bg-paper p-6">
                <div className="flex items-baseline justify-between">
                  <span className={`jp text-[44px] font-bold leading-none ${p.key === "ground" ? "text-hinomaru" : "text-ink"}`}>{p.kanji}</span>
                  <span className="num text-lg text-muted">{p.n}</span>
                </div>
                <div className="mt-4 text-[15px] font-semibold">{t(`pillar.${p.key}`)}</div>
                <p className={`mt-2 text-[13px] leading-relaxed text-ink-3 ${lang === "ja" ? "jp" : ""}`}>{t(`pillar.${p.key}.body`)}</p>
                {p.key === "ground" && <p className="jp mt-3 text-[12px] font-medium text-hinomaru">現地現物 · genchi genbutsu from space</p>}
                {p.key === "money" && <p className="mt-3 text-[11px] font-medium text-muted">{lang === "ja" ? "※ハッカソンではシミュレーション" : "Simulated for the hackathon"}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
          <h2 className="jp whitespace-pre-line text-[28px] font-bold leading-snug">{lang === "ja" ? "LLMは判断しない。\nルールが判断し、すべての指摘に出典がある。" : "The AI never decides. Rules do, and every flag has a source."}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              [lang === "ja" ? "出典なき指摘はしない" : "No source, no flag", lang === "ja" ? "すべての指摘と主張の判定は、保存された公的記録（取得日時・SHA-256付き）に紐づきます。" : "Every flag and claim verdict links to a stored record with its retrieval time and SHA-256."],
              [lang === "ja" ? "決定論的なスコア" : "Deterministic score", lang === "ja" ? "スコアはルールブックから算出。LLMは資料からの抽出と、引用付きの文章作成のみを行います。" : "Scores come from a rulebook. The LLM only extracts claims and writes cited prose."],
              [lang === "ja" ? "わからないことはわからない" : "Unknown stays unknown", lang === "ja" ? "確認できない主張は❓、取得できない情報源は「未確認」と表示します。" : "Unverifiable claims show ❓; unreachable sources show “not checked”."],
              [lang === "ja" ? "常に稼働" : "Always available", lang === "ja" ? "情報源に接続できない場合は記録済みの応答に自動で切り替え、出典の種類を常に表示します。" : "When a source is unreachable, Shinrai falls back to recorded responses and always shows where each record came from."],
            ].map(([h, b]) => (
              <div key={h} className="border-t-2 border-ink pt-3">
                <div className="jp text-[15px] font-semibold">{h}</div>
                <p className="jp mt-1.5 text-[13px] leading-relaxed text-ink-3">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <footer className="border-t border-line py-8 text-center text-[11.5px] text-muted">
        <span className="jp">{t("report.disclaimer")}</span>
      </footer>
    </Shell>
  );
}
