import { expect, test, type Page } from '@playwright/test'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createSession(page: Page, name: string, facilitator: string): Promise<string> {
  await page.goto('/')
  await page.getByPlaceholder('e.g. Sprint 42 Retro').fill(name)
  await page.getByPlaceholder('e.g. Alice (facilitator)').fill(facilitator)
  await page.getByRole('button', { name: 'Create session →' }).click()
  await expect(page).toHaveURL(/\/session\//)
  return page.url()
}

async function joinSession(page: Page, url: string, name: string): Promise<void> {
  await page.goto(url)
  await page.getByPlaceholder('Your name').fill(name)
  await page.getByRole('button', { name: 'Join session →' }).click()
}

async function addCard(page: Page, column: string, text: string): Promise<void> {
  // Click "+ Add a card" in the target column — identified by sibling column title
  await page.locator('retro-column').filter({ hasText: column }).getByRole('button', { name: '+ Add a card' }).click()
  await page.getByPlaceholder("What's on your mind? (⌘↵ to add)").fill(text)
  await page.getByRole('button', { name: 'Add card' }).click()
}

// ── Session lifecycle ─────────────────────────────────────────────────────────

test('facilitator can create a session', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('e.g. Sprint 42 Retro').fill('Sprint 1 Retro')
  await page.getByPlaceholder('e.g. Alice (facilitator)').fill('Alice')
  await page.getByRole('button', { name: 'Create session →' }).click()

  await expect(page).toHaveURL(/\/session\//)
  await expect(page.getByText('✏️ Collecting')).toBeVisible()
  await expect(page.getByText('Sprint 1 Retro')).toBeVisible()
})

test('facilitator can advance phase to discussing', async ({ page }) => {
  await createSession(page, 'Phase Test', 'Alice')

  await page.getByRole('button', { name: 'Start discussion →' }).click()

  await expect(page.getByText('💬 Discussing')).toBeVisible()
  await expect(page.getByText('💬 Discussion phase')).toBeVisible()
})

test('facilitator can close a session', async ({ page }) => {
  await createSession(page, 'Close Test', 'Alice')
  await page.getByRole('button', { name: 'Start discussion →' }).click()
  await page.getByRole('button', { name: 'Close session' }).click()

  await expect(page.getByText('🔒 Closed')).toBeVisible()
  await expect(page.getByText('🔒 This session is closed')).toBeVisible()
})

test('participant can join a session via shared URL', async ({ page, browser }) => {
  const sessionUrl = await createSession(page, 'Join Test', 'Alice')

  const participantContext = await browser.newContext()
  const participantPage = await participantContext.newPage()
  await joinSession(participantPage, sessionUrl, 'Bob')

  await expect(participantPage.getByText('Bob')).toBeVisible()
  await participantContext.close()
})

// ── Card management ───────────────────────────────────────────────────────────

test('facilitator can add a card to Went Well column', async ({ page }) => {
  await createSession(page, 'Card Test', 'Alice')

  await addCard(page, 'Went Well', 'Shipping went smoothly')

  await expect(page.getByText('Shipping went smoothly')).toBeVisible()
})

test('cards are not addable after phase advances to discussing', async ({ page }) => {
  await createSession(page, 'Lock Test', 'Alice')
  await page.getByRole('button', { name: 'Start discussion →' }).click()
  await expect(page.getByText('💬 Discussing')).toBeVisible()

  // The "+ Add a card" button should no longer be present
  await expect(page.getByRole('button', { name: '+ Add a card' })).not.toBeVisible()
})

// ── Real-time SSE sync ────────────────────────────────────────────────────────

test('card added by facilitator appears live for participant (SSE)', async ({ page, browser }) => {
  const sessionUrl = await createSession(page, 'Live Sync Test', 'Alice')

  // Participant opens the session in a second tab
  const participantContext = await browser.newContext()
  const participantPage = await participantContext.newPage()
  await joinSession(participantPage, sessionUrl, 'Bob')

  // Facilitator adds a card
  await addCard(page, 'Went Well', 'Real-time update works')

  // Participant should see it without refreshing
  await expect(participantPage.getByText('Real-time update works')).toBeVisible({ timeout: 5000 })

  await participantContext.close()
})

test('phase change is reflected live for participant (SSE)', async ({ page, browser }) => {
  const sessionUrl = await createSession(page, 'Phase Sync Test', 'Alice')

  const participantContext = await browser.newContext()
  const participantPage = await participantContext.newPage()
  await joinSession(participantPage, sessionUrl, 'Bob')

  // Facilitator advances phase
  await page.getByRole('button', { name: 'Start discussion →' }).click()

  // Participant sees the discussion banner without refreshing
  await expect(participantPage.getByText('💬 Discussion phase')).toBeVisible({ timeout: 5000 })

  await participantContext.close()
})
