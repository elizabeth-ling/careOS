// Runs the web dev server once apps/web exists (Task 2). Until then it reports
// that and exits cleanly, so `npm run dev` keeps the API running on its own.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const webPackage = new URL("../apps/web/package.json", import.meta.url);

if (!existsSync(webPackage)) {
  console.log("apps/web does not exist yet (created in Task 2). Running the API only.");
  process.exit(0);
}

const child = spawn("npm", ["run", "dev", "-w", "apps/web"], { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 0));
