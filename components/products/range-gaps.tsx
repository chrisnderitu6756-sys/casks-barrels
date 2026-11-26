import type { Account, Order, Product } from "@/lib/types";
import { Avatar, Badge, Card, SectionHeader } from "@/components/ui";

/** A product is a gap when at least this share of similar accounts buy it. */
const MIN_SHARE = 0.5;
/** Need at least this many similar accounts for the comparison to mean anything. */
const MIN_PEERS = 3;

interface Gap {
  productId: string;
  k: number;
  n: number;
}

function computeGaps(accounts: Account[], orders: Order[]) {
  const bought = new Map<string, Set<string>>();
  for (const o of orders) {
    const set = bought.get(o.accountId) ?? new Set<string>();
    for (const l of o.lines) set.add(l.productId);
    bought.set(o.accountId, set);
  }

  return accounts
    .map((acc) => {
      const peers = accounts.filter((a) => a.id !== acc.id && a.type === acc.type);
      const mine = bought.get(acc.id) ?? new Set<string>();
      const gaps: Gap[] = [];
      if (peers.length >= MIN_PEERS) {
        const counts = new Map<string, number>();
        for (const p of peers) for (const pid of bought.get(p.id) ?? []) counts.set(pid, (counts.get(pid) ?? 0) + 1);
        for (const [productId, k] of counts) {
          if (!mine.has(productId) && k / peers.length >= MIN_SHARE) gaps.push({ productId, k, n: peers.length });
        }
        gaps.sort((a, b) => b.k - a.k);
      }
      return { acc, gaps };
    })
    .filter((r) => r.gaps.length > 0);
}

export function RangeGaps({
  accounts,
  orders,
  products,
}: {
  accounts: Account[];
  orders: Order[];
  products: Product[];
}) {
  const rows = computeGaps(accounts, orders);
  const productById = (id: string) => products.find((p) => p.id === id);
  return (
    <section className="space-y-5">
      <SectionHeader
        title="Range gaps by customer"
        intro="Upsell leads for the team to assess, not automated recommendations."
      />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No range gaps found against similar customers.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Not yet ordered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ acc, gaps }) => (
                <tr key={acc.id} className="align-top">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={acc.name} />
                      <div>
                        <div className="font-medium text-ink">{acc.name}</div>
                        <div className="text-xs text-muted">{acc.area ? `${acc.type} · ${acc.area}` : acc.type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <ul className="space-y-2">
                      {gaps.map((g) => (
                        <li key={g.productId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <Badge tone="gold">{productById(g.productId)?.name ?? g.productId}</Badge>
                          <span className="text-xs text-muted">
                            {g.k} of {g.n} similar customers stock this.
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-xs text-faint">
        Similar = same customer type. A gap needs at least {Math.round(MIN_SHARE * 100)}% of similar customers to have
        invoiced the product, and this customer never has.
      </p>
    </section>
  );
}
