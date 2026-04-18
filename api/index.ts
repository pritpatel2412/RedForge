// Vercel Serverless Function entry point.
// The build step (esbuild) produces dist/handler.mjs — we just delegate to it.

const handler = async (req: any, res: any) => {
  try {
    const bundledHandlerPath = "../artifacts/api-server/dist/handler.mjs";
    const { default: bundledHandler } = await import(bundledHandlerPath);
    return (bundledHandler as any)(req, res);
  } catch (err: any) {
    return res.status(500).json({
      error: "API bootstrap failure",
      message: "The API server bundle failed to load. Check build logs.",
      detail: err?.message || "Unknown bootstrap error",
    });
  }
};

export default handler;
