import { defineConfig, devices } from '@playwright/test'

/**
 * E2E test configuration.
 *
 * Local: run `make start` first to bring up MongoDB, then `make e2e`.
 * CI:    add a MongoDB service container and set MONGODB_URL env var.
 *
 * `reuseExistingServer: true` (local) lets you keep your dev servers running
 * between test runs for a faster inner loop.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // SSE tests open concurrent connections — keep sequential
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // Backend: requires MongoDB at MONGODB_URL (default: localhost:27017)
      command: 'uv run uvicorn src.main:app --port 8000',
      cwd: './backend',
      url: 'http://localhost:8000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: 'npm run dev',
      cwd: './frontend',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 20_000,
    },
  ],
})
