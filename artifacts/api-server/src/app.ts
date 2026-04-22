import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import compression from "compression";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { startContinuousAutopilot } from "./lib/autopilot.js";

/** When the Vite build output is present next to this package, serve it so deep links (/dashboard, /status) work behind a single Node process. */
function resolveSpaRoot(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = join(here, "..", "..", "redforge", "dist", "public");
  const indexHtml = join(candidate, "index.html");
  return existsSync(indexHtml) ? candidate : null;
}

const app = express();
startContinuousAutopilot();

// ── Compression — skip SSE, lower threshold for faster small responses ─────
app.use(compression({
  level: 4,           // Faster compression
  threshold: 512,     // Compress more aggressively
  filter: (req: any, res: any) => {
    if (req.headers['accept']?.includes('text/event-stream')) return false;
    return compression.filter(req, res);
  }
}));

// ── Global performance headers ─────────────────────────────────────────────
app.use((_req: any, res: any, next: any) => {
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Keep-Alive", "timeout=30, max=1000");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

app.use(
  (pinoHttp as any)({
    logger,
    serializers: {
      req(req: any) { 
        return { 
          id: req.id, 
          method: req.method, 
          url: req.url?.split("?")[0] 
        }; 
      },
      res(res: any) { 
        return { statusCode: res.statusCode }; 
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser(process.env.SESSION_SECRET || "redforge-session-secret"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Cache GET API responses briefly to reduce redundant DB hits ───────────
app.use("/api", (req: any, res: any, next: any) => {
  if (req.method === "GET") {
    // Do not cache auth or rapidly changing dashboard/project/scan data.
    const noCache = [
      "/api/auth",
      "/api/me",
      "/api/workspace",
      "/api/projects",
      "/api/scans",
      "/api/findings",
      "/api/dashboard",
      "/api/attack-graph",
      "/api/notifications",
    ];
    const isNoCache = noCache.some((p: string) => req.path.startsWith(p.replace("/api", "")));
    if (!isNoCache) {
      res.setHeader("Cache-Control", "private, max-age=10, stale-while-revalidate=30");
    } else {
      res.setHeader("Cache-Control", "no-store");
    }
  }
  next();
});

app.use("/api", router);

const spaRoot = resolveSpaRoot();
if (spaRoot) {
  logger.info({ spaRoot }, "Serving SPA from API server");
  app.use(express.static(spaRoot, { index: false }));
  app.use((req: any, res: any, next: any) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.sendFile(join(spaRoot, "index.html"), (err: Error | null) => {
      if (err) next(err);
    });
  });
}

export default app;

