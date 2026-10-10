import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readdirSync } from "node:fs";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import "./sites-env.mjs";

// This is a Linux cloud bootstrap check, not a provider or login test.
assert.equal(process.platform, "linux", "Run this smoke check in a Linux cloud container.");
assert.ok(process.env.npm_execpath, "Use npm run smoke:cloud.");
assert.ok(!readdirSync(".").some(name => /^(?:\.env|\.dev\.vars)(?:\.|$)/.test(name) && name !== ".env.example"),
  "Use a clean checkout without .env/.dev.vars files for the secret-free smoke check.");

const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/^(?:NAVER_|KAKAO_|GOOGLE_|CLOUDFLARE_API_|CF_API_)/.test(key)) delete env[key];
}
env.CLOUDFLARE_CF_FETCH_ENABLED = "false";
env.WRANGLER_SEND_METRICS = "false";
env.CI = "1";

async function smoke(command) {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const { port } = socket.address();
  await new Promise(resolve => socket.close(resolve));
  const child = spawn(process.execPath, [process.env.npm_execpath, "run", command, "--", "--port", String(port),
    ...(command === "dev" ? ["--hostname", "127.0.0.1"] : [])], {
    env, detached: true, stdio: "ignore",
  });
  const closed = once(child, "close");
  let exited = false;
  let spawnError;
  child.on("exit", () => { exited = true; });
  child.on("error", error => { spawnError = error; });
  try {
    const base = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 60000;
    let response;
    while (Date.now() < deadline && !exited && !spawnError) {
      try {
        response = await fetch(base, { redirect: "manual", signal: AbortSignal.timeout(5000) });
        break;
      } catch { await delay(250); }
    }
    assert.ok(response, `${command}: exited early or no HTTP response within 60s; run npm run ${command} to diagnose.`);
    assert.equal(response.status, 200, `${command}: root must render without provider credentials`);
    assert.match(await response.text(), /가까운 한 끼/);
    const status = await fetch(`${base}/api/status`, { signal: AbortSignal.timeout(5000) });
    assert.equal(status.status, 401, `${command}: anonymous API must remain protected`);
    await status.arrayBuffer();
    console.log(`PASS ${command}: root 200, anonymous API 401, no provider credentials`);
  } finally {
    if (child.pid) {
      try { process.kill(-child.pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
      const timer = setTimeout(() => {
        try { process.kill(-child.pid, "SIGKILL"); } catch { /* Already closed. */ }
      }, 3000);
      try { await closed; } finally { clearTimeout(timer); }
    }
  }
}

await smoke("dev");
await smoke("start");
