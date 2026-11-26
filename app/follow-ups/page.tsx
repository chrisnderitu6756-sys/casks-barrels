import { FollowUpBoard } from "@/components/follow-ups/follow-up-board";
import { getAccounts, getFollowUps, getReps, getVisits, visitLogging } from "@/lib/data/source";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const [followUps, accounts, reps, visits] = await Promise.all([
    getFollowUps(),
    getAccounts(),
    getReps(),
    getVisits(),
  ]);
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
