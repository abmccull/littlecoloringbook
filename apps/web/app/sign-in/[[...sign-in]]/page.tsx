import Link from "next/link";
import { BrandLogo } from "../../../components/brand-logo";
import { MagicLinkForm } from "../../../components/auth/magic-link-form";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ after_auth_return_to?: string }>;
}) {
  const { after_auth_return_to } = await searchParams;
  const redirectTo = after_auth_return_to && after_auth_return_to.startsWith("/") ? after_auth_return_to : "/account";
  const authConfigured = Boolean(
    process.env.NEON_AUTH_BASE_URL &&
      process.env.NEON_AUTH_COOKIE_SECRET &&
      process.env.NEON_AUTH_COOKIE_SECRET.length >= 32,
  );

  return (
    <main className="form-shell">
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="sign in" />
      </header>

      <section className="portal-card">
        <span className="pill">Magic link</span>
        <h1>Sign in to your Little Color Book account.</h1>
        <p className="muted">
          Enter your email and we'll send you a one-click sign-in link. No passwords. Your account was created
          automatically when you purchased — the link works even if this is your first time signing in.
        </p>

        {authConfigured ? (
          <MagicLinkForm callbackURL={redirectTo} />
        ) : (
          <p className="muted">
            Sign-in is not configured yet. Set <code>NEON_AUTH_BASE_URL</code> and a 32+ char{" "}
            <code>NEON_AUTH_COOKIE_SECRET</code> in <code>.env</code>, then restart the dev server.
          </p>
        )}

        <p className="mini-note">
          Trouble signing in? Your old emailed portal links still work.{" "}
          <Link href="/">Back to home</Link>.
        </p>
      </section>
    </main>
  );
}
