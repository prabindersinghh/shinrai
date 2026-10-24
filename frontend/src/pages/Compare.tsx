import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import IndiaMapSvg from "../components/IndiaMapSvg";
import Shell from "../components/Shell";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { BAND, FAMILY, MODE, RADAR_FAMILIES, SEVERITY } from "../lib/visual";

export default function Compare() {
  const { smeId } = useParams();
  const { lang, pick } = useI18n();
  const ja = lang === "ja";
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    api.compare(Number(smeId)).then(setRows);
  }, [smeId]);

  return (
    <Shell>
      <section className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6">
        <h1 className="jp text-[32px] font-bold tracking-tight">{ja ? "候補企業の比較" : "Compare candidates"}</h1>
        <p className="jp mt-1 text-[13px] text-muted">{ja ? "信頼スコア順。最も重大な指摘と、貴社ニーズとの適合度を並べています。" : "Ranked by 信頼スコア, with each company's most serious flag and its fit with your needs."}</p>
        {rows && rows.length > 0 && (
          <div className="mt-8 grid items-center gap-8 rounded-xl border border-line p-6 md:grid-cols-[300px_1fr]">
            <IndiaMapSvg values={Object.fromEntries(rows.filter((r) => r.state && r.score != null).map((r) => [r.state, r.score]))}
              highlight={rows.filter((r) => r.band === "high").map((r) => r.state)} width={300} />
            <div>
              <div className="label">{ja ? "候補企業の所在州" : "Where your candidates are"}</div>
              <ul className="mt-2 space-y-1.5 text-[13px]">
                {rows.map((r) => (
                  <li key={r.inv_id} className="flex items-baseline gap-2">
                    <span className="w-32 shrink-0 text-muted">{r.state ?? "—"}</span>
                    <span className="flex-1">{r.name}</span>
                    <span className="num text-[16px]" style={{ color: (BAND[r.band] ?? BAND.insufficient).color }}>{r.score ?? "—"}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11.5px] text-muted">{ja ? "色の濃さ＝信頼スコア、赤枠＝高リスク" : "Shade = trust score; red outline = high risk"}</p>
            </div>
          </div>
        )}
        <div className="mt-8 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[980px] text-left text-[13px]">
            <thead className="bg-wash text-[11px] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">{ja ? "企業" : "Company"}</th>
                <th className="px-4 py-2.5 font-medium">{ja ? "スコア" : "Score"}</th>
                <th className="px-4 py-2.5 font-medium">{ja ? "判定" : "Band"}</th>
                <th className="px-4 py-2.5 font-medium">{ja ? "適合度" : "Fit"}</th>
                {RADAR_FAMILIES.map((f) => <th key={f} className="px-2 py-2.5 text-center font-medium">{ja ? FAMILY[f].ja : FAMILY[f].en}</th>)}
                <th className="px-4 py-2.5 font-medium">{ja ? "最重要の指摘" : "Top flag"}</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r, i) => {
                const b = BAND[r.band] ?? BAND.insufficient;
                return (
                  <tr key={r.inv_id} className="border-t border-line hover:bg-wash">
                    <td className="num px-4 py-3 text-[20px] text-muted">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link to={`/report/${r.inv_id}`} className="font-semibold hover:text-hinomaru">{r.name}</Link>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {r.is_demo && <span className="chip bg-stage text-ink-3 ring-1 ring-line">{ja ? "説明用" : "Illustrative"}</span>}
                        <span className={`chip ${MODE[r.mode]?.cls}`}>{MODE[r.mode]?.label}</span>
                        <span className="text-[11px] text-muted">{r.state}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="num text-[30px] leading-none" style={{ color: b.color }}>{r.score}</span></td>
                    <td className="px-4 py-3"><span className="jp chip" style={{ background: b.soft, color: b.color }}>{ja ? b.ja : b.en}</span></td>
                    <td className="num px-4 py-3 text-[20px]">{r.fit ?? "—"}</td>
                    {RADAR_FAMILIES.map((f) => {
                      const v = r.subscores?.[f];
                      return <td key={f} className="num px-2 py-3 text-center text-[16px]" style={{ color: v == null ? "#C9CCD3" : v >= 80 ? "#15803D" : v >= 50 ? "#D97706" : "#E3122B" }}>{v ?? "—"}</td>;
                    })}
                    <td className="max-w-[280px] px-4 py-3">
                      {r.top_flag ? (
                        <div className="flex items-start gap-2">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY[r.top_flag.severity as keyof typeof SEVERITY].color }} />
                          <span className={`text-[12px] leading-snug ${ja ? "jp" : ""}`}>{pick(r.top_flag.text_ja, r.top_flag.text_en)}</span>
                        </div>
                      ) : <span className="text-[12px] text-verified">{ja ? "指摘なし" : "No flags"}</span>}
                    </td>
                  </tr>
                );
              })}
              {rows && !rows.length && <tr><td colSpan={13} className="px-4 py-10 text-center text-muted">{ja ? "調査済みの候補企業はまだありません。" : "No candidate has been investigated yet."}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="jp mt-8 text-center text-[15px] font-semibold text-ink-2">{ja ? "数週間を60秒に。JETROの紹介案件は、すべて事前検証済みに。" : "Weeks to 60 seconds. Every JETRO introduction arrives pre-verified."}</p>
      </section>
    </Shell>
  );
}
