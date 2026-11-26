import { VisitForm } from "@/components/visits/visit-form";

export default function VisitsPage() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="font-display text-3xl text-ink">Log a visit.</h1>
      <p className="mt-2 mb-6 text-muted">Quick notes from the floor. Takes under a minute.</p>
      <VisitForm />
    </div>
  );
}
