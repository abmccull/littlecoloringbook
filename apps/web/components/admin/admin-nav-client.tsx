"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ href: string; label: string }>;
}> = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Orders" },
      { href: "/admin/tickets", label: "Tickets" },
      { href: "/admin/refunds", label: "Refunds" },
      { href: "/admin/broadcasts", label: "Broadcasts" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/admin/metrics", label: "Metrics" },
      { href: "/admin/metrics/cohorts", label: "Cohorts" },
      { href: "/admin/metrics/attribution", label: "Attribution" },
      { href: "/admin/ads", label: "Ads" },
    ],
  },
  {
    label: "Growth",
    items: [{ href: "/admin/growth", label: "Growth" }],
  },
];

function isLinkActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ sessionEmail }: { sessionEmail: string | null }) {
  const pathname = usePathname();

  return (
    <header className="admin-shell-header">
      <div className="admin-shell-header-top">
        <div className="admin-shell-brand-block">
          <Link className="admin-shell-brand" href="/admin">
            Little Color Book
          </Link>
          <p className="admin-shell-subtitle">Admin command center</p>
        </div>

        <div className="admin-shell-session">
          {sessionEmail ? <span className="admin-shell-session-email">{sessionEmail}</span> : null}
          <Link className="admin-shell-signout" href="/handler/sign-out">
            Sign out
          </Link>
        </div>
      </div>

      <div className="admin-shell-nav-groups">
        {NAV_GROUPS.map((group) => (
          <div className="admin-shell-nav-group" key={group.label}>
            <span className="admin-shell-nav-label">{group.label}</span>
            <div className="admin-shell-nav-links">
              {group.items.map((item) => (
                <Link
                  className={`admin-shell-nav-link ${isLinkActive(pathname, item.href) ? "is-active" : ""}`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}
