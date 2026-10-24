import type { ReactNode } from "react";

export interface Citation {
  id: string;
  source_name: string;
  source_url: string;
  as_of: string;
  verified: boolean;
}

/** Renders text with [kb:id] markers as numbered superscript source links. */
export function Cited({ text, citations, className = "" }: { text: string; citations: Record<string, Citation>; className?: string }) {
  const parts = text.split(/(\[kb:[a-z0-9_]+\])/g);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const m = p.match(/^\[kb:([a-z0-9_]+)\]$/);
        if (!m) return <span key={i}>{p}</span>;
        const c = citations[m[1]];
        if (!c) return null;
        const href = c.source_url.startsWith("http") ? c.source_url : undefined;
        return (
          <a key={i} href={href} target="_blank" rel="noreferrer" title={`${c.source_name} · as of ${c.as_of}${c.verified ? "" : " · to be verified"}`}
            className={`ml-0.5 align-super text-[9.5px] font-semibold no-underline ${c.verified ? "text-ink-3 hover:text-hinomaru" : "text-amber hover:text-hinomaru"}`}>
            [{c.verified ? "src" : "src·verify"}]
          </a>
        );
      })}
    </span>
  );
}

export function SourceChip({ url, asOf, verified, label }: { url: string; asOf: string; verified: boolean; label?: ReactNode }) {
  const href = url.startsWith("http") ? url : undefined;
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${verified ? "text-ink-3 ring-line hover:text-hinomaru" : "bg-amber-soft text-amber ring-amber/30"}`}>
      {label ?? "Source"} · {asOf}{verified ? "" : " · to be verified"}
    </a>
  );
}

export function Disclaimer({ ja }: { ja: boolean }) {
  return (
    <p className="mt-4 rounded-lg border border-line bg-wash px-3 py-2 text-[11.5px] leading-relaxed text-ink-3">
      {ja ? "Shinraiは公的情報に基づく意思決定支援を提供します。法務・税務・規制に関する事項は、必ず資格を有する専門家に確認してください。"
        : "Shinrai provides decision support based on public sources. Confirm legal, tax and regulatory matters with qualified professionals."}
    </p>
  );
}
