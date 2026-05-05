import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for screenshot capture only.
 *
 * Targets already-running Docker Compose services (make start).
 * Frontend: http://localhost:3001, Backend: http://localhost:8001
 *
 * Usage: make screenshots
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: ['screenshots.spec.ts'],
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer block — we expect `make start` to have services already running.
})
