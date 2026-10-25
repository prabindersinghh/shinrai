import { AlertOctagon, FastForward, Link2, RotateCcw, ShieldCheck, ShieldX } from "lucide-react";
import { Link } from "react-router-dom";
import { PAY_STATE } from "../../trade/labels";
import { DAY } from "../../trade/seed";
import { actions, useTrade, verifyChain } from "../../trade/store";
import { Chip, fmtDate, Prov, SectionTitle, TradeShell, useL } from "../../trade/ui";

export default function Ops() {
  const s = useTrade();
  const { p, ja, lang, money } = useL();
  const chain = verifyChain(s.events);
  const exceptions = s.payments.filter((x) => ["FAILED", "REVERSED", "DISPUTED"].includes(x.state) || (x.reconciliation && x.reconciliation.status !== "matched") || x.events.some((e) => !e.signatureValid));

  return (
    <TradeShell>
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
        <SectionTitle kicker={p("Operations", "運営")} title={p("Audit log, exceptions and demo controls", "監査ログ・例外・デモ操作")} right={<Prov kind="ILLUSTRATIVE" />} />
        <div className="grid gap-4 md:grid-cols-3">
          <div className={`panel p-4 ${chain.ok ? "" : "border-hinomaru/50 bg-hinomaru-soft"}`}>
            <div className="flex items-center gap-2">{chain.ok ? <ShieldCheck className="text-verified" /> : <ShieldX className="text-hinomaru" />}<div className="text-[15px] font-semibold text-ink">{chain.ok ? p("Event chain intact", "イベント連鎖は正常") : p(`Chain broken at event #${chain.brokenAt}`, `イベント#${chain.brokenAt}で連鎖が破損`)}</div></div>
            <p className="mt-2 text-[12px] text-ink-3">{p(`${s.events.length} append-only events. Each hashes the previous one, so editing history is detectable.`, `${s.events.length}件の追記専用イベント。各イベントが直前のハッシュを含むため改ざんを検出できます。`)}</p>
            <button onClick={() => actions.tamper()} className="btn-ghost mt-3 text-[12px]"><AlertOctagon size={13} />{p("Tamper with history (demo)", "履歴を改ざん（デモ）")}</button>
          </div>
          <div className="panel p-4">
            <div className="text-[15px] font-semibold text-ink">{p("Demo clock", "デモ時計")}</div>
            <p className="mt-1 text-[12px] text-ink-3">{fmtDate(Date.now() + s.offset, lang)} · {p("pool deadlines and shipment ETAs follow this clock", "締切と到着予定はこの時計に従います")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[["+1h", 3_600_000], ["+1d", DAY], ["+7d", 7 * DAY]].map(([l, ms]) => <button key={l as string} onClick={() => actions.advance(ms as number)} className="btn-ghost text-[12px]"><FastForward size={12} />{l}</button>)}
            </div>
          </div>
          <div className="panel p-4">
            <div className="text-[15px] font-semibold text-ink">{p("Workspace", "ワークスペース")}</div>
            <p className="mt-1 text-[12px] text-ink-3">{p("Everything is stored in this browser only (localStorage). Reset returns to the illustrative starting point.", "データはこのブラウザ内のみに保存。初期化で説明用の初期状態に戻ります。")}</p>
            <button onClick={() => actions.reset()} className="btn-ghost mt-3 text-[12px] text-hinomaru-deep"><RotateCcw size={13} />{p("Reset workspace", "初期化")}</button>
          </div>
        </div>

        <div className="panel p-4">
          <SectionTitle kicker={p("Payment exceptions", "支払例外")} title={p("Needs attention", "要対応")} />
          {exceptions.length === 0 ? <div className="text-[12.5px] text-muted">{p("No exceptions.", "例外はありません。")}</div> : (
            <table className="w-full text-[12.5px]"><tbody>
              {exceptions.map((x) => {
                const o = s.pos.find((y) => y.id === x.poId)!;
                return (
                  <tr key={x.id} className="border-b border-line last:border-0">
                    <td className="py-2 font-mono">{x.id}</td><td><Link to={`/orders/${o.id}`} className="underline">{o.number}</Link></td><td>{x.purpose}</td>
                    <td><Chip tone={PAY_STATE[x.state].tone}>{p(PAY_STATE[x.state].l[0], PAY_STATE[x.state].l[1])}</Chip></td>
                    <td>{x.reconciliation && x.reconciliation.status !== "matched" && <Chip tone="red">{x.reconciliation.status}: {money(x.reconciliation.received)} / {money(x.reconciliation.expected)}</Chip>}</td>
                    <td>{x.events.some((e) => !e.signatureValid) && <Chip tone="red">{p("forged webhook rejected", "偽造Webhookを拒否")}</Chip>}</td>
                  </tr>
                );
              })}
            </tbody></table>
          )}
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-line px-4 py-3"><SectionTitle kicker={p("Domain events", "ドメインイベント")} title={<span className="flex items-center gap-2"><Link2 size={16} />{p("Hash-chained audit log", "ハッシュ連鎖の監査ログ")}</span>} /></div>
          <div className="max-h-[560px] overflow-auto scrollbar-thin">
            <table className="w-full min-w-[900px] text-[12px]">
              <thead className="sticky top-0 bg-wash text-left text-muted"><tr>{["#", p("Time (JST)", "時刻"), p("Aggregate", "対象"), p("Type", "種別"), p("Actor", "実行者"), p("Event", "内容"), "hash"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {[...s.events].reverse().map((e) => {
                  const broken = !chain.ok && chain.brokenAt === e.seq;
                  return (
                    <tr key={e.seq} className={`border-t border-line ${broken ? "bg-hinomaru-soft" : ""}`}>
                      <td className="px-3 py-1.5 font-mono text-muted">{e.seq}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px]">{fmtDate(e.at, lang)}</td>
                      <td className="px-3 py-1.5 font-mono">{e.aggregate}:{e.aggregateId}</td>
                      <td className="px-3 py-1.5 font-mono">{e.type}</td>
                      <td className="px-3 py-1.5">{e.actor}</td>
                      <td className="px-3 py-1.5 text-ink-2">{ja ? e.text_ja : e.text_en}</td>
                      <td className="px-3 py-1.5 font-mono text-[10.5px] text-muted">{e.hash.slice(0, 10)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </TradeShell>
  );
}
