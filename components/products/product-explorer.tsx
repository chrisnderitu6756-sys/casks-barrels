"use client";

import { useMemo, useState } from "react";
import { kes } from "@/lib/format";
import type { Account, Order, Product } from "@/lib/types";
import { Badge, Card, SectionHeader, cx } from "@/components/ui";

interface Row {
  id: string;
  name: string;
  supplier: string;
  units: number;
  net: number;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-wine bg-wine-soft text-wine" : "border-line bg-surface text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function ProductList({ rows, max, tone, empty }: { rows: Row[]; max: number; tone: "wine" | "gold"; empty: string }) {
  if (rows.length === 0) return <p className="px-5 py-6 text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((r, i) => (
        <li key={r.id} className="px-5 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="w-5 pt-0.5 text-sm tabular-nums text-faint">{i + 1}</span>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{r.name}</div>
                <div className="mt-1">
                  <Badge>{r.supplier}</Badge>
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-semibold tabular-nums text-ink">{kes(r.net)}</div>
              <div className="text-xs tabular-nums text-muted">{r.units.toLocaleString("en-KE")} units</div>
            </div>
          </div>
          <svg className="mt-2.5 block h-2 w-full" viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden>
            <rect width="100" height="2" rx="1" className="fill-surface-2" />
            <rect
              width={max > 0 ? Math.max((r.net / max) * 100, r.net > 0 ? 1.5 : 0) : 0}
              height="2"
              rx="1"
              className={tone === "wine" ? "fill-wine" : "fill-gold"}
            />
          </svg>
        </li>
      ))}
    </ul>
  );
}

export function ProductExplorer({
  accounts,
  orders,
  products,
}: {
  accounts: Account[];
  orders: Order[];
  products: Product[];
}) {
  const [type, setType] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Customer-type options are derived from the accounts prop at runtime —
  // distinct, sorted, de-duplicated — never hard-coded.
  const types = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.type).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [accounts],
  );

  const { leading, slower, max, accountCount } = useMemo(() => {
    const ids = new Set(accounts.filter((a) => !type || a.type === type).map((a) => a.id));
    const totals = new Map<string, { units: number; net: number }>();
    for (const o of orders) {
      if (!ids.has(o.accountId)) continue;
      for (const l of o.lines) {
        const t = totals.get(l.productId) ?? { units: 0, net: 0 };
        t.units += l.quantity;
        t.net += l.netAmount;
        totals.set(l.productId, t);
      }
    }
    const q = search.trim().toLowerCase();
    const rows: Row[] = products
      .filter((p) => q === "" || p.name.toLowerCase().includes(q))
      .map((p) => ({
        id: p.id,
        name: p.name,
        supplier: p.supplier,
        units: totals.get(p.id)?.units ?? 0,
        net: totals.get(p.id)?.net ?? 0,
      }))
      .sort((a, b) => b.net - a.net);
    const split = Math.ceil(rows.length / 2);
    return {
      leading: rows.slice(0, split),
      slower: rows.slice(split).reverse(),
      max: rows[0]?.net ?? 0,
      accountCount: ids.size,
    };
  }, [type, search, accounts, orders, products]);

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Leading products and slower movers"
        intro="Ranked by invoiced net sales across all orders. Narrow by customer type to see what moves where."
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">Type</span>
          <Chip active={type === null} onClick={() => setType(null)}>All</Chip>
          {types.map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(type === t ? null : t)}>{t}</Chip>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products by name…"
          aria-label="Search products by name"
          className="w-full max-w-xs rounded-full border border-line bg-surface px-4 py-1.5 text-xs text-ink placeholder:text-faint focus:border-wine focus:outline-none"
        />
        <span className="text-xs text-faint">{accountCount} customer{accountCount === 1 ? "" : "s"} in view</span>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h3 className="font-display text-lg text-ink">Leading products</h3>
            <p className="text-xs text-muted">Top sellers by net sales</p>
          </div>
          <ProductList rows={leading} max={max} tone="wine" empty="No invoiced sales for this selection." />
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h3 className="font-display text-lg text-ink">Slower movers</h3>
            <p className="text-xs text-muted">Lowest sellers, slowest first, same scale as the leaders</p>
          </div>
          <ProductList rows={slower} max={max} tone="gold" empty="No invoiced sales for this selection." />
        </Card>
      </div>
    </section>
  );
}
