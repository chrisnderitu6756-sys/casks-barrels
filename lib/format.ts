// Shared formatting helpers. KES currency, warm short dates, signed percentages.

export function kes(n: number, opts: { decimals?: boolean } = {}): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: opts.decimals ? 2 : 0,
  }).format(n);
}

/** e.g. -0.64 -> "-64%", 0.26 -> "+26%". */
export function signedPct(fraction: number): string {
  const v = Math.round(fraction * 100);
  return `${v > 0 ? "+" : ""}${v}%`;
}

// Pin date formatting to the business timezone so the server and client agree
// (avoids React hydration mismatches) and dates always read as East Africa Time.
const TZ = "Africa/Nairobi";

/** e.g. "11 Sep". */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ });
}

/** e.g. "11 Sep 2026". */
export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}

export function daysBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 86_400_000);
}

export function initials(name: string): string {
  return name
    .replace(/[^A-Za-z& ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
