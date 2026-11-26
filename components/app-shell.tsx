import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { SidebarNav, type NavItem } from "./sidebar-nav";

const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: "▦" },
  { href: "/customers", label: "Customers", icon: "☰" },
  { href: "/products", label: "Product insights", icon: "◳" },
  { href: "/visits", label: "Visit form", icon: "✎" },
  { href: "/follow-ups", label: "Follow-ups", icon: "✓" },
  { href: "/setup", label: "Setup", icon: "⚙" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar px-5 py-6 text-sidebar-ink md:flex">
        <div className="px-1">
          <div className="font-display text-2xl leading-tight">Casks &amp; Barrels</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-sidebar-muted">
            Account intelligence
          </div>
        </div>

        {/* usePathname lives in SidebarNav; Suspense lets it stream in so dynamic
            routes (e.g. /customers/[id]) can still prerender the shell. */}
        <Suspense
          fallback={
            <nav className="mt-8 flex flex-1 flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-muted"
                >
                  <span aria-hidden className="w-4 text-center">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </nav>
          }
        >
          <SidebarNav items={NAV} />
        </Suspense>

        <div className="mt-6 border-t border-white/10 pt-4 text-xs text-sidebar-muted">
          A solution by
          <br />
          <span className="text-sidebar-ink">Simply Done Africa</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-line bg-canvas/80 px-6 py-3 backdrop-blur">
          <span className="font-display text-lg text-ink md:hidden">Casks &amp; Barrels</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-2.5 py-1 text-xs font-medium text-gold">
            Demo · sample data
          </span>
        </header>
        <main className="flex-1 px-5 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
