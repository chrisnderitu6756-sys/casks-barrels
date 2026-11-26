import { FollowUpBoard } from "@/components/follow-ups/follow-up-board";

export default function FollowUpsPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl text-ink">Keep the conversation moving.</h1>
        <p className="mt-2 text-sm text-muted">Follow-ups that need an owner&apos;s attention.</p>
      </header>
      <FollowUpBoard />
    </div>
  );
}
