"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/brand";
import { TODAY } from "@/lib/dates";
import { useStore } from "@/lib/store";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state } = useStore();
  const due = state.tasks.filter((t) => t.due <= TODAY).length;

  const links = [
    { href: "/today", label: "Today", count: due },
    { href: "/board", label: "Firm board" },
    { href: "/capture", label: "Paste notes" },
  ];

  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <span className="nav-brand">{APP_NAME}</span>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link${pathname.startsWith(l.href) ? " active" : ""}`}
            aria-current={pathname.startsWith(l.href) ? "page" : undefined}
          >
            {l.label}
            {l.count ? <span className="nav-count">{l.count}</span> : null}
          </Link>
        ))}
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
