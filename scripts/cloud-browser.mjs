import path from "node:path";
import { projectRoot } from "./sites-env.mjs";

// Browser download and test runs must share the same writable cache.
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(projectRoot, ".sites-runtime", "browsers");
await import("../node_modules/playwright/cli.js");
