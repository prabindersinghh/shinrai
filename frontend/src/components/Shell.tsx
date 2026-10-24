import { NavLink, Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useI18n } from "../i18n";

export function Wordmark({ invert = false }: { invert?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Shinrai home">
      <span className="grid h-8 w-8 place-items-center rounded-[7px] bg-hinomaru font-jp text-[17px] font-bold text-white shadow-seal">信</span>
      <span className="flex items-baseline gap-1.5">
        <span className={`num text-[22px] leading-none tracking-[0.08em] ${invert ? "text-white" : "text-ink"}`}>SHINRAI</span>
        <span className={`jp text-[13px] font-bold ${invert ? "text-white/80" : "text-ink-2"}`}>信頼</span>
      </span>
    </Link>
  );
}

export function LangToggle({ invert = false }: { invert?: boolean }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`flex rounded-lg p-0.5 text-xs font-semibold ${invert ? "bg-white/10" : "bg-stage ring-1 ring-line"}`} role="group" aria-label="Language">
      {(["en", "ja"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`rounded-md px-2.5 py-1 transition-colors ${lang === l ? (invert ? "bg-white text-ink" : "bg-paper text-ink shadow-card") : invert ? "text-white/70" : "text-muted"}`}>
          {l === "ja" ? "日本語" : "EN"}
        </button>
      ))}
    </div>
  );
}

function smeId(): string | null {
  try {
    return localStorage.getItem("shinrai.sme");
  } catch {
    return null;
  }
}

export default function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { t, lang } = useI18n();
  const sme = smeId();
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${isActive ? "bg-ink text-white" : "text-ink-2 hover:bg-stage"}`;
  return (
    <div className="min-h-full bg-paper">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className={`mx-auto flex h-14 items-center gap-6 px-4 sm:px-6 ${wide ? "max-w-[1600px]" : "max-w-[1240px]"}`}>
          <Wordmark />
          <nav className="flex items-center gap-1">
            {sme ? (
              <>
                <NavLink to={`/advisor/${sme}`} className={link}>{lang === "ja" ? "アドバイザー" : "Advisor"}</NavLink>
                <NavLink to={`/partners/${sme}`} className={link}>{t("nav.partners")}</NavLink>
                <NavLink to={`/compare/${sme}`} className={link}>{lang === "ja" ? "レポート" : "Reports"}</NavLink>
                <NavLink to={`/intelligence/${sme}`} className={link}>{lang === "ja" ? "分析" : "Analytics"}</NavLink>
              </>
            ) : (
              <NavLink to="/onboarding" className={link}>{lang === "ja" ? "はじめる" : "Get started"}</NavLink>
            )}
            <span className="mx-1 h-5 w-px bg-line" />
            <NavLink to="/demo" className={link}>{t("nav.demo")}</NavLink>
          </nav>
          <div className="ml-auto"><LangToggle /></div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

export function rememberSme(id: number) {
  try {
    localStorage.setItem("shinrai.sme", String(id));
  } catch {
    /* storage unavailable */
  }
}
