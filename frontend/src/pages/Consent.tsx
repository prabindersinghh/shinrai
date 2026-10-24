import { motion } from "framer-motion";
import { Check, Loader2, Lock, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

/** Mock partner-side Account Aggregator consent screen. SIMULATED on every surface. */
export default function Consent() {
  const { token } = useParams();
  const [c, setC] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  useEffect(() => {
    api.consent(token!).then((x) => { setC(x); if (x.status !== "requested") setResult(x.status); });
  }, [token]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    try {
      const r = await api.decideConsent(token!, approve);
      setResult(r.status);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF1F5] px-4 py-8">
      <div className="mx-auto mb-4 max-w-[420px] rounded-lg border-2 border-dashed border-amber bg-amber-soft px-3 py-2 text-center text-[12px] font-bold text-amber">
        SIMULATED: sandbox data · not a real Account Aggregator
      </div>
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mx-auto max-w-[420px] overflow-hidden rounded-[28px] border border-line bg-paper shadow-lift">
        <div className="bg-[#1B3A6B] px-6 pb-5 pt-6 text-white">
          <div className="flex items-center gap-2 text-[12px] text-white/70"><Lock size={13} /> {c?.aa ?? "Sandbox AA"}</div>
          <div className="mt-2 text-[20px] font-semibold leading-snug">Consent request</div>
          <div className="text-[13px] text-white/80">{c?.company?.name ?? "…"}</div>
        </div>
        {!c ? (
          <div className="grid h-60 place-items-center"><Loader2 className="animate-spin text-muted" /></div>
        ) : (
          <div className="space-y-4 p-6 text-[13px]">
            <div>
              <div className="label">Requested by</div>
              <div className="font-semibold">{c.fiu}</div>
              <div className="text-[12px] text-muted">on behalf of {c.requester}{c.requester_ja ? ` (${c.requester_ja})` : ""}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-stage p-3"><div className="label">Data</div><div className="mt-0.5 font-semibold">{c.fi_types.join(", ")}</div></div>
              <div className="rounded-xl bg-stage p-3"><div className="label">Period</div><div className="mt-0.5 font-semibold">Last {c.months} months</div></div>
              <div className="rounded-xl bg-stage p-3"><div className="label">Frequency</div><div className="mt-0.5 font-semibold">{c.frequency}</div></div>
              <div className="rounded-xl bg-stage p-3"><div className="label">Data life</div><div className="mt-0.5 text-[12px] font-semibold">{c.data_life}</div></div>
            </div>
            <div><div className="label">Purpose</div><div>{c.purpose}</div></div>
            {result ? (
              <div className={`flex items-center gap-2 rounded-xl p-4 font-semibold ${result === "approved" ? "bg-verified-soft text-verified" : "bg-hinomaru-soft text-hinomaru"}`}>
                {result === "approved" ? <Check size={18} /> : <X size={18} />} {result === "approved" ? "Consent approved. The data has been shared (simulated)." : "Consent denied. Nothing was shared."}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button className="btn-ghost py-3" disabled={busy} onClick={() => decide(false)}>Deny</button>
                <button className="btn py-3 bg-[#1B3A6B] text-white hover:bg-[#15305a]" disabled={busy} onClick={() => decide(true)}>{busy && <Loader2 size={15} className="animate-spin" />} Approve</button>
              </div>
            )}
            <p className="text-center text-[10.5px] text-muted">You can revoke this consent at any time from your AA app. (SIMULATED)</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
