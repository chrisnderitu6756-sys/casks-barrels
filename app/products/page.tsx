import { ProductExplorer } from "@/components/products/product-explorer";
import { RangeGaps } from "@/components/products/range-gaps";
import { getDashboardData } from "@/lib/data/source";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { accounts, orders, products } = await getDashboardData();
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
