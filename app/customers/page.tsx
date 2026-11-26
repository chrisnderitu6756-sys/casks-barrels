import { CustomersTable, type TableRow } from "@/components/health/customers-table";
import { getRows } from "@/components/health/portfolio";
import { getViewer } from "@/lib/data/scope";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const viewer = await getViewer();
  const rows: TableRow[] = (await getRows())
    .filter((r) => viewer.isManager || r.account.ownerId === viewer.repId)
    .map(({ account, health, ownerName, headlineName }) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    area: account.area ?? null,
    status: health.status,
    cycleDays: account.cycleDays,
    daysSinceLastOrder: health.daysSinceLastOrder,
    overdue: health.flags.includes("changed-cycle") || health.flags.includes("stopped"),
    headlineName,
    headlinePct: health.headline?.pctChange ?? null,
    ownerName,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <header>
        <h1 className="font-display text-4xl text-ink sm:text-5xl">Know the story behind every order.</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Every account, its usual rhythm and what has changed — drawn from invoiced sales, so each conversation starts
          with the evidence.
        </p>
      </header>
      <CustomersTable rows={rows} />
      <p className="text-sm text-faint">
        Uptake compares the last 2 completed orders with the prior 6, by product quantity. Learning accounts are
        excluded.
      </p>
    </div>
  );
}
