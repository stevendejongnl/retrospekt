/**
 * Custom Playwright fixtures that collect Istanbul coverage (window.__coverage__)
 * after each test and write it to .nyc_output/ for later report generation.
 *
 * Usage in spec files:
 *   import { test, expect } from './playwright-fixtures'
 *   (drop-in replacement for @playwright/test)
 */
import { test as base, expect } from '@playwright/test'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Page } from '@playwright/test'

const OUTPUT_DIR = join(process.cwd(), '.nyc_output')

async function saveCoverage(page: Page): Promise<void> {
  try {
    // window.__coverage__ is populated by vite-plugin-istanbul
    const coverage = await page.evaluate(
      () => (window as Window & { __coverage__?: unknown }).__coverage__ ?? null,
    )
    if (!coverage) return
    if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })
    const file = join(
      OUTPUT_DIR,
      `coverage-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    )
    writeFileSync(file, JSON.stringify(coverage))
  } catch {
    // Coverage collection is best-effort — don't fail tests if it breaks
  }
}

export const test = base.extend<{ _coverage: void }>({
  _coverage: [
    async ({ page }, use) => {
      await use()
      await saveCoverage(page)
    },
    { auto: true },
  ],
})

export { expect }
