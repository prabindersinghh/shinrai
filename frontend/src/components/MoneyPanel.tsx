import { BadgeCheck, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { api, type MoneyT } from "../lib/api";
import { fmtInr, RED } from "../lib/visual";
import { EvidenceChips } from "./FindingCards";

interface Props {
  invId: number;
  money: MoneyT;
  consent: { status: string; token: string } | null;
  onEvidence: (ev: string) => void;
  onUpdated: () => void;
}

export function SimulatedBanner() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-amber bg-amber-soft px-3 py-1.5 text-[11.5px] font-semibold text-amber">
      <span className="rounded bg-amber px-1.5 py-[1px] text-[10px] text-white">SIMULATED</span> {t("money.simulated")}
    </div>
  );
}

export default function MoneyPanel({ invId, money, consent, onEvidence, onUpdated }: Props) {
  const { lang, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(consent?.status === "requested" ? `/consent/${consent.token}` : null);
  const ja = lang === "ja";
  const received = money?.status === "received";

  useEffect(() => {
    if (!link || received) return;
    const timer = setInterval(onUpdated, 2500);
    return () => clearInterval(timer);
  }, [link, received, onUpdated]);

  const request = async () => {
    setBusy(true);
    try {
      const c = await api.requestConsent(invId);
      setLink(c.link);
    } finally {
      setBusy(false);
    }
  };

  const months = (money?.months ?? []).map((m) => ({ ...m, crore: m.taxable_turnover / 1e7 }));
  const claimedMonthly = money?.claimed_turnover ? money.claimed_turnover / 12 / 1e7 : null;

  return (
    <div className="space-y-4">
      <SimulatedBanner />
      {!received && (
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="panel p-5">
            <h3 className="text-[15px] font-semibold">{ja ? "実際の売上を、同意に基づいて確認する" : "Check real turnover, with the partner's consent"}</h3>
            <p className={`mt-2 text-[13px] leading-relaxed text-ink-3 ${ja ? "jp" : ""}`}>
              {ja ? "インドのアカウント・アグリゲーター（RBI規制）の仕組みでは、事業者が自社のGSTR-1／GSTR-3B申告（直近18か月）を明示的な同意のもとで共有できます。本番では銀行・NBFCパートナー経由で受領します。"
                : "India's RBI-regulated Account Aggregator framework lets a business share its GSTR-1 and GSTR-3B returns (last 18 months) with explicit consent. In production Shinrai receives them through a bank or NBFC partner."}
            </p>
            {!link ? (
              <button className="btn-red mt-4" disabled={busy} onClick={request}>{busy && <Loader2 size={14} className="animate-spin" />} {t("money.request")}</button>
            ) : (
              <div className="mt-4 rounded-lg border border-line bg-wash p-3">
                <div className="label">{ja ? "相手方への同意リンク" : "Consent link for the partner"}</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate font-mono text-[12px]">{window.location.origin}{link}</code>
                  <a href={link} target="_blank" rel="noreferrer" className="btn-ink !py-1.5 text-xs">{ja ? "相手方画面を開く" : "Open partner screen"} <ExternalLink size={12} /></a>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[12px] text-muted"><Loader2 size={13} className="animate-spin" /> {ja ? "相手方の承認を待っています…" : "Waiting for the partner to approve…"}</div>
              </div>
            )}
          </div>
          <div className="panel p-5 text-[12.5px] text-ink-3">
            <div className="label">{ja ? "依頼するデータ" : "Data requested"}</div>
            <ul className="mt-2 space-y-1.5">
              <li>GSTR-1 · GSTR-3B · {ja ? "直近18か月" : "last 18 months"}</li>
              <li>{ja ? "目的：取引開始前の信用調査" : "Purpose: due diligence before a trade relationship"}</li>
              <li>{ja ? "1回のみ取得・レポート発行30日後に削除" : "One-time fetch, deleted 30 days after the report"}</li>
            </ul>
          </div>
        </div>
      )}
      {received && (
        <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
          <div className="panel p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[14px] font-semibold">{ja ? "月次課税売上（GSTR-3B）" : "Monthly taxable turnover (GSTR-3B)"}</h3>
              <span className="text-[11px] text-muted">₹ crore</span>
            </div>
            <div className="mt-3 h-[220px]">
              <ResponsiveContainer>
                <BarChart data={months} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#EDEEF1" />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#7A808C" }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: "#7A808C" }} tickLine={false} axisLine={false} domain={[0, Math.ceil(Math.max(claimedMonthly ?? 0, ...months.map((m) => m.crore)) * 1.1)]} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)} cr`, ja ? "課税売上" : "Taxable turnover"]} />
                  <Bar dataKey="crore" fill="#141414" radius={[3, 3, 0, 0]} />
                  {claimedMonthly && <ReferenceLine y={claimedMonthly} stroke={RED} strokeDasharray="5 4" label={{ value: ja ? `主張（月換算）₹${claimedMonthly.toFixed(1)} cr` : `claimed (monthly) ₹${claimedMonthly.toFixed(1)} cr`, fontSize: 10, fill: RED, position: "insideTopRight" }} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <EvidenceChips ids={[money.evidence_id!]} onEvidence={onEvidence} />
          </div>
          <div className="panel flex flex-col justify-center p-5">
            <div className="label">{ja ? "直近12か月の申告売上" : "Declared, last 12 filed months"}</div>
            <div className="num text-[44px] leading-none text-ink">{fmtInr(money.declared_12m)}</div>
            <div className="label mt-4">{ja ? "会社資料での主張" : "Claimed in the brochure"}</div>
            <div className="num text-[44px] leading-none text-hinomaru">{fmtInr(money.claimed_turnover)}</div>
            {money.claimed_turnover && money.declared_12m ? (
              <p className="jp mt-3 text-[13px] font-semibold text-hinomaru">
                {ja ? `主張は申告額の約${Math.round(money.claimed_turnover / money.declared_12m)}倍` : `Claim is about ${Math.round(money.claimed_turnover / money.declared_12m)}× the declared figure`}
              </p>
            ) : null}
            <Link to={`/verified/${invId}`} className="btn-ghost mt-4 w-fit text-xs"><BadgeCheck size={14} /> {ja ? "Shinrai Verified カード" : "Shinrai Verified card"}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
