import { Router } from "express";
import { db, apiKeysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

const router = Router();

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;

    const keys = await db.select().from(apiKeysTable)
      .where(eq(apiKeysTable.workspaceId as any, workspace.id));

    res.json(keys.map(k => ({
      id: k.id,
      name: k.name,
      keyPreview: k.keyPreview,
      workspaceId: k.workspaceId,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    })));
  } catch (err) {
    req.log.error(err, "Error listing API keys");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    const secret = `rf_${randomUUID().replace(/-/g, "")}`;
    const keyHash = hashKey(secret);
    const keyPreview = `rf_${secret.slice(3, 11)}...`;

    const [key] = (await db.insert(apiKeysTable).values({
      workspaceId: workspace.id,
      name,
      keyHash,
      keyPreview,
    }).returning()) as any;

    res.status(201).json({
      id: key.id,
      name: key.name,
      keyPreview: key.keyPreview,
      secret,
      workspaceId: key.workspaceId,
      createdAt: key.createdAt,
    });
  } catch (err) {
    req.log.error(err, "Error creating API key");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const id = req.params.id as string;

    const [key] = await db.select().from(apiKeysTable)
      .where(and(eq(apiKeysTable.id as any, id), eq(apiKeysTable.workspaceId as any, workspace.id)))
      .limit(1);

    if (!key) {
      res.status(404).json({ error: "API key not found" });
      return;
    }

    await db.delete(apiKeysTable).where(eq(apiKeysTable.id as any, id));
    res.json({ message: "API key deleted" });
  } catch (err) {
    req.log.error(err, "Error deleting API key");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;



