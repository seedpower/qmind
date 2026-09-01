import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/mongodb";

const SETTINGS_ID = "app";

type SettingsRecord = {
  _id: string;
  mcpKeyHash?: string;
  mcpKeyPrefix?: string;
  mcpKeyCreatedAt?: Date;
};

export type McpKeyStatus = {
  configured: boolean;
  prefix: string | null;
  createdAt: string | null;
  envConfigured: boolean;
};

function settingsCollection() {
  return getDb().then((db) => db.collection<SettingsRecord>("settings"));
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function secretsEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function generateMcpApiKey() {
  return `qm_${randomBytes(24).toString("base64url")}`;
}

export function mcpKeyPrefix(key: string) {
  return `${key.slice(0, 8)}…`;
}

export function envMcpApiKey() {
  return process.env.MCP_API_KEY?.trim() || null;
}

export async function getStoredMcpKeyHash() {
  const col = await settingsCollection();
  const doc = await col.findOne({ _id: SETTINGS_ID });
  return doc?.mcpKeyHash || null;
}

export async function getMcpKeyStatus(): Promise<McpKeyStatus> {
  const col = await settingsCollection();
  const doc = await col.findOne({ _id: SETTINGS_ID });
  return {
    configured: Boolean(doc?.mcpKeyHash),
    prefix: doc?.mcpKeyPrefix ?? null,
    createdAt: doc?.mcpKeyCreatedAt?.toISOString() ?? null,
    envConfigured: Boolean(envMcpApiKey()),
  };
}

export async function rotateMcpApiKey() {
  const key = generateMcpApiKey();
  const now = new Date();
  const col = await settingsCollection();
  await col.updateOne(
    { _id: SETTINGS_ID },
    {
      $set: {
        mcpKeyHash: hashSecret(key),
        mcpKeyPrefix: mcpKeyPrefix(key),
        mcpKeyCreatedAt: now,
      },
    },
    { upsert: true },
  );
  return { key, prefix: mcpKeyPrefix(key), createdAt: now.toISOString() };
}

export async function revokeMcpApiKey() {
  const col = await settingsCollection();
  await col.updateOne(
    { _id: SETTINGS_ID },
    { $unset: { mcpKeyHash: "", mcpKeyPrefix: "", mcpKeyCreatedAt: "" } },
    { upsert: true },
  );
}
