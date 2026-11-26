import { FollowUpBoard } from "@/components/follow-ups/follow-up-board";
import { getAccounts, getFollowUps, getReps, getVisits, visitLogging } from "@/lib/data/source";
import { getViewer, visibleAccountIds } from "@/lib/data/scope";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const viewer = await getViewer();
  const [allFollowUps, allAccounts, reps, allVisits] = await Promise.all([
    getFollowUps(),
    getAccounts(),
    getReps(),
    getVisits(),
  ]);
  const visible = visibleAccountIds(viewer, allAccounts);
  const accounts = visible ? allAccounts.filter((a) => visible.has(a.id)) : allAccounts;
  const followUps = visible ? allFollowUps.filter((f) => visible.has(f.accountId)) : allFollowUps;
  const visits = visible ? allVisits.filter((v) => visible.has(v.accountId)) : allVisits;
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl text-ink">Keep the conversation moving.</h1>
        <p className="mt-2 text-sm text-muted">Follow-ups that need an owner&apos;s attention.</p>
      </header>
      <FollowUpBoard
        followUps={followUps}
        accounts={accounts}
        reps={reps}
        visits={visits}
        visitLogging={visitLogging}
      />
    </div>
  );
}
