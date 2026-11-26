import { ProductExplorer } from "@/components/products/product-explorer";
import { RangeGaps } from "@/components/products/range-gaps";

export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <header>
        <h1 className="font-display text-3xl text-ink">What the range is telling us.</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Which wines lead, which are slowing, and where a customer's range differs from similar customers. Based on
          invoiced sales.
        </p>
      </header>
      <ProductExplorer />
      <RangeGaps />
    </div>
  );
}
