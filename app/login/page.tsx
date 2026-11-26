import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { Card } from "@/components/ui";

async function authenticate(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=invalid");
    }
    throw error; // includes the redirect thrown on success
  }
}

const inputClass =
  "mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-wine focus:ring-2 focus:ring-wine-soft";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cb-logo.jpg"
            alt="Casks & Barrels"
            className="mx-auto mb-4 h-24 w-24 rounded-2xl object-contain ring-1 ring-line"
          />
          <h1 className="font-display text-3xl text-ink">Casks &amp; Barrels</h1>
          <p className="mt-1 text-sm text-muted">Account intelligence</p>
        </div>

        <Card className="p-6">
          <form action={authenticate} className="space-y-4">
            <label className="block text-sm font-medium text-ink">
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@casksandbarrels.demo"
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-ink">
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={inputClass}
              />
            </label>

            {error ? (
              <p role="alert" className="rounded-lg bg-wine-soft px-3 py-2 text-sm text-wine">
                Incorrect email or password. Please try again.
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-lg bg-wine px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Sign in
            </button>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs text-muted">
          A solution by Simply Done Africa
        </p>
      </div>
    </main>
  );
}
