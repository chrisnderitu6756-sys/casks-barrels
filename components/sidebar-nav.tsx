"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className="mt-8 flex flex-1 flex-col gap-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cx(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            isActive(item.href)
              ? "bg-sidebar-active text-white"
              : "text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-ink",
          )}
        >
          <span aria-hidden className="w-4 text-center">
            {item.icon}
          </span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
