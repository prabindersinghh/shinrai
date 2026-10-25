/** Shared procurement UI: shell with persona switcher, chips, badge, glossary, status header, landed-cost table. */
import { AlertTriangle, BadgeCheck, CheckCircle2, CircleDashed, Clock, FastForward, HelpCircle, Info, ShieldAlert, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import Shell from "../components/Shell";
import { useI18n } from "../i18n";
import { CHECK, GLOSSARY, TONE } from "./labels";
import { badgeFor, savings, type Category, type LandedCost, type LineStatus } from "./logic";
import { fmt, type Money } from "./money";
import { DAY, PERSONAS, SWITCHABLE } from "./seed";
import { actions, nowOf, useToasts, useTrade } from "./store";
import type { PersonaId, Supplier } from "./types";

export function useL() {
  const { lang, pick } = useI18n();
  return { lang, ja: lang === "ja", p: (en: string, ja: string) => pick(ja, en), money: (x: Money | null | undefined, compact = false) => fmt(x, lang, { compact }) };
}

// ----- chips -----------------------------------------------------------------------------------------------------
export function Chip({ tone = "muted", children, title }: { tone?: keyof typeof TONE; children: ReactNode; title?: string }) {
  return <span title={title} className={`chip ${TONE[tone]}`}>{children}</span>;
}
const PROV: Record<string, { en: string; ja: string; cls: string }> = {
  ILLUSTRATIVE: { en: "ILLUSTRATIVE", ja: "説明用", cls: "bg-stage text-ink-3 ring-1 ring-line" },
  SIMULATED: { en: "SIMULATED", ja: "シミュレーション", cls: "bg-amber text-white" },
  ESTIMATE: { en: "ESTIMATE", ja: "概算", cls: "bg-paper text-ink-2 ring-1 ring-line-strong" },
  LIVE: { en: "LIVE", ja: "LIVE", cls: "bg-hinomaru text-white" },
  CACHED: { en: "CACHED", ja: "CACHED", cls: "bg-ink text-white" },
};
export function Prov({ kind }: { kind: keyof typeof PROV }) {
  const { p } = useL();
  const v = PROV[kind];
  return <span className={`rounded px-1.5 py-[1px] text-[9.5px] font-bold tracking-wider ${v.cls}`}>{p(v.en, v.ja)}</span>;
}

const STATUS_STYLE: Record<LineStatus | "INCOMPLETE", { en: string; ja: string; cls: string }> = {
  CONFIRMED: { en: "Confirmed", ja: "確定", cls: "text-verified" },
  QUOTED: { en: "Quoted", ja: "見積", cls: "text-[#1E3A5F]" },
  ESTIMATE: { en: "Estimate", ja: "概算", cls: "text-ink-3" },
  NEEDS_PROFESSIONAL: { en: "Broker to confirm", ja: "要専門家確認", cls: "text-amber" },
  UNKNOWN: { en: "Unknown", ja: "不明", cls: "text-hinomaru-deep" },
  INCOMPLETE: { en: "Incomplete", ja: "不完全", cls: "text-hinomaru-deep" },
};
export function LineStatusTag({ s }: { s: LineStatus | "INCOMPLETE" }) {
  const { p } = useL();
  return <span className={`text-[10.5px] font-semibold ${STATUS_STYLE[s].cls}`}>{p(STATUS_STYLE[s].en, STATUS_STYLE[s].ja)}</span>;
}

// ----- glossary --------------------------------------------------------------------------------------------------
export function Gloss({ k, children }: { k: keyof typeof GLOSSARY; children?: ReactNode }) {
  const { p } = useL();
  const g = GLOSSARY[k];
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen((x) => !x)} onBlur={() => setOpen(false)} className="inline-flex items-center gap-0.5 border-b border-dotted border-ink-3 text-inherit">
        {children ?? p(g.t[0], g.t[1])}
        <HelpCircle size={11} className="text-muted" />
      </button>
      {open && (
        <span role="tooltip" className="absolute left-0 top-full z-50 mt-1.5 w-[260px] rounded-lg bg-ink p-3 text-left text-[12px] font-normal leading-relaxed text-white shadow-lift">
          <b className="mb-1 block text-[11px] uppercase tracking-wider text-white/60">{p(g.t[0], g.t[1])}</b>
          {p(g.d[0], g.d[1])}
        </span>
      )}
    </span>
  );
}

// ----- supplier badge ---------------------------------------------------------------------------------------------
export function SupplierBadge({ supplier, detailed = false }: { supplier: Supplier; detailed?: boolean }) {
  const { p, ja } = useL();
  const s = useTrade();
  const b = badgeFor(supplier, nowOf(s));
  const [open, setOpen] = useState(false);
  const style = !b.eligible ? "bg-hinomaru-soft text-hinomaru-deep ring-hinomaru/30" : b.level >= 2 ? "bg-verified-soft text-verified ring-verified/25" : b.level === 1 ? "bg-[#EAF0F8] text-[#1E3A5F] ring-[#1E3A5F]/20" : "bg-stage text-ink-3 ring-line";
  const Icon = !b.eligible ? ShieldAlert : b.level >= 2 ? BadgeCheck : b.level === 1 ? CheckCircle2 : CircleDashed;
  return (
    <div className="relative inline-block" onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen((x) => !x)} onMouseEnter={() => detailed || setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ${style}`}>
        <Icon size={13} />
        {b.eligible ? `L${b.level} · ${p(b.label_en, b.label_ja)}` : p("Not eligible", "対象外")}
        {b.mode === "ILLUSTRATIVE" && <span className="font-normal opacity-70">· {p("illustrative", "説明用")}</span>}
      </button>
      {(open || detailed) && (
        <div className={`${detailed ? "mt-3" : "absolute left-0 top-full z-40 mt-2 w-[330px] shadow-lift"} rounded-xl border border-line bg-paper p-3.5 text-left`}>
          <div className="flex items-center justify-between">
            <div className="label">{p("What this badge means", "このバッジの意味")}</div>
            {b.verified_at && <div className="text-[10.5px] text-muted">{p("checked", "確認日")} {b.verified_at} · {p("expires", "有効期限")} {b.expires_at}</div>}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
            {p("L1 registry-checked · L2 verified (no critical/high findings, filings current, GST confirmed) · L3 audited on site. Expires 180 days after the investigation.",
              "L1 登記確認・L2 検証済（重大/高リスクなし、申告が最新、GST確認済）・L3 現地監査済。調査から180日で失効します。")}
          </p>
          {supplier.investigation ? (
            <ul className="mt-2.5 space-y-1.5">
              {supplier.investigation.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-[12px]">
                  <CheckIcon s={c.status} />
                  <span className="w-[132px] shrink-0 font-medium text-ink">{p(CHECK[c.id][0], CHECK[c.id][1])}</span>
                  <span className="text-ink-3">{ja ? c.note_ja : c.note_en}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-lg bg-stage p-2.5 text-[12px] text-ink-3">{p("No investigation yet. Unknown is shown as unknown, never as clean.", "調査未実施。不明は不明のまま表示し、問題なしとは扱いません。")}</p>
          )}
          {(b.reasons_en.length > 0) && <div className="mt-2.5 rounded-lg bg-wash p-2 text-[11.5px] text-ink-2">{(ja ? b.reasons_ja : b.reasons_en).join(" · ")}</div>}
          <div className="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-muted"><Prov kind="ILLUSTRATIVE" /> {p("Fictional company for the demo. Real companies are run live in Verify.", "デモ用の架空企業。実在企業はVerifyでライブ調査できます。")}</div>
        </div>
      )}
    </div>
  );
}
export function CheckIcon({ s }: { s: string }) {
  if (s === "pass") return <CheckCircle2 size={14} className="mt-[1px] shrink-0 text-verified" />;
  if (s === "fail") return <XCircle size={14} className="mt-[1px] shrink-0 text-hinomaru" />;
  if (s === "warn") return <AlertTriangle size={14} className="mt-[1px] shrink-0 text-amber" />;
  return <CircleDashed size={14} className="mt-[1px] shrink-0 text-muted" />;
}

// ----- status header: the seven questions every screen answers ------------------------------------------------------
export interface StatusParts {
  happening: ReactNode;
  action?: ReactNode;
  missing?: ReactNode;
  commitment: ReactNode;
  risk: ReactNode;
  next: ReactNode;
  evidence?: ReactNode;
  tone?: "blue" | "green" | "amber" | "red" | "muted";
}
export function StatusHeader(sp: StatusParts) {
  const { p } = useL();
  const bar = { blue: "bg-[#1E3A5F]", green: "bg-verified", amber: "bg-amber", red: "bg-hinomaru", muted: "bg-line-strong" }[sp.tone ?? "blue"];
  const cell = (label: string, body: ReactNode) => body ? (
    <div className="min-w-0">
      <div className="label mb-0.5">{label}</div>
      <div className="text-[12.5px] leading-snug text-ink">{body}</div>
    </div>
  ) : null;
  return (
    <div className="panel relative overflow-hidden">
      <div className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <div className="grid gap-4 p-4 pl-5 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="min-w-0">
          <div className="label mb-0.5">{p("What is happening", "現在の状況")}</div>
          <div className="text-[15px] font-semibold leading-snug text-ink">{sp.happening}</div>
          {sp.action && <div className="mt-3">{sp.action}</div>}
        </div>
        <div className="space-y-3">
          {cell(p("Your financial commitment", "財務上の約束"), sp.commitment)}
          {cell(p("Who acts next", "次の担当"), sp.next)}
        </div>
        <div className="space-y-3">
          {cell(p("What could go wrong", "想定されるリスク"), sp.risk)}
          {cell(p("What is missing", "不足している情報"), sp.missing)}
          {cell(p("Evidence", "根拠"), sp.evidence)}
        </div>
      </div>
    </div>
  );
}

// ----- countdown ------------------------------------------------------------------------------------------------
export function useNowTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}
export function Countdown({ to, wall = false }: { to: number; wall?: boolean }) {
  const s = useTrade();
  useNowTick();
  const { p } = useL();
  const left = to - (wall ? Date.now() : nowOf(s));
  if (left <= 0) return <span className="font-mono text-hinomaru-deep">{p("expired", "期限切れ")}</span>;
  const d = Math.floor(left / DAY), h = Math.floor((left % DAY) / 3_600_000), mi = Math.floor((left % 3_600_000) / 60_000), se = Math.floor((left % 60_000) / 1000);
  return <span className="font-mono tabular-nums">{d > 0 ? `${d}d ${h}h ${mi}m` : h > 0 ? `${h}h ${mi}m ${String(se).padStart(2, "0")}s` : `${mi}m ${String(se).padStart(2, "0")}s`}</span>;
}
export function fmtDate(ms: number, lang: "en" | "ja") {
  return new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-GB", { year: "numeric", month: lang === "ja" ? "2-digit" : "short", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo", timeZoneName: "short" }).format(ms);
}

// ----- landed cost comparison -------------------------------------------------------------------------------------
const CATS: { k: Category; en: string; ja: string }[] = [
  { k: "goods", en: "Goods", ja: "商品代金" }, { k: "freight", en: "Freight, insurance, port", ja: "運賃・保険・港湾" },
  { k: "fees", en: "Fees (broker, delivery, bank)", ja: "手数料（通関・配送・銀行）" }, { k: "duty", en: "Import duty", ja: "関税" },
];
export function LandedCompare({ independent, pooled, shared, qty, unitLabel }: { independent: LandedCost; pooled: LandedCost; shared: LandedCost | null; qty: number; unitLabel: string }) {
  const { p, money } = useL();
  const [open, setOpen] = useState<string | null>(null);
  const cols = [
    { key: "independent", title: p("Buying alone", "単独購入"), lc: independent },
    { key: "pooled", title: p("Pooled · own freight", "共同発注・個別輸送"), lc: pooled },
    ...(shared ? [{ key: "shared", title: p("Pooled · shared LCL", "共同発注・混載輸送"), lc: shared }] : []),
  ];
  const best = shared && shared.totalExTax ? shared : pooled;
  const sv = independent.purchasable ? savings(independent, best) : null;
  const goodsSaving = sv?.goods;
  const complete = independent.totalExTax && best.totalExTax;
  const total = complete ? independent.totalExTax!.minor - best.totalExTax!.minor : null;
  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line bg-wash px-4 py-3">
        <div>
          <div className="label">{p("Landed cost to your plant — your order only", "工場着コスト（自社分のみ）")}</div>
          <div className="text-[13px] text-ink-2">{qty.toLocaleString()} {unitLabel} · {p("baseline: the same quantity bought alone at your own tier", "比較基準：同数量を単独で購入した場合")}</div>
        </div>
        <div className="text-right">
          {!independent.purchasable ? (
            <div className="text-[13px] font-semibold text-[#1E3A5F]">{p("Alone: not purchasable (below MOQ). Pooling makes this order possible.", "単独ではMOQ未満で購入不可。共同発注で購入可能になります。")}</div>
          ) : total !== null ? (
            <div><span className="label">{p("Modelled net saving (ex. consumption tax)", "試算上の純削減額（消費税除く）")}</span><div className={`num text-[30px] leading-none ${total > 0 ? "text-verified" : "text-ink"}`}>{money({ minor: total, ccy: "JPY" })}</div></div>
          ) : goodsSaving ? (
            <div><span className="label">{p("Goods saving — other costs incomplete", "商品代金の削減額（他費用は不完全）")}</span><div className="num text-[26px] leading-none text-ink">{money(goodsSaving)}</div></div>
          ) : null}
          <div className="mt-1 flex justify-end gap-1"><Prov kind="ESTIMATE" /><Prov kind="SIMULATED" /></div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[12.5px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="px-4 py-2.5 font-medium">{p("Category", "区分")}</th>
              {cols.map((c) => <th key={c.key} className="px-4 py-2.5 text-right font-medium">{c.title}</th>)}
              {sv && <th className="px-4 py-2.5 text-right font-medium">{p("Saving", "削減")}</th>}
            </tr>
          </thead>
          <tbody>
            {CATS.map((cat) => (
              <tr key={cat.k} className="cursor-pointer border-t border-line hover:bg-wash" onClick={() => setOpen(open === cat.k ? null : cat.k)}>
                <td className="px-4 py-2.5 font-medium text-ink">{p(cat.en, cat.ja)} <span className="text-muted">{open === cat.k ? "▾" : "▸"}</span>
                  {open === cat.k && (
                    <div className="mt-2 space-y-1.5 font-normal">
                      {best.lines.filter((l) => l.category === cat.k).map((l) => (
                        <div key={l.key} className="text-[11.5px] text-ink-3"><span className="text-ink-2">{p(l.label_en, l.label_ja)}</span> — {p(l.basis_en, l.basis_ja)} · <LineStatusTag s={l.status} /></div>
                      ))}
                    </div>
                  )}
                </td>
                {cols.map((c) => (
                  <td key={c.key} className="px-4 py-2.5 text-right align-top tabular-nums">
                    {c.lc.purchasable ? (c.lc.byCategory[cat.k] ? money(c.lc.byCategory[cat.k]) : <LineStatusTag s="UNKNOWN" />) : <span className="text-muted">—</span>}
                  </td>
                ))}
                {sv && <td className="px-4 py-2.5 text-right align-top tabular-nums">{sv[cat.k] ? <span className={sv[cat.k]!.minor > 0 ? "font-semibold text-verified" : "text-ink-3"}>{money(sv[cat.k])}</span> : <LineStatusTag s="UNKNOWN" />}</td>}
              </tr>
            ))}
            <tr className="border-t-2 border-ink/80 font-semibold">
              <td className="px-4 py-2.5">{p("Landed cost (ex. consumption tax)", "工場着コスト（消費税除く）")}</td>
              {cols.map((c) => <td key={c.key} className="px-4 py-2.5 text-right tabular-nums">{c.lc.purchasable ? (c.lc.totalExTax ? money(c.lc.totalExTax) : <LineStatusTag s="INCOMPLETE" />) : <span className="text-[11px] font-medium text-muted">{p("MOQ not met", "MOQ未達")}</span>}</td>)}
              {sv && <td />}
            </tr>
            <tr className="border-t border-line text-ink-3">
              <td className="px-4 py-2"><Gloss k="ctax">{p("Import consumption tax (excluded)", "輸入消費税（除外）")}</Gloss></td>
              {cols.map((c) => <td key={c.key} className="px-4 py-2 text-right tabular-nums">{c.lc.byCategory.tax ? money(c.lc.byCategory.tax) : "—"}</td>)}
              {sv && <td />}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex items-start gap-2 border-t border-line bg-wash px-4 py-2.5 text-[11px] leading-relaxed text-ink-3">
        <Info size={13} className="mt-[1px] shrink-0" />
        {p("Modelled from the inputs shown: illustrative supplier tiers, an illustrative forwarder quote and a SIMULATED FX rate. Duty uses an entered rate that a licensed customs broker must confirm. Pooling never changes duty or tax rates. Not money saved.",
          "表示された入力（例示の単価帯・フォワーダー見積・模擬為替）による試算です。関税率は入力値で、通関業者の確認が必要です。共同発注で税率は変わりません。実際の削減額ではありません。")}
      </div>
    </div>
  );
}

// ----- shell -----------------------------------------------------------------------------------------------------
function Toaster() {
  const ts = useToasts();
  const { p } = useL();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[340px] flex-col gap-2">
      {ts.map((t) => (
        <div key={t.id} className={`pointer-events-auto animate-[fadeIn_.2s_ease-out] rounded-xl px-4 py-3 text-[12.5px] shadow-lift ring-1 ${t.tone === "err" ? "bg-hinomaru-soft text-hinomaru-deep ring-hinomaru/30" : t.tone === "warn" ? "bg-amber-soft text-[#8a4b05] ring-amber/30" : "bg-ink text-white ring-ink"}`}>
          {p(t.text_en, t.text_ja)}
        </div>
      ))}
    </div>
  );
}

export function PersonaSwitch() {
  const s = useTrade();
  const { p } = useL();
  return (
    <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-white/10 p-0.5 [scrollbar-width:none]" role="group" aria-label="Demo persona">
      {SWITCHABLE.map((id) => {
        const per = PERSONAS[id];
        const active = s.persona === id;
        const roleLabel = per.role === "buyer" ? p("Buyer", "買い手") : per.role === "supplier" ? p("Supplier", "サプライヤー") : p("Ops", "運営");
        return (
          <button key={id} onClick={() => actions.setPersona(id as PersonaId)} aria-pressed={active}
            className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11.5px] font-medium transition ${active ? "bg-white text-ink shadow-card" : "text-white/75 hover:bg-white/10"}`}>
            <span className="opacity-60">{roleLabel}</span> {p(per.name, per.name_ja).replace(/ (K\.K\.|Co\., Ltd\.|Pvt Ltd|Works)$/, "")}
          </button>
        );
      })}
    </div>
  );
}

const TABS = [
  { to: "/trade", en: "Overview", ja: "概要", end: true }, { to: "/source", en: "Find suppliers", ja: "サプライヤー検索" }, { to: "/pools", en: "Pools", ja: "共同発注" },
  { to: "/orders", en: "Orders", ja: "発注" }, { to: "/s", en: "Supplier console", ja: "サプライヤー画面" }, { to: "/ops", en: "Ops & audit log", ja: "運営・監査ログ" },
];
export function TradeShell({ children, wide = true }: { children: ReactNode; wide?: boolean }) {
  const s = useTrade();
  const { p, lang } = useL();
  useNowTick(30_000);
  return (
    <Shell wide={wide}>
      <div className="no-print sticky top-14 z-20 bg-ink text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2 sm:px-6 [&>*]:min-w-0">
          <nav className="flex max-w-full items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `whitespace-nowrap rounded-md px-2.5 py-1 text-[12.5px] font-medium transition ${isActive ? "bg-hinomaru text-white" : "text-white/75 hover:bg-white/10"}`}>
                {p(t.en, t.ja)}
              </NavLink>
            ))}
          </nav>
          <div className="flex max-w-full flex-wrap items-center gap-2 sm:ml-auto">
            <PersonaSwitch />
            <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-[11px] text-white/80" title={p("Demo clock — advance it to pass pool deadlines", "デモ時計（締切を進められます）")}>
              <Clock size={12} /> {fmtDate(nowOf(s), lang)}
              <button onClick={() => actions.advance(DAY)} className="ml-1 inline-flex items-center gap-0.5 rounded bg-white/15 px-1.5 py-0.5 hover:bg-white/25"><FastForward size={11} />1d</button>
            </div>
          </div>
        </div>
        <div className="bg-amber/95 px-4 py-1 text-center text-[11px] font-medium text-white">
          {p("Prototype · runs entirely in your browser · fictional companies, illustrative prices, SIMULATED payments — no real orders or money", "プロトタイプ・ブラウザ内で動作・架空の企業・例示価格・模擬決済（実際の注文・送金はありません）")}
        </div>
      </div>
      {children}
      <Toaster />
    </Shell>
  );
}

export function SectionTitle({ kicker, title, right }: { kicker?: string; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        {kicker && <div className="label uppercase tracking-[0.14em]">{kicker}</div>}
        <h2 className="text-[19px] font-semibold tracking-tight text-ink">{title}</h2>
      </div>
      {right}
    </div>
  );
}
