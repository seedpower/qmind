import "server-only";

import type { AuthInfo } from "@modelcontextprotocol/server";
import {
  envMcpApiKey,
  getStoredMcpKeyHash,
  hashSecret,
  secretsEqual,
} from "@/lib/settings";

function authInfo(token: string, clientId: string): AuthInfo {
  return {
    token,
    clientId,
    scopes: ["qmind"],
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
  };
}

export async function verifyMcpBearer(
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  const envKey = envMcpApiKey();
  const storedHash = await getStoredMcpKeyHash();
  if (!envKey && !storedHash) {
    return authInfo(bearerToken ?? "", "qmind-open");
  }
  if (!bearerToken) return undefined;
  if (envKey && secretsEqual(bearerToken, envKey)) {
    return authInfo(bearerToken, "qmind-env");
  }
  if (storedHash && secretsEqual(hashSecret(bearerToken), storedHash)) {
    return authInfo(bearerToken, "qmind-settings");
  }
  return undefined;
}
