import "server-only";

import { redirect } from "next/navigation";
import {
  findCustomerUserLinkByStackUserId,
  linkStackUserToCustomerByEmail,
  type CustomerUserLink,
} from "@littlecolorbook/db";
import { getCurrentAuthUser, isAuthConfigured } from "./auth-client";

export type AdminSession = {
  userId: string;
  email: string | null;
  firstName: string | null;
};

export type CustomerSession = {
  authUserId: string;
  customerId: string;
  email: string;
  displayName: string | null;
  link: CustomerUserLink;
};

function getAdminEmailAllowlist() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

async function resolveAdminSession(): Promise<AdminSession | null> {
  if (!isAuthConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return null;
    }
    return {
      userId: "dev-admin",
      email: "dev@littlecolorbook.local",
      firstName: "Dev",
    };
  }

  const user = await getCurrentAuthUser();
  if (!user) return null;

  const email = user.primaryEmail?.toLowerCase() ?? null;
  const allowlist = getAdminEmailAllowlist();
  if (allowlist.length > 0) {
    if (!email || !allowlist.includes(email)) {
      return null;
    }
  }

  return {
    userId: user.id,
    email,
    firstName: user.displayName ?? null,
  };
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await resolveAdminSession();
  if (!session) {
    redirect("/sign-in?after_auth_return_to=/admin");
  }
  return session;
}

export async function requireAdminApiSession(): Promise<AdminSession | null> {
  return resolveAdminSession();
}

export function isAdminAuthConfigured() {
  return isAuthConfigured() && getAdminEmailAllowlist().length > 0;
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const user = await getCurrentAuthUser();
  if (!user) return null;

  const email = user.primaryEmail;
  if (!email) return null;

  const existing = await findCustomerUserLinkByStackUserId(user.id);
  const link =
    existing ??
    (await linkStackUserToCustomerByEmail({
      stackUserId: user.id,
      email,
      source: "self_signup",
    }));

  return {
    authUserId: user.id,
    customerId: link.customerId,
    email,
    displayName: user.displayName ?? null,
    link,
  };
}

export async function requireCustomerSession(returnTo = "/account"): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) {
    redirect(`/sign-in?after_auth_return_to=${encodeURIComponent(returnTo)}`);
  }
  return session;
}
