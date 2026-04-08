import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <main className="form-shell">
        <div className="form-card">
          <span className="pill">Auth not configured yet</span>
          <h1>Sign-up is disabled locally.</h1>
          <p className="muted">
            Add Clerk environment variables to enable hosted sign-up. This project is currently set up for guest checkout plus portal-link access.
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
        <h1>Create account</h1>
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      </div>
    </main>
  );
}
