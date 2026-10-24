import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2, Play, RotateCcw, Zap } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import Shell, { rememberSme } from "../components/Shell";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { BAND } from "../lib/visual";

interface DemoState {
  smeId: number;
  partners: { sunrise: number; kaveri: number; maruti: number };
  invs: Partial<Record<"sunrise" | "kaveri" | "maruti" | "live", number>>;
}

const KEY = "shinrai.demo";
function load(): DemoState | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}
function save(s: DemoState | null) {
  try {
    s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

function Step({ n, secs, title, body, done, children }: { n: number; secs: number; title: string; body: string; done?: boolean; children?: ReactNode }) {
  const { lang } = useI18n();
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: n * 0.04 }} className="relative grid grid-cols-[56px_1fr] gap-4 pb-7">
      <div className="flex flex-col items-center">
        <div className={`grid h-11 w-11 place-items-center rounded-full border-2 ${done ? "border-ink bg-ink text-white" : "border-line bg-paper text-ink"}`}>
          {done ? <Check size={18} strokeWidth={3} /> : <span className="num text-[20px]">{n}</span>}
        </div>
        <div className="mt-1 w-px flex-1 bg-line" />
      </div>
      <div className="min-w-0 pt-1">
        <div className="flex items-baseline gap-3">
          <h3 className={`text-[16px] font-semibold ${lang === "ja" ? "jp" : ""}`}>{title}</h3>
          <span className="font-mono text-[11px] text-muted">{secs}s</span>
        </div>
        <p className={`mt-1 max-w-[46rem] text-[13px] leading-relaxed text-ink-3 ${lang === "ja" ? "jp" : ""}`}>{body}</p>
        {children && <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </motion.li>
  );
}

export default function Demo() {
  const { lang } = useI18n();
  const nav = useNavigate();
  const [demo, setDemo] = useState<DemoState | null>(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, { score: number | null; band: string | null; status: string }>>({});
  const [liveName, setLiveName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const ja = lang === "ja";

  useEffect(() => {
    if (!demo) return;
    let stop = false;
    const poll = async () => {
      const out: typeof scores = {};
      for (const [k, id] of Object.entries(demo.invs)) {
        if (!id) continue;
        try {
          const inv = await api.investigation(id);
          out[k] = { score: inv.overall_score, band: inv.band, status: inv.status };
        } catch {
          /* investigation may have been cleared */
        }
      }
      if (!stop) setScores(out);
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [demo]);

  const update = (s: DemoState | null) => {
    save(s);
    setDemo(s);
  };

  const setup = async () => {
    setBusy("setup");
    setMsg(null);
    try {
      const r = await api.demoSetup();
      rememberSme(r.sme.id);
      update({ smeId: r.sme.id, partners: { sunrise: r.partners[0].id, kaveri: r.partners[1].id, maruti: r.partners[2].id }, invs: {} });
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  const investigate = async (key: "sunrise" | "kaveri" | "maruti", go: boolean) => {
    if (!demo) return;
    setBusy(key);
    try {
      const { id } = await api.investigate(demo.partners[key]);
      update({ ...demo, invs: { ...demo.invs, [key]: id } });
      if (go) nav(`/investigation/${id}`);
    } finally {
      setBusy(null);
    }
  };

  const prepCompare = async () => {
    if (!demo) return;
    setBusy("prep");
    try {
      const k = await api.investigate(demo.partners.kaveri);
      const m = await api.investigate(demo.partners.maruti);
      update({ ...demo, invs: { ...demo.invs, kaveri: k.id, maruti: m.id } });
    } finally {
      setBusy(null);
    }
  };

  const runLive = async () => {
    if (!demo || !liveName.trim()) return;
    setBusy("live");
    try {
      const f = new FormData();
      f.append("sme_id", String(demo.smeId));
      f.append("name", liveName.trim());
      const p = await api.createPartner(f);
      const { id } = await api.investigate(p.id, "live");
      update({ ...demo, invs: { ...demo.invs, live: id } });
      nav(`/investigation/${id}`);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  const demoAudit = async () => {
    const id = demo?.invs.sunrise;
    if (!id) return;
    setBusy("audit");
    setMsg(null);
    try {
      const r = await api.demoAudit(id);
      setMsg(ja ? `監査完了。スコアは ${r.overall} に更新されました。` : `Audit completed. Score updated to ${r.overall}.`);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  const sunrise = demo?.invs.sunrise;
  const sunriseDone = scores.sunrise?.status === "done";
  const chip = (k: string) => {
    const s = scores[k];
    if (!s) return null;
    if (s.status !== "done") return <span className="chip bg-stage text-ink-2 ring-1 ring-line"><Loader2 size={11} className="animate-spin" /> {s.status}</span>;
    const b = BAND[s.band ?? ""];
    return <span className="chip" style={{ background: b?.soft, color: b?.color }}>{s.score} · {ja ? b?.ja : b?.en}</span>;
  };
  const spin = (k: string) => (busy === k ? <Loader2 size={15} className="animate-spin" /> : null);

  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-4 pb-24 pt-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-8">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold text-hinomaru"><span className="h-2 w-2 rounded-full bg-hinomaru" /> {ja ? "デモ台本 · 3分" : "Demo run sheet · 3 minutes"}</div>
            <h1 className="jp mt-2 text-[40px] font-bold leading-tight tracking-tight">{ja ? "デモを、ワンクリックで。" : "The whole pitch, one click at a time."}</h1>
            <p className={`mt-2 max-w-[44rem] text-[14px] text-ink-3 ${ja ? "jp" : ""}`}>
              {ja ? "田中精工株式会社（自動車部品、ハリヤナ州で販売代理店を探す、保守的）が、インド企業3社を調査します。Sunrise と Kaveri は架空のデモ企業、Maruti Suzuki は公開情報に基づく実在企業です。"
                : "Tanaka Seiko K.K. (auto parts, looking for a distributor in Haryana, conservative) checks three Indian companies. Sunrise and Kaveri are fictional demo companies; Maruti Suzuki is a real company from public records."}
            </p>
          </div>
          <div className="flex gap-2">
            {demo && <button className="btn-ghost" onClick={() => { update(null); setScores({}); }}><RotateCcw size={15} /> {ja ? "リセット" : "Reset"}</button>}
            <button className="btn-red px-5 py-2.5" onClick={setup} disabled={busy === "setup"}>
              {spin("setup") ?? <Zap size={16} />} {demo ? (ja ? "新しいデモを準備" : "Set up a fresh demo") : ja ? "デモを準備" : "Set up the demo"}
            </button>
          </div>
        </div>
        {msg && <div className="mt-4 rounded-lg border border-line bg-wash px-4 py-2.5 text-[13px]">{msg}</div>}

        <ol className="mt-10">
          <Step n={1} secs={15} done={!!demo} title={ja ? "ランディングと会社登録" : "Landing page and onboarding"}
            body={ja ? "新しいポジショニングと4つの柱を見せ、田中精工を日本語で登録します（準備ボタンで登録済み）。" : "Show the positioning and the four pillars, then onboard Tanaka Seiko in Japanese (the setup button does this)."}>
            <Link to="/" className="btn-ghost">{ja ? "ランディング" : "Landing"}</Link>
            <Link to="/onboarding?demo=1" className="btn-ghost">{ja ? "登録画面（入力済み）" : "Onboarding (prefilled)"}</Link>
          </Step>
          <Step n={2} secs={10} done={!!demo} title={ja ? "候補企業と会社資料を追加" : "Add the partner and its brochure"}
            body={ja ? "「Sunrise Auto Components（DEMO）」とパンフレットPDF（20年の実績、プネーの5万平方フィート工場、売上50億ルピーと主張）。" : "“Sunrise Auto Components (DEMO)” with its brochure PDF (claims 20 years, a 50,000 sq ft Pune factory since 2005, ₹50 crore turnover)."}>
            {demo && <Link to={`/partners/${demo.smeId}`} className="btn-ghost">{ja ? "候補企業一覧" : "Partner list"}</Link>}
          </Step>
          <Step n={3} secs={50} done={sunriseDone} title={ja ? "調査シアター" : "Investigation Theater"}
            body={ja ? "書類系の情報源、続いて🛰️衛星の確認。グラフが約40ノードまで成長し、主張拠点のノードが赤く脈打ち、スコアが確定して判が押されます。" : "Paper sources run, then the 🛰️ ground lines. The graph grows to ~40 nodes, the claimed-site node pulses red, the score settles and the seal stamps."}>
            <button className="btn-ink" disabled={!demo || busy === "sunrise"} onClick={() => investigate("sunrise", true)}>
              {spin("sunrise") ?? <Play size={15} />} {ja ? "Sunrise を調査" : "Investigate Sunrise"}
            </button>
            {sunrise && <Link to={`/investigation/${sunrise}?replay=1`} className="btn-ghost"><RotateCcw size={14} /> {ja ? "再生" : "Replay"}</Link>}
            {chip("sunrise")}
          </Step>
          <Step n={4} secs={30} done={false} title={ja ? "現地現物：タイムラプスと3Dフライオーバー" : "Ground truth: time-lapse and 3D flyover"}
            body={ja ? "2016〜2021年は空き地、2022年に小さな建屋。続いて東京から拠点へ飛び、主張された5万平方フィートの枠と実際の小さな建物を3Dで比較します。" : "Empty land 2016–2021, a small shed in 2022. Then fly from Tokyo to the site and compare the ghost “50,000 sq ft” box with the real small building."}>
            <Link to={sunrise ? `/report/${sunrise}#ground` : "#"} className={`btn-ghost ${sunriseDone ? "" : "pointer-events-none opacity-40"}`}>{ja ? "現地確認パネル" : "Ground Truth panel"} <ArrowRight size={14} /></Link>
          </Step>
          <Step n={5} secs={15} title={ja ? "資金：GST申告データの同意（シミュレーション）" : "Money: consented GST returns (simulated)"}
            body={ja ? "財務確認を依頼 → 相手方の同意画面で承認 → 申告売上 約3.1億ルピー vs 主張50億ルピーのグラフ。全画面に「SIMULATED」と表示。" : "Request verification → the partner approves on its mock consent screen → the chart shows about ₹3.1 crore declared against ₹50 crore claimed. Every screen says SIMULATED."}>
            <Link to={sunrise ? `/report/${sunrise}#money` : "#"} className={`btn-ghost ${sunriseDone ? "" : "pointer-events-none opacity-40"}`}>{ja ? "資金パネル" : "Money panel"} <ArrowRight size={14} /></Link>
          </Step>
          <Step n={6} secs={15} title={ja ? "レポートと稟議書" : "Report and 稟議書"}
            body={ja ? "項目別スコア、主張検証表、証拠付きの指摘、日本語の総評。続いて「見送り」の推奨判断が入った稟議書を作成します。" : "Sub-scores, the claims table, a flag with its evidence, the Japanese summary. Then the 稟議書 with the rule-derived recommendation 見送り."}>
            <Link to={sunrise ? `/report/${sunrise}` : "#"} className={`btn-ghost ${sunriseDone ? "" : "pointer-events-none opacity-40"}`}>{ja ? "レポート" : "Report"}</Link>
            <Link to={sunrise ? `/ringi/${sunrise}` : "#"} className={`btn-ghost ${sunriseDone ? "" : "pointer-events-none opacity-40"}`}>稟議書</Link>
          </Step>
          <Step n={7} secs={15} title={ja ? "現場監査（Genba Audit）" : "Genba Audit"}
            body={ja ? "指摘から自動生成されたチェックリストと、GPS検証済みの写真付き完了監査（1枚は位置未検証として表示）。スコアが再計算されます。" : "The checklist generated from the flags, and a completed demo audit with GPS-verified photos (one is marked “location not verified”). The score is recomputed."}>
            <button className="btn-ink" disabled={!sunriseDone || busy === "audit"} onClick={demoAudit}>{spin("audit")} {ja ? "完了済みデモ監査を読み込む" : "Load the completed demo audit"}</button>
            <Link to={sunrise ? `/report/${sunrise}#audit` : "#"} className={`btn-ghost ${sunriseDone ? "" : "pointer-events-none opacity-40"}`}>{ja ? "監査パネル" : "Audit panel"}</Link>
          </Step>
          <Step n={8} secs={20} title={ja ? "LIVE：審査員の指定企業と、健全な実在企業" : "LIVE: a judge's company, and a clean real company"}
            body={ja ? "審査員が挙げたインド企業をLIVEモードで調査（取得できない情報源は✗で表示）。続いてMaruti Suzuki（CACHED実データ）が緑で返ってきます。" : "Run a company a judge names in LIVE mode (sources that can't be reached show ✗). Then Maruti Suzuki (a CACHED real record) comes back green."}>
            <input value={liveName} onChange={(e) => setLiveName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runLive()}
              placeholder={ja ? "例：Tata Motors Limited" : "e.g. Tata Motors Limited"} className="w-64 rounded-lg border border-line px-3 py-2 text-sm" />
            <button className="btn-red" disabled={!demo || !liveName.trim() || busy === "live"} onClick={runLive}>{spin("live")} LIVE</button>
            <button className="btn-ink" disabled={!demo || busy === "maruti"} onClick={() => investigate("maruti", true)}>{spin("maruti")} Maruti Suzuki</button>
            {chip("maruti")}
          </Step>
          <Step n={9} secs={20} title={ja ? "比較と締めくくり" : "Compare and close"}
            body={ja ? "全候補をスコア順に並べて締めくくり：「数週間を60秒に。JETROの紹介案件はすべて事前検証済みに。」" : "Rank every candidate and close: “Weeks to 60 seconds. Every JETRO introduction arrives pre-verified.”"}>
            <button className="btn-ghost" disabled={!demo || busy === "prep"} onClick={prepCompare}>{spin("prep")} {ja ? "Kaveri と Maruti を事前実行" : "Pre-run Kaveri and Maruti"}</button>
            {chip("kaveri")}
            {demo && <Link to={`/compare/${demo.smeId}`} className="btn-ghost">{ja ? "比較表" : "Compare"} <ArrowRight size={14} /></Link>}
          </Step>
        </ol>
      </section>
    </Shell>
  );
}
