import { productById } from "@/lib/data/sample-data";
import { shortDate } from "@/lib/format";
import type { Order } from "@/lib/types";

const SERIES_COLORS = ["#7b2d3a", "#a9803a", "#3f7d5a", "#7c8aa0", "#c0552f"];

/** Quantity per order over time, one line per product. Pure inline SVG. */
export function RhythmChart({ orders }: { orders: Order[] }) {
  const sorted = [...orders].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length === 0) {
    return <p className="text-sm text-muted">No completed orders yet.</p>;
  }
  const qty = (o: Order, pid: string) =>
    o.lines.filter((l) => l.productId === pid).reduce((s, l) => s + l.quantity, 0);
  const pids = [...new Set(sorted.flatMap((o) => o.lines.map((l) => l.productId)))];

  const W = 760;
  const H = 300;
  const m = { top: 28, right: 24, bottom: 44, left: 44 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const maxRaw = Math.max(1, ...sorted.flatMap((o) => pids.map((p) => qty(o, p))));
  const step = maxRaw > 30 ? 10 : 5;
  const maxY = Math.ceil(maxRaw / step) * step;
  const n = sorted.length;
  const x = (i: number) => m.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => m.top + ih - (v / maxY) * ih;
  const ticks = Array.from({ length: maxY / step + 1 }, (_, i) => i * step);

  // "last 2 vs prior" shading band over the final two orders
  const recentStart = n >= 2 ? x(n - 2) : x(n - 1);
  const bandX = Math.max(m.left, recentStart - 14);
  const bandW = Math.min(W - m.right, x(n - 1) + 14) - bandX;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Bottles per completed order, by product">
        <rect x={bandX} y={m.top - 12} width={bandW} height={ih + 12} rx={10} fill="#f3ead6" opacity={0.7} />
        <text x={bandX + bandW / 2} y={m.top - 16} textAnchor="middle" fontSize={11} fill="#a9803a">
          Last 2 vs prior {Math.max(0, Math.min(6, n - 2))}
        </text>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} stroke="#e8e2d8" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={m.left - 10} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#9a8f82">
              {t}
            </text>
          </g>
        ))}
        {sorted.map((o, i) => (
          <text key={o.id} x={x(i)} y={H - m.bottom + 22} textAnchor="middle" fontSize={11} fill="#6f655a">
            {shortDate(o.date)}
          </text>
        ))}
        {pids.map((pid, si) => {
          const color = SERIES_COLORS[si % SERIES_COLORS.length];
          const pts = sorted.map((o, i) => ({ i, v: qty(o, pid) })).filter((p) => p.v > 0);
          const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
          return (
            <g key={pid}>
              <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p) => (
                <circle
                  key={p.i}
                  cx={x(p.i)}
                  cy={y(p.v)}
                  r={4}
                  fill="#fff"
                  stroke={color}
                  strokeWidth={2}
                  aria-label={`${productById(pid)?.name}: ${p.v} bottles on ${shortDate(sorted[p.i]!.date)}`}
                />
              ))}
              {pts.length > 0 && (
                <text x={x(pts[pts.length - 1]!.i)} y={y(pts[pts.length - 1]!.v) - 10} textAnchor="middle" fontSize={11} fontWeight={600} fill={color}>
                  {pts[pts.length - 1]!.v}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
        {pids.map((pid, si) => (
          <li key={pid} className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-5 rounded" style={{ background: SERIES_COLORS[si % SERIES_COLORS.length] }} />
            {productById(pid)?.name ?? pid}
          </li>
        ))}
      </ul>
    </div>
  );
}
