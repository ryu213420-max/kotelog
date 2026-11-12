import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
export default defineConfig({
  testDir: "tests",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "LOCAL_ONLY=1 npx vite",
    port: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
