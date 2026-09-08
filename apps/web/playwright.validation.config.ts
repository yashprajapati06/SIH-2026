import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
import path from "node:path";

// Run the existing suites in development mode when the original production
// build is unavailable. Results do not certify the production build.
export default defineConfig({
  ...base,
  retries: 0,
  workers: 2,
  timeout: 30_000,
  globalTimeout: 300_000,
  reporter: [["json", { outputFile: "../../test-results/e2e.json" }]],
  outputDir: "../../test-results/e2e-artifacts",
  use: { ...base.use, baseURL: "http://127.0.0.1:3026", trace: "off" },
  webServer: [
    {
      command: `"${path.resolve(process.platform === "win32" ? "../../.venv/Scripts/python.exe" : "../../.venv/bin/python")}" -m uvicorn src.main:app --app-dir ../api --host 127.0.0.1 --port 8026`,
      url: "http://127.0.0.1:8026/api/v1/health",
      reuseExistingServer: false,
      env: { APP_ENV: "test", PERSISTENCE_BACKEND: "in_memory",
        SATELLITE_MODE: "test", NOTIFICATION_PROVIDER: "simulated",
        STORAGE_BACKEND: "local", AWS_EC2_METADATA_DISABLED: "true",
        CORS_ORIGINS: "http://127.0.0.1:3026" },
    },
    {
      command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 -p 3026",
      url: "http://127.0.0.1:3026/login",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { NEXT_PUBLIC_API_URL: "http://127.0.0.1:8026", NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});
