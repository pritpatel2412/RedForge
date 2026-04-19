import { createHash } from "crypto";
import { db, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function resolveWorkspaceIdFromApiKey(raw: string | undefined): Promise<string | null> {
  if (!raw) return null;
  const token = raw.trim();
  if (!token) return null;

  const hashed = hashKey(token);
  const [apiKey] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.keyHash as any, hashed)).limit(1);
  if (!apiKey) return null;

  await db.update(apiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id as any, apiKey.id))
    .catch(() => {});

  return apiKey.workspaceId;
}

export async function getWorkspaceIdFromRequest(req: any): Promise<string | null> {
  const xApiKey = (req.headers["x-api-key"] as string | undefined) || undefined;
  const authHeader = (req.headers["authorization"] as string | undefined) || undefined;
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
  return resolveWorkspaceIdFromApiKey(xApiKey || bearer);
}

