import { seedAdminAccount } from "../artifacts/api-server/src/lib/seed";
import app from "../artifacts/api-server/src/app";

// Initialize the database seed on first run
let seeded = false;

const handler = async (req: any, res: any) => {
  if (!seeded) {
    await seedAdminAccount();
    seeded = true;
  }
  return app(req, res);
};

export default handler;
