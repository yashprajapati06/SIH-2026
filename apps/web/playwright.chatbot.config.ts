import { defineConfig, devices } from "@playwright/test";

// Use separately started local servers so a Windows runner teardown cannot
// terminate or leak unrelated application processes.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "chatbot.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: [["list"], ["json", { outputFile: "../../test-results/chatbot-browser.json" }]],
  outputDir: "../../test-results/chatbot-browser-artifacts",
  use: { baseURL: "http://127.0.0.1:3036", screenshot: "only-on-failure" },
  projects: [
    { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
  ],
});
