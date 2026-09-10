import { spawn } from "node:child_process";
// UI preview only: parent process env does not populate Cloudflare bindings.
// Use check-nearby.mjs --live for memory-only credential-backed API checks.
const child = spawn(process.execPath, ["node_modules/vinext/dist/cli.js", "dev", "--port", "5173"], { env: process.env, stdio: "inherit", windowsHide: true });
child.on("exit", code => process.exit(code || 0));
process.on("SIGINT", () => child.kill("SIGINT"));
