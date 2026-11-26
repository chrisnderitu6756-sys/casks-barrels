import { ProductExplorer } from "@/components/products/product-explorer";
import { RangeGaps } from "@/components/products/range-gaps";
import { getDashboardData } from "@/lib/data/source";
import { getViewer, visibleAccountIds } from "@/lib/data/scope";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const viewer = await getViewer();
  const { accounts: allAccounts, orders: allOrders, products } = await getDashboardData();
  const visible = visibleAccountIds(viewer, allAccounts);
  const accounts = visible ? allAccounts.filter((a) => visible.has(a.id)) : allAccounts;
  const orders = visible ? allOrders.filter((o) => visible.has(o.accountId)) : allOrders;
  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <header>
        <h1 className="font-display text-3xl text-ink">What the range is telling us.</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Which wines lead, which are slowing, and where a customer's range differs from similar customers. Based on
          invoiced sales.
        </p>
      </header>
      <ProductExplorer accounts={accounts} orders={orders} products={products} />
      <RangeGaps accounts={accounts} orders={orders} products={products} />
    </div>
  );
}
