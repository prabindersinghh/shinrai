/* Cyber posture as a pinned, scroll-driven dissection of a four-floor illustrated building (GSAP ScrollTrigger).
   Scroll explodes the building, flies the camera into each floor, takes its parts apart and reassembles the lot.
   Reduced motion and print get the static checklist instead. */
import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMemo, useRef } from "react";
import { useI18n } from "../i18n";
import { ACCENT, CertRoom, type Check, INK, MailRoom, ProtoRoom, RoomDefs, SoftRoom, type Status } from "./CyberRooms";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export interface CyberData { domain: string; checks: Check[]; evidence_id: string }

const FLOORS = [
  { key: "TLS certificate", kanji: "証", en: "TLS certificate", ja: "TLS証明書",
    whyEn: "The certificate proves the website is who it says it is. Expired, self-signed or issued for another name, browsers warn visitors and anyone can pose as the site.",
    whyJa: "証明書は、そのサイトが本物であることを示します。期限切れ・自己署名・名義違いだと、ブラウザが警告し、なりすましを防げません。" },
  { key: "TLS protocols", kanji: "門", en: "TLS protocols", ja: "TLSプロトコル",
    whyEn: "TLS 1.0 and 1.1 can be broken by an attacker on the same network. A modern server refuses them.",
    whyJa: "TLS 1.0/1.1は、同じ回線上の攻撃者に破られる恐れがあります。現行のサーバーはこれらを受け付けません。" },
  { key: "Email spoofing protection", kanji: "郵", en: "Email spoofing protection", ja: "なりすましメール対策",
    whyEn: "SPF and DMARC stop strangers sending invoices that look like they came from this company. Without them, payment-fraud emails get through.",
    whyJa: "SPFとDMARCは、この会社を装った偽の請求書メールを防ぎます。未設定だと、支払い詐欺のメールが届いてしまいます。" },
  { key: "Exposed software", kanji: "機", en: "Exposed software", ja: "公開ソフトウェア",
    whyEn: "A public web server that announces end-of-life software is running code that no longer gets security fixes.",
    whyJa: "公開サーバーが保守終了のソフトウェアを示している場合、セキュリティ修正が提供されていない恐れがあります。" },
] as const;

const STATUS = {
  pass: { en: "Clear", ja: "問題なし", sfxEn: "CLEAR!", sfxJa: "ピカッ!" },
  warn: { en: "Watch", ja: "要注意", sfxEn: "HMM…", sfxJa: "ムム…" },
  fail: { en: "Failed", ja: "不備", sfxEn: "CRACK!", sfxJa: "ピキッ!" },
  na: { en: "Not testable", ja: "確認不可", sfxEn: "?", sfxJa: "？" },
} as const;

/* Camera: the stage is an 800x800 world; the focus point of every shot lands on TARGET. */
const CX = 400, Y0 = 600, PITCH_ASSEMBLED = 96, PITCH_EXPLODED = 165, TARGET = { x: 400, y: 402 };
const cam = (sx: number, sy: number, scale: number) => ({ x: TARGET.x - scale * sx, y: TARGET.y - scale * sy, scale });
const topOf = (i: number, exploded: boolean) => Y0 - i * (exploded ? PITCH_EXPLODED : PITCH_ASSEMBLED);
const SFX_AT: [number, number][] = [[-46, -2], [-82, -24], [-46, -2], [-74, -32]]; // free wall space on each floor at close-up
const HOME = 1.22; // scale of the assembled building at the start and the end
const DETAIL: [number, number][] = [[10, 38], [-8, 54], [38, 36], [6, 34]]; // what the close-up pushes in on, from each floor's top vertex

const certNote = (r: string, ja: boolean) => {
  const until = r.match(/until (\d{4}-\d{2}-\d{2})/);
  if (until) return ja ? `${until[1]}まで` : `until ${until[1]}`;
  const soon = r.match(/expires in (\d+) days/);
  if (soon) return ja ? `残り${soon[1]}日` : `${soon[1]} days left`;
  const rules: [RegExp, string, string][] = [[/expired/i, "EXPIRED", "期限切れ"], [/self-signed/i, "SELF-SIGNED", "自己署名"], [/different hostname|mismatch/i, "WRONG NAME", "名義違い"],
    [/not trusted|issuer/i, "UNTRUSTED", "信頼不可"], [/no https/i, "NO HTTPS", "HTTPS無し"]];
  const hit = rules.find(([re]) => re.test(r));
  return hit ? (ja ? hit[2] : hit[1]) : ja ? "未確認" : "UNVERIFIED";
};
const bestTls = (r: string) => {
  const m = r.match(/best offered:\s*TLSv?\s?(1\.[0-3])/i);
  return m ? `TLS ${m[1]}` : "";
};
const shield = (text: string, status: Status, bad: RegExp, weak: RegExp): "ok" | "weak" | "missing" =>
  bad.test(text) ? "missing" : weak.test(text) ? "weak" : status === "na" ? "weak" : "ok";

function floorArt(i: number, c: Check, ja: boolean) {
  const s = c.status;
  if (i === 0) return <CertRoom s={s} note={certNote(c.result, ja)} />;
  if (i === 1) {
    const legacy = s === "fail" ? "open" : /refused|no answer/i.test(c.result) && s === "pass" ? "closed" : "unknown";
    return <ProtoRoom s={s} legacy={legacy} best={bestTls(c.result) || (legacy === "open" ? (ja ? "旧TLS有効" : "OLD TLS ON") : "")} />;
  }
  if (i === 2) {
    const policy = c.result.match(/DMARC p=(\w+)/i)?.[1];
    return <MailRoom s={s} spf={shield(c.result, s, /no spf/i, /spf does not/i)} dmarc={shield(c.result, s, /no dmarc/i, /p=none/i)} policy={policy ? `p=${policy}` : ""} fakeLabel={ja ? "偽?" : "FAKE?"} />;
  }
  const product = s === "warn" ? c.result.split(/ on the public/i)[0].slice(0, 22) : "";
  const banner = c.result.match(/^Banner: (.*)$/)?.[1]?.slice(0, 22) ?? (s === "na" ? (ja ? "未確認" : "not tested") : ja ? "表示なし" : "no banner");
  return <SoftRoom s={s} product={product} banner={banner} eolLabel={ja ? "保守終了" : "END OF LIFE"} />;
}

function Stamp({ status, ja }: { status: Status; ja: boolean }) {
  const a = ACCENT[status];
  return <span className="cy-stamp" style={{ color: a.solid, borderColor: a.solid }}>{ja ? STATUS[status].ja : STATUS[status].en}</span>;
}

function CheckBody({ i, c, ja, evidence, onEvidence, focusable = true }: { i: number; c: Check; ja: boolean; evidence: string; onEvidence: (id: string) => void; focusable?: boolean }) {
  const f = FLOORS[i];
  return (
    <>
      <div className="flex items-start gap-4">
        <span className="jp text-[58px] font-black leading-[0.9]" style={{ color: ACCENT[c.status].solid }} aria-hidden>{f.kanji}</span>
        <div className="min-w-0 pt-1">
          <Stamp status={c.status} ja={ja} />
          <h3 className="jp mt-2 text-[21px] font-bold leading-tight">{ja ? f.ja : f.en}</h3>
        </div>
      </div>
      <p className="mt-4 text-[16px] font-semibold leading-snug">{ja && c.result_ja ? c.result_ja : c.result}</p>
      <p className={`mt-2.5 text-[13px] leading-relaxed text-ink-3 ${ja ? "jp" : ""}`}>{ja ? f.whyJa : f.whyEn}</p>
      <button tabIndex={focusable ? 0 : -1} onClick={() => onEvidence(evidence)} className="mt-4 rounded border-2 border-ink px-2 py-0.5 font-mono text-[11px] font-semibold hover:bg-ink hover:text-white">{evidence} ↗</button>
    </>
  );
}

export function CyberChecklist({ data, onEvidence }: { data: CyberData; onEvidence: (id: string) => void }) {
  const { lang } = useI18n();
  const ja = lang === "ja";
  const checks = useChecks(data);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {checks.map((c, i) => (
        <div key={c.check} className="cy-bubble cy-static p-5">
          <CheckBody i={i} c={c} ja={ja} evidence={data.evidence_id} onEvidence={onEvidence} />
        </div>
      ))}
    </div>
  );
}

function useChecks(data: CyberData): Check[] {
  return useMemo(() => FLOORS.map((f) => data.checks.find((c) => c.check === f.key) ?? { check: f.key, result: "Not run", status: "na" as Status }), [data]);
}

const SPEED = Array.from({ length: 64 }, (_, n) => {
  const a = (n / 64) * Math.PI * 2 + Math.sin(n * 12.9) * 0.03;
  const r1 = 190 + (n % 4) * 18, r2 = 470 + ((n * 7) % 9) * 22;
  return { x1: 400 + Math.cos(a) * r1, y1: 400 + Math.sin(a) * r1, x2: 400 + Math.cos(a) * r2, y2: 400 + Math.sin(a) * r2, w: n % 3 === 0 ? 2.6 : 1.2 };
});

export default function CyberDissection({ data, onEvidence, print }: { data: CyberData; onEvidence: (id: string) => void; print?: boolean }) {
  const reduce = useReducedMotion();
  return print || reduce ? <CyberChecklist data={data} onEvidence={onEvidence} /> : <Stage data={data} onEvidence={onEvidence} />;
}

function Stage({ data, onEvidence }: { data: CyberData; onEvidence: (id: string) => void }) {
  const { lang } = useI18n();
  const ja = lang === "ja";
  const checks = useChecks(data);
  const root = useRef<HTMLDivElement>(null);
  const goTo = useRef<(i: number) => void>(() => {});
  const failed = checks.filter((c) => c.status === "fail").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  const sig = checks.map((c) => c.status + c.result).join("|");

  useGSAP(() => {
    const el = root.current!;
    const q = gsap.utils.selector(el);
    const world = q(".cy-world")[0];
    const rooms = q(".cy-room");
    const cards = q(".cy-card");
    const speed = q(".cy-speed");
    const nav = q(".cy-nav button");
    const stage = q(".cy-stage")[0];
    const parts = (i: number) => rooms[i].querySelectorAll<SVGElement>(".cy-part");
    const partXY = (axis: "dx" | "dy") => (_: number, t: Element) => Number((t as SVGElement).dataset[axis] ?? 0);

    // GSAP's svgOrigin resolves through the element's screen position and drifts once the stage is pinned, so the camera
    // is a plain {x, y, scale} object and the transform attribute is written here.
    const eye = cam(CX, 495, HOME);
    const shoot = () => world.setAttribute("transform", `translate(${eye.x} ${eye.y}) scale(${eye.scale})`);
    shoot();
    gsap.set(cards, { autoAlpha: 0 });
    gsap.set(cards[0], { autoAlpha: 1 });
    gsap.set(speed, { autoAlpha: 0, transformOrigin: "50% 50%" });
    gsap.set(q(".cy-sfx, .cy-tag"), { autoAlpha: 0 });
    const draws = q(".cy-draw");
    if (draws.length) gsap.set(draws, { strokeDasharray: 1, strokeDashoffset: 1 });

    const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });
    tl.eventCallback("onUpdate", shoot);
    tl.addLabel("intro", 0);
    tl.to(cards[0], { autoAlpha: 0, y: -26, duration: 0.6 }, 0.15);
    tl.to(eye, { ...cam(CX, 392, 1), duration: 1.5 }, 0.2);
    tl.to(rooms, { y: (i: number) => -(PITCH_EXPLODED - PITCH_ASSEMBLED) * i, duration: 1.2, stagger: 0.14, ease: "back.out(1.2)" }, 0.2);
    tl.addLabel("overview", 1.7);

    let at = 1.9;
    FLOORS.forEach((_, i) => {
      const sfx = q(`.cy-sfx-${i}`), tags = q(`.cy-room-${i} .cy-tag`);
      tl.addLabel(`z${i}`, at);
      tl.to(eye, { ...cam(CX, topOf(i, true) + 52, 2.05), duration: 1.1 }, at);
      tl.to(rooms, { opacity: (j: number) => (j === i ? 1 : 0.12), duration: 0.8 }, at);
      tl.to(cards[i], { autoAlpha: 0, x: -34, duration: 0.45, ease: "power2.in" }, at);
      tl.fromTo(speed, { autoAlpha: 0, scale: 0.72 }, { autoAlpha: 0.8, scale: 1.08, duration: 0.35, ease: "power2.out" }, at + 0.1);
      tl.to(speed, { autoAlpha: 0, duration: 0.55, ease: "power1.in" }, at + 0.5);
      tl.fromTo(cards[i + 1], { autoAlpha: 0, x: 46, rotate: 2.5 }, { autoAlpha: 1, x: 0, rotate: -0.6, duration: 0.7, ease: "back.out(1.5)" }, at + 0.55);
      tl.to(parts(i), { x: partXY("dx"), y: partXY("dy"), duration: 1, stagger: 0.09, ease: "power3.out" }, at + 0.9);
      const cracks = q(`.cy-room-${i} .cy-draw`);
      if (cracks.length) tl.to(cracks, { strokeDashoffset: 0, duration: 0.6, ease: "power1.out" }, at + 1.3);
      tl.to(eye, { ...cam(CX + DETAIL[i][0], topOf(i, true) + DETAIL[i][1], 3), duration: 1, ease: "power1.inOut" }, at + 1.2);
      if (tags.length) tl.to(tags, { autoAlpha: 1, duration: 0.45, stagger: 0.12 }, at + 1.9);
      tl.fromTo(sfx, { autoAlpha: 0, scale: 0.2, rotate: -22 }, { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.5, ease: "back.out(3)" }, at + 1.7);
      at += 3.4;
      tl.addLabel(`f${i}`, at - 0.5);
    });

    tl.addLabel("outro", at);
    tl.to(cards[4 + 0], { autoAlpha: 0, x: -34, duration: 0.45, ease: "power2.in" }, at);
    tl.to(q(".cy-sfx, .cy-tag"), { autoAlpha: 0, duration: 0.4 }, at);
    tl.to(rooms.flatMap((_, i) => [...parts(i)]), { x: 0, y: 0, duration: 1.2, stagger: 0.03, ease: "power3.inOut" }, at);
    tl.to(rooms, { y: 0, opacity: 1, duration: 1.5, stagger: { each: 0.1, from: "end" } }, at + 0.2);
    tl.to(eye, { ...cam(CX, 495, HOME), duration: 1.7 }, at);
    tl.fromTo(cards[5], { autoAlpha: 0, y: 30, rotate: 2 }, { autoAlpha: 1, y: 0, rotate: -0.6, duration: 0.7, ease: "back.out(1.4)" }, at + 1.1);
    tl.addLabel("end", ">");
    tl.to({}, { duration: 0.9 }); // dwell on the verdict before the page scrolls on

    const stops = ["intro", "overview", "f0", "f1", "f2", "f3", "end"].map((l) => tl.labels[l] / tl.duration()).concat(1);
    const header = 72;
    const st = ScrollTrigger.create({
      animation: tl, trigger: stage, start: `top top+=${header}`, end: () => `+=${Math.round(window.innerHeight * 6)}`,
      pin: true, scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: true,
      snap: { snapTo: stops, inertia: false, duration: { min: 0.25, max: 0.7 }, delay: 0.12, ease: "power1.inOut" },
      onUpdate: (self) => {
        const t = self.progress * tl.duration() + 0.35;
        const active = FLOORS.reduce((n, _, i) => (t >= tl.labels[`z${i}`] && t < tl.labels[i === 3 ? "outro" : `z${i + 1}`] ? i : n), -1);
        nav.forEach((b, j) => b.setAttribute("data-active", String(j === active)));
        stage.setAttribute("data-phase", active < 0 ? (t < tl.labels.overview ? "intro" : t >= tl.labels.outro ? "outro" : "overview") : "floor");
      },
    });
    goTo.current = (i) => window.scrollTo({ top: st.start + (st.end - st.start) * (tl.labels[`f${i}`] / tl.duration()), behavior: "smooth" });

    // The pin adds scroll length and the report above it loads late: re-measure when the page height really changes.
    let h = document.body.scrollHeight, timer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (Math.abs(document.body.scrollHeight - h) > 4) { ScrollTrigger.refresh(); h = document.body.scrollHeight; }
      }, 250);
    });
    ro.observe(document.body);

    // Ambient life on the floor being studied: the dish keeps broadcasting.
    gsap.to(q(".cy-pulse path"), { opacity: 0.2, duration: 0.7, stagger: 0.18, repeat: -1, yoyo: true, ease: "sine.inOut" });
    return () => { ro.disconnect(); window.clearTimeout(timer); };
  }, { scope: root, dependencies: [sig, lang] });

  const sfxFor = (c: Check) => (ja ? STATUS[c.status].sfxJa : STATUS[c.status].sfxEn);
  return (
    <div ref={root}>
      <div className="sr-only">
        <ol>{checks.map((c, i) => <li key={c.check}>{ja ? FLOORS[i].ja : FLOORS[i].en}: {ja && c.result_ja ? c.result_ja : c.result} ({ja ? STATUS[c.status].ja : STATUS[c.status].en})</li>)}</ol>
        <button onClick={() => onEvidence(data.evidence_id)}>{ja ? "証拠を開く" : "Open evidence"} {data.evidence_id}</button>
      </div>
      <div className="cy-stage cy-frame relative overflow-hidden" style={{ height: "calc(100svh - 88px)", minHeight: 560, maxHeight: 940 }} aria-hidden>
        <div className="cy-tone pointer-events-none absolute inset-0" />
        <div className="relative grid h-full grid-rows-[minmax(0,1.2fr)_minmax(0,1fr)] md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:grid-rows-1">
          <div className="relative min-h-0">
            <svg viewBox="0 0 800 800" className="cy-speedmask pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
              <g className="cy-speed" stroke={INK} strokeLinecap="round">
                {SPEED.map((l, n) => <line key={n} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} strokeWidth={l.w} opacity=".5" />)}
              </g>
            </svg>
            <svg viewBox="0 0 800 800" className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="xMidYMid meet">
              <RoomDefs />
              <g className="cy-world">
                {checks.map((c, i) => (
                  <g key={c.check} className={`cy-room cy-room-${i}`}>
                    <g transform={`translate(${CX} ${topOf(i, false)})`}>
                      {floorArt(i, c, ja)}
                      <g transform={`translate(${SFX_AT[i][0]} ${SFX_AT[i][1]})`}>
                        <g className={`cy-sfx cy-sfx-${i}`}>
                          <text className="cy-sfx-text" textAnchor="middle" fontSize={ja ? 23 : 30} fill={ACCENT[c.status].solid} transform="rotate(-8)">{sfxFor(c)}</text>
                        </g>
                      </g>
                    </g>
                  </g>
                ))}
              </g>
            </svg>
            <nav className="cy-nav absolute bottom-3 left-3 flex gap-2 md:bottom-4 md:left-4" aria-hidden>
              {checks.map((c, i) => (
                <button key={c.check} type="button" tabIndex={-1} onClick={() => goTo.current(i)} title={ja ? FLOORS[i].ja : FLOORS[i].en}
                  className="jp grid h-9 w-9 place-items-center border-2 border-ink bg-white text-[17px] font-black leading-none shadow-[2px_2px_0_#141414] transition-transform hover:-translate-y-0.5 data-[active=true]:bg-ink data-[active=true]:text-white"
                  style={{ borderBottomWidth: 5, borderBottomColor: ACCENT[c.status].solid }}>
                  {FLOORS[i].kanji}
                </button>
              ))}
            </nav>
            <div className="absolute left-3 top-3 border-2 border-ink bg-white px-2.5 py-1 shadow-[3px_3px_0_#141414] md:left-4 md:top-4">
              <div className="num text-[15px] leading-none tracking-[0.12em]">{ja ? "サイバー対策" : "CYBER POSTURE"}</div>
              <div className="mt-0.5 font-mono text-[11px] text-ink-3">{data.domain}</div>
            </div>
          </div>

          <div className="relative min-h-0 px-4 pb-4 md:px-9 md:py-8">
            <div className="cy-card absolute inset-0 flex items-center px-4 pb-4 md:px-9 md:py-8"><div className="cy-bubble w-full p-5 md:p-7">
              <p className="num text-[15px] tracking-[0.14em] text-hinomaru">{ja ? "外から見える「玄関」" : "THE FRONT DOOR, SEEN FROM OUTSIDE"}</p>
              <h3 className="jp mt-2 text-[24px] font-bold leading-tight md:text-[28px]">{ja ? <>{data.domain}の4フロアを<br />開けて確認します。</> : <>Four floors of {data.domain}, opened one at a time.</>}</h3>
              <p className={`mt-3 text-[13.5px] leading-relaxed text-ink-3 ${ja ? "jp" : ""}`}>{ja ? "受動的な確認のみ：DNSレコード、TLS接続1回、トップページの取得1回。侵入や負荷をかける試験は行いません。" : "Passive checks only: DNS records, one TLS handshake, one request for the home page. No break-in attempts and no load tests."}</p>
              <p className="cy-hint mt-4 text-[12px] font-semibold text-ink-2">{ja ? "スクロールして分解 ↓" : "Scroll to take it apart ↓"}</p>
            </div></div>
            {checks.map((c, i) => (
              <div key={c.check} className="cy-card absolute inset-0 flex items-center px-4 pb-4 md:px-9 md:py-8"><div className="cy-bubble w-full p-5 md:p-7">
                <CheckBody i={i} c={c} ja={ja} evidence={data.evidence_id} onEvidence={onEvidence} focusable={false} />
              </div></div>
            ))}
            <div className="cy-card absolute inset-0 flex items-center px-4 pb-4 md:px-9 md:py-8"><div className="cy-bubble w-full p-5 md:p-7">
              <p className="num text-[15px] tracking-[0.14em] text-ink-3">{ja ? "判定" : "VERDICT"}</p>
              <h3 className="jp mt-1 text-[26px] font-bold leading-tight">
                {failed + warned === 0 ? (ja ? "4項目すべて問題なし" : "All four floors are sound") : ja ? `${failed}件の不備・${warned}件の要注意` : `${failed} failed · ${warned} to watch`}
              </h3>
              <ul className="mt-4 space-y-2">
                {checks.map((c, i) => (
                  <li key={c.check} className="flex items-center gap-3 border-t border-line pt-2 text-[13px]">
                    <span className="jp w-6 text-[18px] font-black" style={{ color: ACCENT[c.status].solid }}>{FLOORS[i].kanji}</span>
                    <span className="min-w-0 flex-1 truncate">{ja ? FLOORS[i].ja : FLOORS[i].en}</span>
                    <Stamp status={c.status} ja={ja} />
                  </li>
                ))}
              </ul>
              <button tabIndex={-1} onClick={() => onEvidence(data.evidence_id)} className="mt-4 rounded border-2 border-ink px-2 py-0.5 font-mono text-[11px] font-semibold hover:bg-ink hover:text-white">{data.evidence_id} ↗</button>
            </div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
