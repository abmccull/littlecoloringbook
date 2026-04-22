import Link from "next/link";
import { BrandLogo } from "../../components/brand-logo";
import { SignOutButton } from "../../components/auth/sign-out-button";
import { requireCustomerSession } from "../../lib/auth";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCustomerSession("/account");

  return (
    <div className="account-shell">
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="your account" />
        <nav className="topbar-nav">
          <Link className="topbar-link" href="/account">
            Overview
          </Link>
          <Link className="topbar-link" href="/account/orders">
            Orders
          </Link>
          <Link className="topbar-link" href="/account/tickets">
            Support
          </Link>
          <Link className="topbar-link" href="/account/settings">
            Settings
          </Link>
          <SignOutButton className="topbar-link">Sign out</SignOutButton>
        </nav>
      </header>
      <main className="account-main">
        <p className="muted account-greeting">Signed in as {session.email}</p>
        {children}
      </main>
    </div>
  );
}
