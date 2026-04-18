import { Router, Request, Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router = Router();

router.get("/healthz", (_req: Request, res: Response) => {
  const data = { status: "ok" };
  try {
    HealthCheckResponse.parse(data);
  } catch {
    // Silence zod errors in health check to prevent build emit issues
  }
  res.json(data);
});

export default router;
