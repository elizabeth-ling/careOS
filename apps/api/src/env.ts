import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(apiRoot, "../..");

// A root .env is optional: real environment variables win over it, and in local
// development the defaults below match .env.example.
const envFile = path.join(repoRoot, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const isProduction = process.env.NODE_ENV === "production";

const booleanFlag = z.enum(["true", "false"]).transform((value) => value === "true");

const schema = z.object({
  // Hosted environments must set these explicitly: no fallback to the local
  // database, and no destructive demo reset unless it is switched on.
  DATABASE_URL: isProduction
    ? z.string().min(1)
    : z.string().min(1).default("postgres://careos:careos@localhost:5432/careos"),
  DEMO_MODE: booleanFlag.default(isProduction ? false : true),
  PORT: z.coerce.number().int().positive().default(8787),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  AI_MODE: z.enum(["simulated", "live"]).default("simulated"),
  WEB_ORIGIN: z.string().min(1).default("http://localhost:5173"),
});

const parsed = schema.parse(process.env);

export const env = {
  ...parsed,
  // Resolved against apps/api so the location doesn't depend on the working directory.
  UPLOAD_DIR: path.resolve(apiRoot, parsed.UPLOAD_DIR),
};
