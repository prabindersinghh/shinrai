import { BadgeCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Wordmark } from "../components/Shell";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { BAND } from "../lib/visual";

/** Public "Shinrai Verified" card: verify once, trusted by many buyers. */
export default function Verified() {
  const { id } = useParams();
  const { lang } = useI18n();
  const ja = lang === "ja";
  const [v, setV] = useState<any>(null);
  useEffect(() => {
    api.verified(Number(id)).then(setV);
  }, [id]);
  if (!v) return null;
  const band = BAND[v.band ?? ""];
  return (
    <div className="grid min-h-screen place-items-center bg-stage px-4">
      <div className="w-full max-w-[480px]">
        <div className={`overflow-hidden rounded-2xl border bg-paper shadow-lift ${v.eligible ? "border-verified" : "border-line"}`}>
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <Wordmark />
            {v.is_demo && <span className="chip bg-hinomaru text-white">DEMO DATA</span>}
          </div>
          <div className="p-6">
            {v.eligible ? (
              <div className="flex items-center gap-3 text-verified"><BadgeCheck size={36} /><div><div className="text-[20px] font-bold">Shinrai Verified</div><div className="jp text-[13px]">{ja ? "検証済みパートナー" : "Verified partner"}</div></div></div>
            ) : (
              <div className="flex items-center gap-3 text-ink-3"><ShieldAlert size={36} /><div><div className="text-[20px] font-bold text-ink">{ja ? "未認定" : "Not verified"}</div><div className="text-[13px]">{v.reasons.join(" · ")}</div></div></div>
            )}
            <div className="mt-6 text-[18px] font-semibold">{v.company?.name}</div>
            <div className="font-mono text-[12px] text-muted">{v.company?.cin}</div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-stage p-3"><div className="num text-[30px] leading-none" style={{ color: band?.color }}>{v.score}</div><div className="label mt-1">信頼スコア</div></div>
              <div className="rounded-xl bg-stage p-3"><div className="jp text-[15px] font-bold" style={{ color: band?.color }}>{band?.ja}</div><div className="label mt-1">{band?.en}</div></div>
              <div className="rounded-xl bg-stage p-3"><div className="text-[15px] font-bold">{v.audited ? "✓" : "—"}</div><div className="label mt-1">{ja ? "現地監査" : "Field audit"}</div></div>
            </div>
            <p className="jp mt-5 text-[12px] leading-relaxed text-muted">
              {ja ? "一度の検証で、複数の買い手が信頼できる。財務データは相手方の同意に基づき共有されました（ハッカソンではシミュレーション）。"
                : "Verified once, trusted by many buyers. Financial data was shared with the partner's consent (simulated for the hackathon)."}
            </p>
            <p className="mt-2 text-[11px] text-muted">{ja ? "確認日" : "Checked"} {v.checked_at ? new Date(v.checked_at).toLocaleDateString() : "—"}</p>
          </div>
        </div>
        <Link to={`/report/${id}`} className="mt-4 block text-center text-[13px] text-ink-2 hover:text-hinomaru">{ja ? "完全なレポートを見る" : "See the full report"} →</Link>
      </div>
    </div>
  );
}
