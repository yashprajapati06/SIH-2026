import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir:"./tests/e2e", testMatch:"gsi-history.spec.ts", workers:1, retries:0, timeout:60000,
  reporter:[["list"],["json", {outputFile:"../../test-results/gsi-history-browser.json"}]],
  outputDir:"../../test-results/gsi-history-browser-artifacts",
  use:{baseURL:"http://127.0.0.1:3036", screenshot:"only-on-failure"},
  projects:[{name:"desktop",use:{...devices["Desktop Chrome"],viewport:{width:1440,height:1000}}},{name:"mobile",use:{...devices["Pixel 5"]}}],
});
