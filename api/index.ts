import { seedAdminAccount } from "../artifacts/api-server/src/lib/seed";
import app from "../artifacts/api-server/src/app";

// Initialize the database seed on first run
let seeded = false;

const handler = async (req: any, res: any) => {
  if (!seeded) {
    // Ensure seeding is awaited in the serverless cold-start
    await seedAdminAccount();
    seeded = true;
  }
  // Cast Express app to any to allow direct call as a request handler
  return (app as any)(req, res);
};

export default handler;
