import { ArrowRight, FileText, Loader2, Play, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Shell, { rememberSme } from "../components/Shell";
import { useI18n } from "../i18n";
import { api, type Partner, type Sme } from "../lib/api";
import { BAND, MODE } from "../lib/visual";

export default function Partners() {
  const { smeId } = useParams();
  const id = Number(smeId);
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [sme, setSme] = useState<Sme | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [form, setForm] = useState({ name: "", cin: "", gstin: "" });
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState("auto");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ja = lang === "ja";

  const refresh = () => api.partners(id).then(setPartners);
  useEffect(() => {
    rememberSme(id);
    api.getSme(id).then(setSme).catch(() => setErr(ja ? "会社が見つかりません" : "Company not found"));
    refresh();
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const add = async () => {
    setErr(null);
    setBusy("add");
    try {
      const f = new FormData();
      f.append("sme_id", String(id));
      f.append("name", form.name);
      f.append("cin", form.cin);
      f.append("gstin", form.gstin);
      if (file) f.append("doc", file);
      await api.createPartner(f);
      setForm({ name: "", cin: "", gstin: "" });
      setFile(null);
      refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const investigate = async (p: Partner) => {
    setBusy(`p${p.id}`);
    try {
      const { id: inv } = await api.investigate(p.id, mode);
      nav(`/investigation/${inv}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Shell>
      <section className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="label">{sme ? (ja ? sme.name_ja || sme.name : sme.name) : "…"}</div>
            <h1 className="jp mt-1 text-[32px] font-bold tracking-tight">{t("partners.title")}</h1>
          </div>
          <Link to={`/compare/${id}`} className="btn-ghost">{t("nav.compare")} <ArrowRight size={14} /></Link>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[380px_1fr]">
          <div className="panel h-fit p-5">
            <h2 className="text-[15px] font-semibold">{t("partners.add")}</h2>
            <div className="mt-4 space-y-3">
              <label className="block"><span className="label">{t("partners.name")}</span>
                <input className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sunrise Auto Components Pvt Ltd" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="label">{t("partners.cin")}</span>
                  <input className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-mono text-[12px]" value={form.cin} onChange={(e) => setForm({ ...form, cin: e.target.value })} placeholder="L34103DL1981PLC011375" /></label>
                <label className="block"><span className="label">{t("partners.gstin")}</span>
                  <input className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-mono text-[12px]" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} placeholder="06AAACM0829Q1Z…" /></label>
              </div>
              <label className="block cursor-pointer rounded-lg border border-dashed border-line-strong p-3 hover:bg-wash">
                <span className="flex items-center gap-2 text-[13px] font-medium"><Upload size={15} /> {t("partners.doc")}</span>
                <span className="mt-1 block text-[11.5px] text-muted">{file ? file.name : t("partners.doc_hint")}</span>
                <input type="file" accept=".pdf,.txt,.md,.eml" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              {err && <p className="text-[12.5px] text-hinomaru">{err}</p>}
              <button className="btn-ink w-full" disabled={busy === "add" || !(form.name || form.cin || form.gstin)} onClick={add}>
                {busy === "add" && <Loader2 size={15} className="animate-spin" />} {t("partners.add")}
              </button>
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <span className="label">{ja ? "情報源モード" : "Source mode"}</span>
              <div className="mt-2 flex gap-1.5">
                {[["auto", ja ? "自動" : "Auto"], ["live", "LIVE"], ["seed", "SEED"]].map(([v, l]) => (
                  <button key={v} onClick={() => setMode(v)} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${mode === v ? "bg-ink text-white" : "bg-stage text-ink-2"}`}>{l}</button>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] leading-snug text-muted">{ja ? "自動：デモ企業はSEED、それ以外はLIVE→CACHED→SEEDの順で取得します。" : "Auto: demo companies use SEED; others try LIVE, then CACHED, then SEED."}</p>
            </div>
          </div>

          <div className="space-y-3">
            {partners.length === 0 && <div className="panel p-8 text-center text-[14px] text-ink-3">{t("partners.empty")}</div>}
            {partners.map((p) => {
              const l = p.latest;
              const band = BAND[l?.band ?? ""];
              return (
                <div key={p.id} className="panel flex items-center gap-5 p-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl" style={{ background: band?.soft ?? "#F6F7F9" }}>
                    <span className="num text-[26px] leading-none" style={{ color: band?.color ?? "#7A808C" }}>{l?.overall_score ?? "—"}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">{p.input_name || p.cin || p.gstin}</span>
                      {l?.is_demo && <span className="chip bg-hinomaru text-white">DEMO DATA</span>}
                      {l && <span className={`chip ${MODE[l.mode_used]?.cls}`}>{MODE[l.mode_used]?.label}</span>}
                      {band && <span className="jp chip" style={{ background: band.soft, color: band.color }}>{ja ? band.ja : band.en}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 font-mono text-[11px] text-muted">
                      {p.cin && <span>CIN {p.cin}</span>}{p.gstin && <span>GSTIN {p.gstin}</span>}
                      {p.doc_name && <span className="flex items-center gap-1 font-sans"><FileText size={12} /> {p.doc_name}</span>}
                      {l?.fit_score != null && <span className="font-sans">{ja ? "適合度" : "fit"} {l.fit_score}</span>}
                    </div>
                  </div>
                  {l?.status === "running" || l?.status === "queued" ? (
                    <Link to={`/investigation/${l.id}`} className="btn-ghost"><Loader2 size={14} className="animate-spin" /> {ja ? "調査中" : "Running"}</Link>
                  ) : (
                    <div className="flex gap-2">
                      {l?.status === "done" && <Link to={`/report/${l.id}`} className="btn-ghost">{t("partners.open")}</Link>}
                      <button className="btn-red" disabled={busy === `p${p.id}`} onClick={() => investigate(p)}>
                        {busy === `p${p.id}` ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} {t("partners.investigate")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </Shell>
  );
}
