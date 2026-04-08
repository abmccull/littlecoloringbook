import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export type AdminSession = {
  userId: string;
  email: string | null;
  firstName: string | null;
};

export function isClerkConfigured() {
  return Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

function getAdminEmailAllowlist() {
  return (process.env.CLERK_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

async function resolveAdminSession() {
  if (!isClerkConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return null;
    }

    return {
      userId: "dev-admin",
      email: "dev@littlecolorbook.local",
      firstName: "Dev",
    } satisfies AdminSession;
  }

  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const user = await currentUser();
  const primaryEmail =
    user?.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null;
  const allowlist = getAdminEmailAllowlist();

  if (allowlist.length > 0 && primaryEmail && !allowlist.includes(primaryEmail.toLowerCase())) {
    throw new Error("Forbidden");
  }

  return {
    userId,
    email: primaryEmail,
    firstName: user?.firstName ?? null,
  } satisfies AdminSession;
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await resolveAdminSession();

  if (!session) {
    redirect("/sign-in?redirect_url=/admin");
  }

  return session;
}

export async function requireAdminApiSession(): Promise<AdminSession | null> {
  return resolveAdminSession();
}
