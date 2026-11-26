import { VisitForm } from "@/components/visits/visit-form";
import { getAccounts, getReps, getVisits } from "@/lib/data/source";

export const dynamic = "force-dynamic";

export default async function VisitsPage() {
  const [accounts, reps, visits] = await Promise.all([getAccounts(), getReps(), getVisits()]);
  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="font-display text-3xl text-ink">Log a visit.</h1>
      <p className="mt-2 mb-6 text-muted">Quick notes from the floor. Takes under a minute.</p>
      <VisitForm accounts={accounts} reps={reps} recentVisits={visits} />
    </div>
  );
}
