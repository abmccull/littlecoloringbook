import "server-only";

import { getNeonAuth, isNeonAuthConfigured } from "./neon-auth";

export type AuthUser = {
  id: string;
  primaryEmail: string | null;
  displayName: string | null;
};

export function isAuthConfigured() {
  return isNeonAuthConfigured();
}

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  if (!isAuthConfigured()) return null;

  try {
    const auth = getNeonAuth();
    const result = await auth.getSession();
    const user = result?.data?.user;
    if (!user?.id) return null;
    return {
      id: user.id,
      primaryEmail: user.email ?? null,
      displayName: user.name ?? null,
    };
  } catch (error) {
    console.error("getCurrentAuthUser failed", error);
    return null;
  }
}
