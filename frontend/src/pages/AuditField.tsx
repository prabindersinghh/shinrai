import { Camera, CheckCircle2, Loader2, MapPin, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useI18n } from "../i18n";
import { api, dataUrl, type AuditT } from "../lib/api";

/** Mobile-first auditor view: work through the checklist, upload GPS-stamped photos, mark each item. */
export default function AuditField() {
  const { id } = useParams();
  const auditId = Number(id);
  const { lang } = useI18n();
  const ja = lang === "ja";
  const [a, setA] = useState<AuditT | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => api.audit(auditId).then(setA);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId]);

  const upload = async (itemId: number, file: File) => {
    setBusy(itemId);
    setErr(null);
    try {
      await api.uploadPhoto(auditId, itemId, file);
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };
  const mark = async (itemId: number, status: string) => {
    setBusy(itemId);
    try {
      await api.itemResult(auditId, itemId, status, "");
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!a) return <div className="grid h-screen place-items-center"><Loader2 className="animate-spin" /></div>;
  const locked = a.status === "completed";
  return (
    <div className="min-h-screen bg-stage">
      <header className="sticky top-0 z-10 bg-ink px-4 py-3 text-white">
        <div className="text-[11px] text-white/60">Genba Audit · #{a.id} {a.is_demo && (ja ? "· 説明用ケース" : "· Illustrative case")}</div>
        <div className="truncate text-[15px] font-semibold">{a.company?.name}</div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-white/70"><MapPin size={12} /> {a.pin?.lat?.toFixed(5)}, {a.pin?.lon?.toFixed(5)} · ±300 m</div>
      </header>
      <main className="mx-auto max-w-[560px] space-y-3 p-3">
        {locked && <div className="rounded-lg bg-verified-soft p-3 text-[13px] font-semibold text-verified">{ja ? "この監査は完了しています（変更不可）。" : "This audit is completed and locked."}</div>}
        {err && <div className="rounded-lg bg-hinomaru-soft p-3 text-[13px] text-hinomaru">{err}</div>}
        {a.items.map((it, i) => (
          <section key={it.id} className="rounded-xl bg-paper p-4 shadow-card">
            <div className="flex gap-3">
              <span className="num text-[22px] leading-none text-hinomaru">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <div className="jp text-[14px] leading-snug">{it.text_ja}</div>
                <div className="text-[12px] text-muted">{it.text_en}</div>
              </div>
            </div>
            {it.photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {it.photos.map((p) => (
                  <figure key={p.id} className="overflow-hidden rounded-lg border border-line">
                    <img src={dataUrl(p.path)} alt="" className="aspect-square w-full object-cover" />
                    <figcaption className={`px-1.5 py-1 text-[10px] font-semibold ${p.location_verified && p.time_verified ? "bg-verified-soft text-verified" : "bg-hinomaru-soft text-hinomaru"}`}>
                      {p.location_verified ? `GPS ✓ ${Math.round(p.distance_m ?? 0)} m` : ja ? "位置未検証" : "location not verified"}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            {!locked && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <label className="btn-ink cursor-pointer text-xs">
                  {busy === it.id ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} {ja ? "撮影" : "Photo"}
                  <input type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(it.id, e.target.files[0])} />
                </label>
                <button className={`btn text-xs ${it.status === "pass" ? "bg-verified text-white" : "border border-line"}`} onClick={() => mark(it.id, "pass")}><CheckCircle2 size={14} /> {ja ? "合格" : "Pass"}</button>
                <button className={`btn text-xs ${it.status === "fail" ? "bg-hinomaru text-white" : "border border-line"}`} onClick={() => mark(it.id, "fail")}><XCircle size={14} /> {ja ? "不合格" : "Fail"}</button>
              </div>
            )}
            {it.status === "unverified" && <p className="mt-2 text-[12px] text-amber">{it.note}</p>}
          </section>
        ))}
        <p className="px-2 pb-6 text-center text-[11px] text-muted">{ja ? "写真はGPSと撮影時刻を照合し、SHA-256で記録されます。" : "Photos are checked for GPS and time, and recorded with SHA-256."}</p>
      </main>
    </div>
  );
}
