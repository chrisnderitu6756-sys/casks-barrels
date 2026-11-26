import { VisitForm } from "@/components/visits/visit-form";
import { getAccounts, getReps, getVisits } from "@/lib/data/source";
import { getViewer, visibleAccountIds } from "@/lib/data/scope";

export const dynamic = "force-dynamic";

export default async function VisitsPage() {
  const viewer = await getViewer();
  const [allAccounts, reps, allVisits] = await Promise.all([getAccounts(), getReps(), getVisits()]);
  const visible = visibleAccountIds(viewer, allAccounts);
  const accounts = visible ? allAccounts.filter((a) => visible.has(a.id)) : allAccounts;
  const visits = visible ? allVisits.filter((v) => visible.has(v.accountId)) : allVisits;
  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="font-display text-3xl text-ink">Log a visit.</h1>
      <p className="mt-2 mb-6 text-muted">Quick notes from the floor. Takes under a minute.</p>
      <VisitForm accounts={accounts} reps={reps} recentVisits={visits} />
    </div>
  );
}
