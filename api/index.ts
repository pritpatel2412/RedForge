// Initialize seed only once per warm runtime.
let seeded = false;

const handler = async (req: any, res: any) => {
  try {
    const bundledHandlerPath = "../artifacts/api-server/dist/handler.mjs";
    const { default: bundledHandler } = await import(bundledHandlerPath);
    return (bundledHandler as any)(req, res);
  } catch (err: any) {
    try {
      // Dev fallback when dist bundle is not built yet.
      if (!seeded) {
        const { seedAdminAccount } = await import("../artifacts/api-server/src/lib/seed.js");
        await seedAdminAccount();
        seeded = true;
      }

      const { default: app } = await import("../artifacts/api-server/src/app.js");
      return (app as any)(req, res);
    } catch (fallbackErr: any) {
      return res.status(500).json({
        error: "API bootstrap failure",
        message: "Check DATABASE_URL and other required server environment variables.",
        detail: fallbackErr?.message || err?.message || "Unknown bootstrap error",
      });
    }
  }
};

export default handler;
