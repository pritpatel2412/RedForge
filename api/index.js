// Initialize seed only once per warm runtime.
let seeded = false;
const handler = async (req, res) => {
    try {
        const bundledHandlerPath = "../artifacts/api-server/dist/handler.mjs";
        const { default: bundledHandler } = await import(bundledHandlerPath);
        return bundledHandler(req, res);
    }
    catch (err) {
        try {
            // Dev fallback when dist bundle is not built yet.
            if (!seeded) {
                const { seedAdminAccount } = await import("../artifacts/api-server/src/lib/seed.js");
                await seedAdminAccount();
                seeded = true;
            }
            const { default: app } = await import("../artifacts/api-server/src/app.js");
            return app(req, res);
        }
        catch (fallbackErr) {
            return res.status(500).json({
                error: "API bootstrap failure",
                message: "Check DATABASE_URL and other required server environment variables.",
                detail: fallbackErr?.message || err?.message || "Unknown bootstrap error",
            });
        }
    }
};
export default handler;
