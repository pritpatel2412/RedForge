// Initialize seed only once per warm runtime.
let seeded = false;

const handler = async (req: any, res: any) => {
  try {
    if (!seeded) {
      const { seedAdminAccount } = await import("../artifacts/api-server/src/lib/seed");
      await seedAdminAccount();
      seeded = true;
    }

    const { default: app } = await import("../artifacts/api-server/src/app");
    return (app as any)(req, res);
  } catch (err: any) {
    // Avoid FUNCTION_INVOCATION_FAILED without context.
    console.error("API bootstrap failure:", err);
    return res.status(500).json({
      error: "API bootstrap failure",
      message: "Check DATABASE_URL and other required server environment variables.",
      detail: err?.message || "Unknown bootstrap error",
    });
  }
};

export default handler;
