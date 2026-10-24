import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Copy, FileText, Loader2, Play, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Shell, { rememberSme } from "../components/Shell";
import { useI18n } from "../i18n";
import { api } from "../lib/api";

interface Workspace {
  smeId: number;
  advisorSmeId: number;
  invs: Record<string, number>;
}

const KEY = "shinrai.workspace.v2";
const read = (): Workspace | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
};
const write = (w: Workspace | null) => {
  try {
    w ? localStorage.setItem(KEY, JSON.stringify(w)) : localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
};

type Tone = "green" | "red" | "amber" | "ink";
const TONE: Record<Tone, string> = { green: "bg-verified-soft text-verified", red: "bg-hinomaru-soft text-hinomaru", amber: "bg-amber-soft text-amber", ink: "bg-ink text-white" };

interface Scenario {
  id: string;
  title: [string, string];
  type: string;
  outcome: [string, string];
  tone: Tone;
  points: [string, string][];
  provenance: [string, string];
  runtime: string;
  brochure?: boolean;
  advisor?: boolean;
}

const SCENARIOS: Scenario[] = [
  { id: "maruti", title: ["Clean, Japan-linked manufacturer", "健全な日系関連メーカー"], type: "L34103DL1981PLC011375", outcome: ["Low risk", "低リスク"], tone: "green",
    points: [["Active on the MCA register since 1981, Suzuki Motor Corporation as parent", "1981年からMCA登記上有効、親会社はスズキ株式会社"], ["Manesar plant confirmed on real satellite imagery and building footprints", "マネサール工場を実際の衛星画像と建物データで確認"], ["No findings; unchecked sources are shown as such", "指摘なし。未確認の情報源はその旨を表示"]],
    provenance: ["Public records (MCA, IBBI, satellite)", "公的記録（MCA・IBBI・衛星）"], runtime: "35 s" },
  { id: "future", title: ["Company in insolvency proceedings", "倒産手続き中の企業"], type: "future retail", outcome: ["High risk", "高リスク"], tone: "red",
    points: [["IBBI public announcements: CIRP (23-07-2022) and liquidation (02-08-2024)", "IBBI公告：CIRP（2022-07-23）、清算（2024-08-02）"], ["Every finding cites the official record; stated factually", "すべての指摘は公式記録を引用し、事実のみを記載"], ["Term sheet adds litigation and insolvency protections", "契約条件書に訴訟・倒産への保護条項を追加"]],
    provenance: ["Public records (MCA, IBBI)", "公的記録（MCA・IBBI）"], runtime: "35 s" },
  { id: "kaveri", title: ["Mid-risk supplier", "中程度リスクのサプライヤー"], type: "kaveri precision", outcome: ["Standard", "標準"], tone: "amber",
    points: [["Overdue annual filings and two pending cases as respondent", "年次報告の遅延と被告としての係属訴訟2件"], ["A director holding 11 directorships", "11社の取締役を兼任する取締役"], ["Conditional approval with document requests", "書類提出を条件とした承認"]],
    provenance: ["Illustrative case", "説明用ケース"], runtime: "40 s" },
  { id: "sunrise", title: ["Brochure claims against the record", "会社資料の主張を記録と照合"], type: "sunrise auto components", outcome: ["High risk", "高リスク"], tone: "red", brochure: true,
    points: [["Brochure claims a 50,000 sq ft factory since 2005; satellite shows a 353 m² shed built in 2022", "5万平方フィート・2005年創業の主張に対し、衛星では2022年築の353㎡"], ["Seven risk-driven contract clauses, each linked to its evidence", "証拠に紐づくリスク連動条項7件"], ["Consented GST data, Genba Audit and the 稟議書", "同意に基づくGSTデータ、現地監査、稟議書"]],
    provenance: ["Illustrative case · financial data simulated", "説明用ケース・財務データはシミュレーション"], runtime: "50 s" },
  { id: "advisor", title: ["Market entry plan for a new company", "新規企業の市場参入計画"], type: "Hokuriku Foods Co., Ltd.", outcome: ["Advisor", "アドバイザー"], tone: "ink", advisor: true,
    points: [["Food processing, export hub, ¥50–300M, aggressive, needs a port", "食品加工・輸出拠点・5,000万〜3億円・積極的・港湾必須"], ["3D India map, white space, entry route and compliance roadmap", "3Dインド地図、ホワイトスペース、参入形態、手続き工程"], ["Growth plan and institutional contacts", "成長戦略と主要窓口"]],
    provenance: ["Cited knowledge base", "出典付きナレッジベース"], runtime: "22 s" },
];

const SCRIPT: [string, string, string][] = [
  ["Landing and onboarding", "ランディングと登録", "/"], ["Advisor run on the 3D map", "3D地図でのアドバイザー分析", "advisor"],
  ["Contacts and verified partners", "主要窓口と検証済みパートナー", "advisor"], ["Verify: Sunrise", "検証：Sunrise", "theater:sunrise"],
  ["Ground truth and 3D flyover", "現地確認と3Dフライオーバー", "report:sunrise#ground"], ["Risk-driven term sheet", "リスク連動の契約条件", "report:sunrise#termsheet"],
  ["Financial data and 稟議書", "財務データと稟議書", "report:sunrise#money"], ["Genba Audit", "現地監査", "report:sunrise#audit"],
  ["Analytics", "分析", "analytics"], ["Live company, then Maruti Suzuki", "実企業の調査とマルチ・スズキ", "theater:maruti"],
];

export default function Demo() {
  const { lang } = useI18n();
  const ja = lang === "ja";
  const nav = useNavigate();
  const [ws, setWs] = useState<Workspace | null>(read);
  const [query, setQuery] = useState("");
  const [brochure, setBrochure] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prepare = useCallback(async () => {
    setBusy("prepare");
    try {
      const r: any = await api.demoSetup();
      const w = { smeId: r.sme.id, advisorSmeId: r.advisor_sme.id, invs: {} };
      write(w);
      setWs(w);
      rememberSme(r.sme.id);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (!ws) prepare();
  }, [ws, prepare]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        write(null);
        setWs(null);
        setQuery("");
        setBrochure(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const investigate = async (text: string, attach: boolean, key: string) => {
    if (!ws || !text.trim()) return;
    setError(null);
    setBusy(key);
    try {
      const f = new FormData();
      f.append("sme_id", String(ws.smeId));
      f.append("name", text.trim());
      if (attach) f.append("demo_brochure", "true");
      const p = await api.createPartner(f);
      const { id } = await api.investigate(p.id, "auto");
      const w = { ...ws, invs: { ...ws.invs, [key]: id } };
      write(w);
      setWs(w);
      rememberSme(ws.smeId);
      nav(`/investigation/${id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const runScenario = (s: Scenario) => {
    if (s.advisor) {
      if (ws) {
        rememberSme(ws.advisorSmeId);
        nav(`/advisor/${ws.advisorSmeId}`);
      }
      return;
    }
    investigate(s.type, !!s.brochure, s.id);
  };

  const copy = (t: string) => {
    navigator.clipboard?.writeText(t);
    setCopied(t);
    setTimeout(() => setCopied(null), 1200);
  };

  const link = (target: string): string | null => {
    if (!ws) return null;
    if (target === "/") return "/";
    if (target === "advisor") return `/advisor/${ws.smeId}`;
    if (target === "analytics") return `/intelligence/${ws.smeId}`;
    const [kind, rest] = target.split(":");
    const [key, hash] = rest.split("#");
    const inv = ws.invs[key];
    if (!inv) return null;
    return kind === "theater" ? `/investigation/${inv}` : `/report/${inv}${hash ? `#${hash}` : ""}`;
  };

  return (
    <Shell wide>
      <div className="mx-auto max-w-[1440px] px-4 pb-24 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="label">{ja ? "田中精工株式会社 · ワークスペース" : "Tanaka Seiko K.K. · Workspace"}</div>
            <h1 className="jp mt-1 text-[32px] font-bold tracking-tight">{ja ? "シナリオ" : "Scenarios"}</h1>
          </div>
          {ws && (
            <div className="flex gap-2">
              <Link to={`/advisor/${ws.smeId}`} className="btn-ghost">{ja ? "アドバイザー" : "Advisor"}</Link>
              <Link to={`/master-report/${ws.smeId}`} className="btn-ghost"><FileText size={15} /> {ja ? "統合レポート" : "Full report"}</Link>
            </div>
          )}
        </div>

        {/* live input */}
        <div className="mt-6 rounded-2xl border border-line bg-paper p-5 shadow-card">
          <form className="flex flex-wrap items-center gap-3" onSubmit={(e) => { e.preventDefault(); investigate(query, brochure, `q${Date.now()}`); }}>
            <div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-xl border border-line-strong px-4 py-3 focus-within:border-ink">
              <Search size={18} className="text-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off"
                placeholder={ja ? "企業名、CIN、またはGSTINを入力" : "Company name, CIN or GSTIN"} className="flex-1 bg-transparent text-[16px] outline-none" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={brochure} onChange={(e) => setBrochure(e.target.checked)} className="h-4 w-4 accent-ink" />
              {ja ? "会社資料を添付（sunrise_brochure.pdf）" : "Attach partner brochure (sunrise_brochure.pdf)"}
            </label>
            <button className="btn-red px-6 py-3 text-[15px]" disabled={!ws || !query.trim() || !!busy}>
              {busy?.startsWith("q") ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} {ja ? "調査開始" : "Investigate"}
            </button>
          </form>
          {error && <p className="mt-3 text-[13px] text-hinomaru">{error}</p>}
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="grid gap-4 md:grid-cols-2">
            {SCENARIOS.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={`flex flex-col rounded-2xl border border-line bg-paper p-5 shadow-card ${s.advisor ? "md:col-span-2" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="num text-[15px] text-muted">{String.fromCharCode(65 + i)}</span>
                    <h2 className="jp mt-0.5 text-[17px] font-semibold">{ja ? s.title[1] : s.title[0]}</h2>
                  </div>
                  <span className={`chip ${TONE[s.tone]}`}>{ja ? s.outcome[1] : s.outcome[0]}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-stage px-3 py-2 font-mono text-[13px] text-ink">{s.type}</code>
                  <button className="btn-ghost !px-2.5 !py-2" onClick={() => copy(s.type)} aria-label="Copy input">{copied === s.type ? <Check size={14} /> : <Copy size={14} />}</button>
                  {!s.advisor && <button className="btn-ghost !py-2 text-xs" onClick={() => { setQuery(s.type); setBrochure(!!s.brochure); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{ja ? "入力欄へ" : "Use"}</button>}
                </div>
                <ul className={`mt-3 flex-1 space-y-1.5 text-[13px] text-ink-2 ${ja ? "jp" : ""}`}>
                  {s.points.map((p) => <li key={p[0]} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-3" />{ja ? p[1] : p[0]}</li>)}
                </ul>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <span className="text-[11.5px] text-muted">{ja ? s.provenance[1] : s.provenance[0]} · {s.runtime}</span>
                  <button className="btn-ink !py-1.5 text-[13px]" disabled={!ws || !!busy} onClick={() => runScenario(s)}>
                    {busy === s.id ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />} {s.advisor ? (ja ? "分析を開く" : "Open analysis") : ja ? "実行" : "Run"}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          <aside className="h-fit rounded-2xl border border-line bg-paper p-5 shadow-card xl:sticky xl:top-20">
            <h2 className="text-[14px] font-semibold">{ja ? "進行（約4分）" : "Run of show (about 4 minutes)"}</h2>
            <ol className="mt-3 space-y-0.5">
              {SCRIPT.map(([en, jaT, target], i) => {
                const href = link(target);
                const inner = (
                  <>
                    <span className="num w-5 text-[14px] text-hinomaru">{i + 1}</span>
                    <span className={`flex-1 text-[13px] ${href ? "text-ink" : "text-muted"}`}>{ja ? jaT : en}</span>
                    {href && <ArrowRight size={13} className="text-muted" />}
                  </>
                );
                return (
                  <li key={en}>
                    {href ? <Link to={href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-wash">{inner}</Link>
                      : <div className="flex items-center gap-2 px-2 py-1.5">{inner}</div>}
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>
        <AnimatePresence>{busy === "prepare" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed bottom-5 right-5 flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[13px] text-white shadow-lift">
            <Loader2 size={14} className="animate-spin" /> {ja ? "ワークスペースを準備しています" : "Preparing workspace"}
          </motion.div>
        )}</AnimatePresence>
      </div>
    </Shell>
  );
}
