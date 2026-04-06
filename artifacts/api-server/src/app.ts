import express, { type Application, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import compression from "compression";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

// Use Application type from express instead of Express for better compatibility in 5.x
const app: Application = express();

// ── Compression — skip SSE, lower threshold for faster small responses ─────
app.use(compression({
  level: 4,           // Faster compression
  threshold: 512,     // Compress more aggressively
  filter: (req: Request, res: Response) => {
    if (req.headers['accept']?.includes('text/event-stream')) return false;
    return compression.filter(req, res);
  }
}));

// ── Global performance headers ─────────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
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
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "GET") {
    // Short cache: 10s for lists, 0 for auth/user
    const noCache = ["/api/auth", "/api/me", "/api/workspace"];
    const isNoCache = noCache.some(p => req.path.startsWith(p.replace("/api", "")));
    if (!isNoCache) {
      res.setHeader("Cache-Control", "private, max-age=10, stale-while-revalidate=30");
    } else {
      res.setHeader("Cache-Control", "no-store");
    }
  }
  next();
});

app.use("/api", router);

export default app;
