"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function SignOutButton({
  className,
  redirectTo = "/sign-in",
  children = "Sign out",
}: {
  className?: string;
  redirectTo?: string;
  children?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/sign-out", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{}",
        });

        if (!response.ok) {
          throw new Error(`Sign out failed with ${response.status}`);
        }
      } catch (error) {
        console.error("Sign out failed", error);
      }

      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <button className={className} disabled={isPending} onClick={handleSignOut} type="button">
      {isPending ? "Signing out..." : children}
    </button>
  );
}
