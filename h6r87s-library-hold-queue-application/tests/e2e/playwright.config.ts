import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(CONFIG_DIR, "../..");

export default defineConfig({
  testDir: CONFIG_DIR,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,

  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  webServer: [
    {
      cwd: ROOT,
      command:
        "node tests/e2e/reset-data.cjs && npm run dev --prefix repository_after/backend",
      env: {
        DATA_PATH: "tests/e2e/.data/data.json",
      },
      url: "http://127.0.0.1:3101/api/books",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      cwd: ROOT,
      command:
        "npm run dev --prefix repository_after/frontend -- --host 127.0.0.1 --port 5173",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],

  reporter: [["list"], ["html", { open: "never" }]],
});
