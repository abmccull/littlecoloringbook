import Link from "next/link";

const GROWTH_TABS: Array<{ href: string; label: string }> = [
  { href: "/admin/growth", label: "Overview" },
  { href: "/admin/growth/ads", label: "Ads" },
  { href: "/admin/growth/campaigns", label: "Campaigns" },
  { href: "/admin/growth/organic", label: "Organic" },
  { href: "/admin/growth/inbox", label: "Inbox" },
  { href: "/admin/growth/proposals", label: "Proposals" },
  { href: "/admin/growth/journal", label: "Journal" },
  { href: "/admin/growth/intelligence", label: "Intelligence" },
];

export function GrowthNav() {
  return (
    <nav
      style={{
        display: "flex",
        gap: "4px",
        padding: "12px 24px 0",
        borderBottom: "1px solid var(--line)",
        background: "var(--color-paper)",
        overflowX: "auto",
      }}
      aria-label="Growth section navigation"
    >
      {GROWTH_TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          style={{
            padding: "8px 14px",
            borderRadius: "8px 8px 0 0",
            color: "var(--color-ink)",
            textDecoration: "none",
            fontSize: "0.9rem",
            fontWeight: 500,
            whiteSpace: "nowrap",
            borderBottom: "2px solid transparent",
          }}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
