import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import en from "./en.json";
import ja from "./ja.json";

export type Lang = "ja" | "en";
const DICTS: Record<Lang, Record<string, string>> = { ja, en };

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  /** Pick the string for the current language from a bilingual pair. */
  pick: (ja?: string | null, en?: string | null) => string;
}

const Ctx = createContext<I18n | null>(null);

function initialLang(): Lang {
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  if (fromUrl === "ja" || fromUrl === "en") return fromUrl;
  try {
    const saved = localStorage.getItem("shinrai.lang");
    if (saved === "ja" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  return "ja";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem("shinrai.lang", l);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key) => DICTS[lang][key] ?? DICTS.en[key] ?? key,
      pick: (jaText, enText) => (lang === "ja" ? jaText || enText : enText || jaText) || "",
    }),
    [lang, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}
