/** Money as integer minor units + ISO 4217 code. No floats on money paths (ISO 4217: JPY 0, INR 2, USD 2). */
export type Ccy = "JPY" | "INR" | "USD";
export interface Money {
  minor: number;
  ccy: Ccy;
}

export const EXP: Record<Ccy, number> = { JPY: 0, INR: 2, USD: 2 };

export const m = (minor: number, ccy: Ccy): Money => ({ minor: Math.round(minor), ccy });
/** Major-unit literal, e.g. inr("14.50"). Parsed from a string so 14.50 never passes through binary float maths. */
export function major(value: string, ccy: Ccy): Money {
  const [whole, frac = ""] = value.split(".");
  const e = EXP[ccy];
  const digits = (frac + "0".repeat(e)).slice(0, e);
  const sign = whole.startsWith("-") ? -1 : 1;
  return m(sign * (Math.abs(parseInt(whole || "0", 10)) * 10 ** e + parseInt(digits || "0", 10)), ccy);
}

export function add(a: Money, b: Money): Money {
  if (a.ccy !== b.ccy) throw new Error(`currency mismatch ${a.ccy}/${b.ccy}`);
  return m(a.minor + b.minor, a.ccy);
}
export const sub = (a: Money, b: Money): Money => add(a, m(-b.minor, b.ccy));
export const times = (a: Money, qty: number): Money => m(a.minor * qty, a.ccy);
export const zero = (ccy: Ccy): Money => m(0, ccy);
export const sum = (xs: Money[], ccy: Ccy): Money => xs.reduce((s, x) => add(s, x), zero(ccy));

/** Rate is a decimal string: units of `to` per 1 unit of `from` (e.g. "1.7832" JPY per INR).
 *  Uses scaled-integer arithmetic; `ceil` protects the payee (the supplier is never short). */
export function convert(a: Money, to: Ccy, rate: string, rounding: "ceil" | "half_even" = "half_even"): Money {
  const [w, f = ""] = rate.split(".");
  const scale = 10 ** f.length;
  const rateInt = BigInt(w + f);
  // value_to_minor = a.minor * rate * 10^(exp_to - exp_from)
  const shift = EXP[to] - EXP[a.ccy];
  let num = BigInt(a.minor) * rateInt;
  let den = BigInt(scale);
  if (shift >= 0) num *= BigInt(10 ** shift);
  else den *= BigInt(10 ** -shift);
  const q = num / den;
  const r = num % den;
  if (r === 0n) return m(Number(q), to);
  if (rounding === "ceil") return m(Number(q + 1n), to);
  const twice = r * 2n;
  const up = twice > den || (twice === den && q % 2n === 1n);
  return m(Number(up ? q + 1n : q), to);
}

/** Largest-remainder allocation: shares always sum exactly to `total`. */
export function allocate(total: Money, weights: number[]): Money[] {
  const w = weights.map((x) => Math.max(0, x));
  const W = w.reduce((s, x) => s + x, 0);
  if (W === 0) return w.map(() => zero(total.ccy));
  const raw = w.map((x) => (total.minor * x) / W);
  const base = raw.map(Math.floor);
  let left = total.minor - base.reduce((s, x) => s + x, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    base[i] += 1;
    left -= 1;
  }
  return base.map((x) => m(x, total.ccy));
}

export function fmt(a: Money | null | undefined, lang: "en" | "ja" = "en", opts: { compact?: boolean } = {}): string {
  if (!a) return "—";
  const e = EXP[a.ccy];
  const locale = a.ccy === "INR" && lang === "en" ? "en-IN" : lang === "ja" ? "ja-JP" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency", currency: a.ccy, minimumFractionDigits: opts.compact ? 0 : e, maximumFractionDigits: opts.compact ? 0 : e,
    notation: opts.compact ? "compact" : "standard",
  }).format(a.minor / 10 ** e);
}

export const fmtQty = (n: number, lang: "en" | "ja" = "en") => new Intl.NumberFormat(lang === "ja" ? "ja-JP" : "en-US").format(n);

/** Self-check, run once in dev: mirrors acceptance tests QG-09 and QG-10. */
export function moneySelfCheck(): void {
  const c = convert(major("145200.00", "INR"), "JPY", "1.7832", "ceil");
  console.assert(c.minor === 258921, "QG-10 ceiling conversion", c);
  const parts = allocate(m(100001, "JPY"), [1, 1, 1]);
  console.assert(parts.reduce((s, p) => s + p.minor, 0) === 100001, "QG-09 allocation sums", parts);
  console.assert(major("14.50", "INR").minor === 1450, "major parse");
}
