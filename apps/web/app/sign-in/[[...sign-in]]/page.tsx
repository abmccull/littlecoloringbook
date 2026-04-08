import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <main className="form-shell">
        <div className="form-card">
          <span className="pill">Auth not configured yet</span>
          <h1>Admin sign-in is disabled locally.</h1>
          <p className="muted">
            Add Clerk environment variables to enable the hosted sign-in flow. Customer ordering still works without forced account creation.
          </p>
          <Link className="button button-secondary" href="/">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="form-shell">
      <div className="form-card" style={{ alignItems: "stretch" }}>
        <span className="pill">Admin access</span>
        <h1>Sign in</h1>
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      </div>
    </main>
  );
}
