import { getMetaEnv } from "@littlecolorbook/shared/env";

export type TokenSource = {
  getToken(): Promise<string>;
};

class EnvTokenSource implements TokenSource {
  async getToken(): Promise<string> {
    const token = getMetaEnv().systemUserToken;
    if (!token) {
      throw new Error("META_SYSTEM_USER_TOKEN is not configured.");
    }
    return token;
  }
}

const defaultTokenSource: TokenSource = new EnvTokenSource();

export function getSystemUserToken(): Promise<string> {
  return defaultTokenSource.getToken();
}

export function createTokenSource(source: TokenSource): TokenSource {
  return source;
}
