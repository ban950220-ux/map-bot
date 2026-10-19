import { spawn } from "node:child_process";
import "./sites-env.mjs";
// UI preview only: parent process env does not populate Cloudflare bindings.
// Use check-nearby.mjs --live for memory-only credential-backed API checks.
const args = process.argv.slice(2);
if (!args.some(arg => arg === "--port" || arg === "-p" || arg.startsWith("--port="))) args.push("--port", "5173");
const child = spawn(process.execPath, ["node_modules/vinext/dist/cli.js", "dev", ...args], { env: process.env, stdio: "inherit", windowsHide: true });
child.on("error", () => { console.error("Unable to start vinext; run npm run install:ci first."); process.exitCode = 1; });
child.on("exit", (code, signal) => process.exit(code ?? (signal === "SIGINT" ? 130 : 1)));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
