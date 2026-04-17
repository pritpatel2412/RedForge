import app from "./app";
import { seedAdminAccount } from "./lib/seed.js";

let seeded = false;

export default async function handler(req: any, res: any) {
  if (!seeded) {
    await seedAdminAccount();
    seeded = true;
  }

  return (app as any)(req, res);
}
