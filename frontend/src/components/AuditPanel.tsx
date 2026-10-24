import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Loader2, MapPin, Plus, ShieldCheck, Star, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { api, dataUrl, type AuditT } from "../lib/api";

const STATUS = {
  pass: { ja: "合格", en: "Pass", cls: "bg-verified-soft text-verified" },
  fail: { ja: "不合格", en: "Fail", cls: "bg-hinomaru-soft text-hinomaru" },
  unverified: { ja: "未検証", en: "Unverified", cls: "bg-amber-soft text-amber" },
  pending: { ja: "未実施", en: "Pending", cls: "bg-stage text-ink-2" },
} as const;

function Wizard({ invId, onClose, onCreated }: { invId: number; onClose: () => void; onCreated: () => void }) {
  const { lang } = useI18n();
  const ja = lang === "ja";
  const [plan, setPlan] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [type, setType] = useState("production_capability");
  const [custom, setCustom] = useState<{ en: string; ja: string }[]>([]);
  const [draft, setDraft] = useState("");
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const [start, setStart] = useState(iso(new Date(today.getTime() + 3 * 864e5)));
  const [end, setEnd] = useState(iso(new Date(today.getTime() + 5 * 864e5)));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.auditPlan(invId).then(setPlan);
  }, [invId]);
  const create = async () => {
    setBusy(true);
    try {
      await api.createAudit(invId, { audit_type: type, start, end, custom_items: custom });
      onCreated();
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const auditor = plan?.auditors?.[type];
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-[760px] rounded-2xl bg-paper shadow-lift">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <div className="jp text-[17px] font-bold">{ja ? "現地監査を依頼" : "Request an on-site audit"}</div>
            <div className="text-[12px] text-muted">{[ja ? "監査の種類" : "Audit type", ja ? "チェックリスト" : "Checklist", ja ? "日程と監査人" : "Schedule & auditor"].map((s, i) => <span key={s} className={i === step ? "font-semibold text-ink" : ""}>{i ? " · " : ""}{s}</span>)}</div>
          </div>
          <button className="btn-ghost !p-1.5" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="max-h-[62vh] overflow-y-auto p-6 scrollbar-thin">
          {!plan && <Loader2 className="animate-spin" />}
          {plan && step === 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(plan.types).map(([k, v]: [string, any]) => (
                <button key={k} onClick={() => setType(k)} className={`rounded-xl border p-4 text-left ${type === k ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong"}`}>
                  <div className="jp text-[14px] font-semibold">{ja ? v.ja : v.en}</div>
                  <div className="num mt-2 text-[28px] leading-none">¥{v.price_jpy.toLocaleString()}</div>
                  <div className="text-[11px] text-muted">{v.days} {ja ? "日" : v.days > 1 ? "days" : "day"} · {ja ? "税別" : "excl. tax"}</div>
                  <p className="jp mt-2 text-[12px] leading-snug text-ink-3">{ja ? v.covers_ja : v.covers_en}</p>
                </button>
              ))}
            </div>
          )}
          {plan && step === 1 && (
            <div>
              <p className="jp text-[12.5px] text-ink-3">{ja ? "この調査の指摘と確認できなかった主張から自動生成しました。" : "Generated from this investigation's flags and unverifiable claims."}</p>
              <ol className="mt-3 space-y-2">
                {[...plan.checklist, ...custom.map((c) => ({ ...c, source: "custom", text_en: c.en, text_ja: c.ja }))].map((it: any, i: number) => (
                  <li key={i} className="flex gap-3 rounded-lg border border-line p-3">
                    <span className="num text-[18px] leading-none text-hinomaru">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <div className="jp text-[13px]">{it.text_ja}</div>
                      <div className="text-[12px] text-muted">{it.text_en}</div>
                      <div className="mt-1 font-mono text-[10px] text-ink-3">{it.source}{it.claim ? ` · “${it.claim}”` : ""}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex gap-2">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={ja ? "追加の確認項目" : "Add a custom item"} className="flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
                <button className="btn-ghost" disabled={!draft.trim()} onClick={() => { setCustom([...custom, { en: draft.trim(), ja: draft.trim() }]); setDraft(""); }}><Plus size={14} /></button>
              </div>
            </div>
          )}
          {plan && step === 2 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="block"><span className="label flex items-center gap-1"><CalendarDays size={12} /> {ja ? "開始日" : "From"}</span><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" /></label>
                <label className="block"><span className="label">{ja ? "終了日" : "To"}</span><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" /></label>
                <p className="text-[11.5px] text-muted">{ja ? "写真の撮影時刻がこの期間外の場合、時刻未検証となります。" : "Photos taken outside this window are marked “time not verified”."}</p>
              </div>
              {auditor && (
                <div className="rounded-xl border border-line p-4">
                  <div className="label">{ja ? "推奨監査人（最寄り・有資格）" : "Suggested auditor (nearest qualified)"}</div>
                  <div className="mt-1 text-[15px] font-semibold">{auditor.name}</div>
                  <div className="flex items-center gap-1 text-[12px] text-ink-3"><MapPin size={12} /> {auditor.city} · {auditor.distance_km} km</div>
                  <div className="mt-1 flex items-center gap-1 text-[12px]"><Star size={12} className="fill-amber text-amber" /> {auditor.rating} · {auditor.audits} {ja ? "件の実績" : "audits"}</div>
                  <div className="mt-2 flex flex-wrap gap-1">{auditor.languages.map((l: string) => <span key={l} className="chip bg-stage text-ink-2">{l}</span>)}</div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-between border-t border-line px-6 py-4">
          <button className="btn-ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>{ja ? "戻る" : "Back"}</button>
          {step < 2 ? <button className="btn-ink" onClick={() => setStep((s) => s + 1)}>{ja ? "次へ" : "Next"}</button>
            : <button className="btn-red" disabled={busy} onClick={create}>{busy && <Loader2 size={14} className="animate-spin" />} {ja ? "監査を依頼" : "Order the audit"}</button>}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AuditPanel({ invId, audit, onUpdated, onEvidence, isDemo }: { invId: number; audit: AuditT | null; onUpdated: () => void; onEvidence: (ev: string) => void; isDemo: boolean }) {
  const { lang } = useI18n();
  const ja = lang === "ja";
  const [wizard, setWizard] = useState(false);
  const [busy, setBusy] = useState(false);

  const complete = async () => {
    if (!audit) return;
    setBusy(true);
    try {
      await api.completeAudit(audit.id);
      onUpdated();
    } finally {
      setBusy(false);
    }
  };
  const demo = async () => {
    setBusy(true);
    try {
      await api.demoAudit(invId);
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  if (!audit) {
    return (
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <p className={`max-w-[42rem] text-[13px] leading-relaxed text-ink-3 ${ja ? "jp" : ""}`}>
          {ja ? "デジタル調査で足りない場合は、現地の監査人が指摘ごとの確認項目を写真で検証します。写真はGPSと撮影時刻を照合し、SHA-256で改ざん検知可能な証拠として保存します。"
            : "When the digital check is not enough, a local auditor verifies each finding with photos. Every photo is checked against the pin's GPS and the audit window, then stored as tamper-evident evidence (SHA-256)."}
        </p>
        <div className="flex gap-2">
          {isDemo && <button className="btn-ghost" disabled={busy} onClick={demo}>{busy && <Loader2 size={14} className="animate-spin" />} {ja ? "デモ監査を読み込む" : "Load demo audit"}</button>}
          <button className="btn-red" onClick={() => setWizard(true)}>{ja ? "現地監査を依頼" : "Request on-site audit"}</button>
        </div>
        <AnimatePresence>{wizard && <Wizard invId={invId} onClose={() => setWizard(false)} onCreated={onUpdated} />}</AnimatePresence>
      </div>
    );
  }

  const done = audit.status === "completed";
  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-5 p-5">
        <div className={`grid h-12 w-12 place-items-center rounded-full ${done ? "bg-verified text-white" : "bg-stage text-ink"}`}><ShieldCheck size={22} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="jp text-[15px] font-semibold">{ja ? audit.pricing?.ja : audit.pricing?.en}</span>
            {done ? <span className="chip bg-verified text-white">{ja ? "監査済み" : "Audited"}</span> : <span className="chip bg-stage text-ink-2">{audit.status}</span>}
            {audit.is_demo && <span className="chip bg-hinomaru text-white">DEMO DATA</span>}
          </div>
          <div className="mt-0.5 text-[12px] text-muted">
            {audit.auditor?.name} · {audit.auditor?.city} · ¥{audit.price_jpy.toLocaleString()} · {audit.window_start?.slice(0, 10)} → {audit.window_end?.slice(0, 10)}
          </div>
        </div>
        <Link to={`/audit/${audit.id}/field`} className="btn-ghost text-xs">{ja ? "監査人の現場画面" : "Auditor field view"}</Link>
        {!done && <button className="btn-ink text-xs" disabled={busy} onClick={complete}>{busy && <Loader2 size={13} className="animate-spin" />} {ja ? "監査を完了して再評価" : "Complete and re-score"}</button>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {audit.items.map((it) => {
          const s = STATUS[it.status];
          return (
            <div key={it.id} className="rounded-xl border border-line bg-paper p-4 avoid-break">
              <div className="flex items-start gap-3">
                {it.status === "pass" ? <CheckCircle2 className="mt-0.5 shrink-0 text-verified" size={18} /> : it.status === "fail" ? <XCircle className="mt-0.5 shrink-0 text-hinomaru" size={18} /> : <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-line-strong" />}
                <div className="min-w-0 flex-1">
                  <div className={`text-[13px] leading-snug ${ja ? "jp" : ""}`}>{ja ? it.text_ja : it.text_en}</div>
                  {it.note && <div className="mt-1 text-[12px] text-ink-3">{it.note}</div>}
                  <div className="mt-1 flex items-center gap-2"><span className={`chip ${s.cls}`}>{ja ? s.ja : s.en}</span><span className="font-mono text-[10px] text-muted">{it.source}</span></div>
                </div>
              </div>
              {it.photos.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {it.photos.map((p) => (
                    <button key={p.id} onClick={() => onEvidence(p.ev_id)} className="group relative overflow-hidden rounded-lg border border-line text-left">
                      <img src={dataUrl(p.path)} alt="" className="aspect-[4/3] w-full object-cover" />
                      <div className={`absolute inset-x-0 bottom-0 px-1.5 py-1 text-[9.5px] font-semibold text-white ${p.location_verified && p.time_verified ? "bg-verified/90" : "bg-hinomaru/90"}`}>
                        {p.location_verified ? `GPS ✓ ${Math.round(p.distance_m ?? 0)} m` : ja ? "位置未検証" : "location not verified"}
                        {!p.time_verified && ` · ${ja ? "時刻✗" : "time ✗"}`}
                      </div>
                      <span className="absolute right-1 top-1 rounded bg-ink/70 px-1 font-mono text-[9px] text-white">{p.ev_id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
