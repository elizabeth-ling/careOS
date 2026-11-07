import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env";
import { PrismaClient } from "./generated/prisma/client";

/** The one PrismaClient for the whole process. */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
