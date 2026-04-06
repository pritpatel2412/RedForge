// Load environment variables from project root .env
// This is a safety net — dotenv-cli in root scripts is the primary loader.
// Node 20.6+ supports --env-file flag; this fallback ensures compatibility.
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Navigate from artifacts/api-server/dist/ → project root
const envPath = resolve(__dirname, "..", "..", "..", "..", ".env");
try {
  const envFile = readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    // Only set if not already defined (CLI args / OS env take precedence)
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
} catch {
  // .env not found — rely on OS environment variables (production mode)
}

import app from "./app";
import { logger } from "./lib/logger";
import { seedAdminAccount } from "./lib/seed.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Run seed before accepting requests
seedAdminAccount().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
