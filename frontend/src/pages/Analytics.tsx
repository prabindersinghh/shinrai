import { useState } from "react";
import Shell from "../components/Shell";
import { useI18n } from "../i18n";

/** The Vizro analytics app (Market Explorer, Partner Portfolio, Model Cards, Ground Overview), embedded. */
export default function Analytics() {
  const { lang } = useI18n();
  const [loaded, setLoaded] = useState(false);
  return (
    <Shell wide>
      <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-6 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="label">{lang === "ja" ? "Shinrai Intelligence" : "Shinrai Intelligence"}</div>
            <h1 className="jp mt-1 text-[28px] font-bold tracking-tight">{lang === "ja" ? "分析" : "Analytics"}</h1>
          </div>
          <p className="text-[12px] text-muted">{lang === "ja" ? "市場・ポートフォリオ・モデル・現地データ" : "Market, portfolio, model and ground data"}</p>
        </div>
        <div className="relative mt-5 overflow-hidden rounded-xl border border-line bg-paper">
          {!loaded && <div className="absolute inset-0 grid place-items-center bg-paper text-[13px] text-muted">{lang === "ja" ? "読み込み中…" : "Loading analytics…"}</div>}
          <iframe title="Shinrai Analytics" src="/analytics/" className="h-[calc(100vh-170px)] min-h-[720px] w-full" onLoad={() => setLoaded(true)} />
        </div>
      </div>
    </Shell>
  );
}
