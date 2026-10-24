import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "../../i18n";
import { SourceChip } from "./Cited";

interface Growth {
  playbook: { id: string; name_en: string; name_ja: string };
  phases: { when: string; mode_name: string; mode_name_ja: string; headcount: string; channel_en: string; channel_ja: string; kpi_en: string; kpi_ja: string }[];
  levers: { id: string; name_en: string; name_ja: string; text_en: string; text_ja: string; source_url: string; as_of: string; verified_by_team: boolean }[];
}

const SCEN = { conservative: 0.6, base: 1, aggressive: 1.4 };

/** Phased roadmap plus a transparent, user-driven scenario model (illustrative). */
export default function GrowthPlan({ growth }: { growth: Growth }) {
  const { lang } = useI18n();
  const ja = lang === "ja";
  const [a, setA] = useState({ price: 12000, units: 400, growth: 4, margin: 32, fixed: 2800000, setup: 45000000 });
  const set = (k: keyof typeof a, v: number) => setA((x) => ({ ...x, [k]: v }));
  const model = useMemo(() => {
    const rows = [];
    const cum: Record<string, number> = { conservative: -a.setup, base: -a.setup, aggressive: -a.setup };
    const be: Record<string, number | null> = { conservative: null, base: null, aggressive: null };
    for (let m = 1; m <= 36; m++) {
      const row: Record<string, number> = { month: m };
      for (const [k, f] of Object.entries(SCEN)) {
        const units = a.units * f * Math.pow(1 + (a.growth / 100) * f, m - 1);
        const revenue = units * a.price;
        cum[k] += revenue * (a.margin / 100) - a.fixed;
        if (be[k] == null && cum[k] >= 0) be[k] = m;
        row[k] = Math.round(revenue / 1e5) / 10; // ₹ million
      }
      rows.push(row);
    }
    return { rows, be };
  }, [a]);
  const field = (k: keyof typeof a, label: string, suffix: string) => (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-line px-2">
        <input type="number" value={a[k]} onChange={(e) => set(k, Number(e.target.value) || 0)} className="w-full py-1.5 text-[13px] outline-none" />
        <span className="text-[11px] text-muted">{suffix}</span>
      </div>
    </label>
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="label">{ja ? "推奨する成長モデル" : "Recommended growth model"}</div>
        <div className="jp mt-1 text-[17px] font-semibold">{ja ? growth.playbook.name_ja : growth.playbook.name_en}</div>
      </div>
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
        {growth.phases.map((p, i) => (
          <div key={p.when} className="bg-paper p-4">
            <div className="flex items-baseline justify-between">
              <span className="num text-[22px] text-hinomaru">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[11.5px] font-semibold text-ink-2">{p.when}</span>
            </div>
            <div className="jp mt-2 text-[14px] font-semibold">{ja ? p.mode_name_ja : p.mode_name}</div>
            <p className={`mt-1 text-[12.5px] text-ink-2 ${ja ? "jp" : ""}`}>{ja ? p.channel_ja : p.channel_en}</p>
            <div className="mt-3 text-[11px] text-muted">{ja ? "人員" : "Headcount"} {p.headcount}</div>
            <div className={`mt-1 text-[11.5px] text-ink-3 ${ja ? "jp" : ""}`}>KPI · {ja ? p.kpi_ja : p.kpi_en}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2.5 rounded-xl border border-line p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold">{ja ? "前提条件" : "Assumptions"}</span>
            <span className="chip bg-stage text-ink-3">{ja ? "試算モデル・入力値" : "Illustrative · your inputs"}</span>
          </div>
          {field("price", ja ? "単価" : "Price per unit", "₹")}
          {field("units", ja ? "初月の販売数量" : "Units in month 1", ja ? "個" : "units")}
          {field("growth", ja ? "月次成長率" : "Monthly growth", "%")}
          {field("margin", ja ? "粗利率" : "Gross margin", "%")}
          {field("fixed", ja ? "月次固定費" : "Fixed cost per month", "₹")}
          {field("setup", ja ? "初期投資" : "Set-up investment", "₹")}
        </div>
        <div className="rounded-xl border border-line p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="text-[13px] font-semibold">{ja ? "月次売上の推移（₹100万）" : "Monthly revenue (₹ million)"}</span>
            <div className="flex gap-4 text-[12px]">
              {(Object.keys(SCEN) as (keyof typeof SCEN)[]).map((k) => (
                <span key={k}><span className="text-muted">{ja ? { conservative: "保守", base: "基本", aggressive: "積極" }[k] : k} · </span>
                  <span className="font-semibold">{model.be[k] ? `${ja ? "損益分岐" : "break-even"} M${model.be[k]}` : ja ? "36か月内に未達" : "no break-even in 36 m"}</span></span>
              ))}
            </div>
          </div>
          <div className="mt-2 h-[240px]">
            <ResponsiveContainer>
              <LineChart data={model.rows} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EDEEF1" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#7A808C" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#7A808C" }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {model.be.base && <ReferenceLine x={model.be.base} stroke="#15803D" strokeDasharray="4 3" />}
                <Line dataKey="conservative" stroke="#9AA0AB" strokeWidth={1.5} dot={false} />
                <Line dataKey="base" stroke="#141414" strokeWidth={2.2} dot={false} />
                <Line dataKey="aggressive" stroke="#E3122B" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div>
        <div className="label">{ja ? "成長レバー" : "Growth levers"}</div>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {growth.levers.map((l) => (
            <div key={l.id} className="rounded-lg border border-line p-3">
              <div className="jp text-[13px] font-semibold">{ja ? l.name_ja : l.name_en}</div>
              <p className={`mt-1 text-[12px] text-ink-2 ${ja ? "jp" : ""}`}>{ja ? l.text_ja : l.text_en}</p>
              <div className="mt-2"><SourceChip url={l.source_url} asOf={l.as_of} verified={l.verified_by_team} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
