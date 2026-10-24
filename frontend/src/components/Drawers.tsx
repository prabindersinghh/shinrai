import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { api, dataUrl, type EvidenceT } from "../lib/api";
import type { VizNode } from "../lib/stream";
import { ADAPTER_LABEL, communityColor, MODE, riskIsRed } from "../lib/visual";
import { EvidenceChips } from "./FindingCards";

export function Drawer({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-ink/10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside role="dialog" aria-modal
            className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-line bg-paper shadow-lift ${wide ? "max-w-[640px]" : "max-w-[460px]"}`}
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 340, damping: 34 }}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div className="min-w-0 text-sm font-semibold">{title}</div>
              <button className="btn-ghost !p-1.5" onClick={onClose} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-line py-1.5 text-[12.5px] last:border-0">
      <div className="text-muted">{k}</div>
      <div className="min-w-0 break-words text-ink">{v}</div>
    </div>
  );
}

export function EvidenceDrawer({ invId, evId, onClose }: { invId: number; evId: string | null; onClose: () => void }) {
  const { lang } = useI18n();
  const [ev, setEv] = useState<EvidenceT | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!evId) return;
    setEv(null);
    setErr(null);
    api.evidence(invId, evId).then(setEv).catch((e) => setErr(e.message));
  }, [invId, evId]);
  const payload = ev?.payload;
  const images: string[] = [];
  if (payload?.path && /\.(png|jpe?g)$/i.test(payload.path)) images.push(payload.path);
  for (const r of payload?.records ?? []) if (typeof r?.path === "string" && /\.(png|jpe?g)$/i.test(r.path)) images.push(r.path);
  const mode = MODE[ev?.mode ?? "none"] ?? MODE.none;

  return (
    <Drawer open={!!evId} onClose={onClose} wide
      title={<span className="flex items-center gap-2"><span className="font-mono">{evId}</span><span className="text-muted">{lang === "ja" ? "証拠記録" : "Evidence record"}</span></span>}>
      {err && <p className="text-sm text-hinomaru">{err}</p>}
      {!ev && !err && <p className="text-sm text-muted">{lang === "ja" ? "読み込み中…" : "Loading…"}</p>}
      {ev && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] text-white">{ADAPTER_LABEL[ev.adapter] ?? ev.adapter}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${mode.cls}`}>{mode.label}</span>
            <span className="text-sm font-semibold">{ev.source_name}</span>
          </div>
          <Row k={lang === "ja" ? "要約" : "Summary"} v={ev.summary} />
          <Row k={lang === "ja" ? "照会内容" : "Query"} v={<code className="font-mono text-[11px]">{JSON.stringify(ev.query)}</code>} />
          <Row k={lang === "ja" ? "取得日時" : "Retrieved"} v={new Date(ev.retrieved_at).toLocaleString()} />
          {ev.url && <Row k="URL" v={<a className="inline-flex items-center gap-1 text-ink underline decoration-line-strong underline-offset-2 hover:text-hinomaru" href={ev.url} target="_blank" rel="noreferrer">{ev.url.replace(/^https?:\/\//, "").slice(0, 60)} <ExternalLink size={12} /></a>} />}
          <Row k="SHA-256" v={<code className="font-mono text-[10.5px] text-ink-3">{ev.sha256}</code>} />
          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {images.slice(0, 6).map((p) => (
                <img key={p} src={dataUrl(p)} alt={p} className="aspect-square w-full rounded-lg border border-line object-cover" />
              ))}
            </div>
          )}
          <div className="label mt-5">{lang === "ja" ? "生データ（取得時のまま保存）" : "Raw payload (stored as retrieved)"}</div>
          <pre className="mt-1.5 max-h-[52vh] overflow-auto rounded-lg border border-line bg-wash p-3 font-mono text-[10.5px] leading-relaxed text-ink-2 scrollbar-thin">
            {JSON.stringify(payload, (k, v) => (k === "footprint" ? `[${(v as unknown[]).length} points]` : k === "text" && typeof v === "string" && v.length > 1200 ? v.slice(0, 1200) + "…" : v), 2)}
          </pre>
        </div>
      )}
    </Drawer>
  );
}

const ATTR_LABEL: Record<string, string> = {
  status: "Status", incorporated: "Incorporated", state: "State", roc: "RoC", company_class: "Class",
  paid_up_capital: "Paid-up capital", authorized_capital: "Authorised capital", din: "DIN", designation: "Designation",
  appointed_on: "Appointed", address: "Address", role: "Role", court: "Court", nature: "Nature", filed: "Filed",
  next_hearing: "Next hearing", authority: "Authority", announced: "Announced", title: "Title", source: "Source",
  date: "Date", tone: "Tone", tone_reason: "Tone reason", field: "Field", value: "Value", verdict: "Verdict",
  lat: "Latitude", lon: "Longitude", precision: "Precision", provider: "Geocoder", registration_date: "Registered",
  cancellation_date: "Cancelled",
};

export function NodeDrawer({ node, onClose, onEvidence }: { node: VizNode | null; onClose: () => void; onEvidence: (ev: string) => void }) {
  const { lang } = useI18n();
  return (
    <Drawer open={!!node} onClose={onClose} title={node?.label ?? ""}>
      {node && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="chip bg-stage text-ink-2 ring-1 ring-line">{node.type}</span>
            <span className="chip text-white" style={{ background: riskIsRed(node.risk) ? "#E3122B" : communityColor(node.community) }}>
              {riskIsRed(node.risk) ? (lang === "ja" ? "リスク" : "risk") : `${lang === "ja" ? "グループ" : "group"} ${(node.community ?? 0) + 1}`}
            </span>
            {node.attrs?.approximate && <span className="chip bg-amber-soft text-amber">{lang === "ja" ? "概略位置" : "approximate location"}</span>}
          </div>
          {node.key && <Row k="Key" v={<code className="font-mono text-[11px]">{node.key}</code>} />}
          {Object.entries(node.attrs ?? {})
            .filter(([k, v]) => ATTR_LABEL[k] && v !== null && v !== "")
            .map(([k, v]) => (
              <Row key={k} k={ATTR_LABEL[k]} v={k === "url" ? <a href={String(v)}>{String(v)}</a> : typeof v === "number" ? v.toLocaleString("en-IN") : String(v)} />
            ))}
          {node.attrs?.url && <Row k="Link" v={<a className="underline" href={node.attrs.url} target="_blank" rel="noreferrer">{String(node.attrs.url).slice(0, 60)}</a>} />}
          {node.attrs?.evidence?.length > 0 && (
            <>
              <div className="label mt-4">{lang === "ja" ? "証拠" : "Evidence"}</div>
              <EvidenceChips ids={node.attrs.evidence} onEvidence={onEvidence} />
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
