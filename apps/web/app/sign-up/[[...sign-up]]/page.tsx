import Link from "next/link";

export default function SignUpPlaceholderPage() {
  return (
    <main className="form-shell">
      <div className="form-card">
        <span className="pill">Sign up</span>
        <h1>Sign-up is handled post-checkout.</h1>
        <p className="muted">
          After you purchase, we create your account automatically and email you a magic-link sign-in. There's no
          sign-up form to fill out.
        </p>
        <Link className="button button-secondary" href="/">
          Back to home
        </Link>
      </div>
    </main>
  );
}
