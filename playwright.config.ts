import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 7000 },
  use: {
    baseURL: "http://127.0.0.1:15173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ??
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
  },
  webServer: {
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    command:
      "python3 tools/test-integration.py -run TestBrowserStack -count=1 -timeout 0 -v",
    url: "http://127.0.0.1:15173/api/v1/health",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      FASTPOSTER_E2E_STACK: "1",
      GOCACHE: "/tmp/fastposter-gocache",
      GOMODCACHE: "/tmp/fastposter-gomod",
    },
  },
});
