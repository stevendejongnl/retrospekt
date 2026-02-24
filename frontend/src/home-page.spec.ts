import { test, expect } from './playwright-fixtures'

const MOCK_SESSION = {
  id: 'mock-sess-1',
  name: 'Sprint Retro',
  columns: ['Went Well', 'To Improve', 'Action Items'],
  phase: 'collecting',
  participants: [],
  cards: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  facilitator_token: 'tok-abc',
}

async function mockCreateSession(
  page: Parameters<Parameters<typeof test>[1]>[0]['page'],
  overrides: Partial<typeof MOCK_SESSION> = {},
) {
  await page.route('/api/v1/sessions', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ...MOCK_SESSION, ...overrides }),
    }),
  )
}

test.describe('home-page static content', () => {
  test('renders title, tagline and form fields', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Retrospekt 🥓')
    await expect(page.getByText('A simple, self-hosted retrospective board')).toBeVisible()
    await expect(page.getByLabel('Session name')).toBeVisible()
    await expect(page.getByLabel('Your name')).toBeVisible()
  })

  test('renders all four column templates', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Standard/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Mad.*Sad.*Glad/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Start.*Stop.*Continue/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /4Ls/ })).toBeVisible()
  })
})

test.describe('home-page create button state', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('is disabled when session name is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Create session/ })).toBeDisabled()
  })

  test('enables after typing a session name', async ({ page }) => {
    await page.getByLabel('Session name').fill('Sprint Retro')
    await expect(page.getByRole('button', { name: /Create session/ })).toBeEnabled()
  })

  test('disables again after clearing the session name', async ({ page }) => {
    await page.getByLabel('Session name').fill('Sprint Retro')
    await page.getByLabel('Session name').fill('')
    await expect(page.getByRole('button', { name: /Create session/ })).toBeDisabled()
  })
})

test.describe('home-page template picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('Standard is selected by default', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Standard/ })).toHaveClass(/selected/)
  })

  test('clicking a different template selects it', async ({ page }) => {
    await page.getByRole('button', { name: /Mad.*Sad.*Glad/ }).click()
    await expect(page.getByRole('button', { name: /Mad.*Sad.*Glad/ })).toHaveClass(/selected/)
    await expect(page.getByRole('button', { name: /Standard/ })).not.toHaveClass(/selected/)
  })

  test('all four templates can be selected', async ({ page }) => {
    for (const name of [/Start.*Stop.*Continue/, /4Ls/, /Mad.*Sad.*Glad/, /Standard/]) {
      await page.getByRole('button', { name }).click()
      await expect(page.getByRole('button', { name })).toHaveClass(/selected/)
    }
  })
})

test.describe('home-page theme toggle', () => {
  test('clicking the theme toggle switches the theme', async ({ page }) => {
    await page.goto('/')
    const before = await page.evaluate(
      () => document.documentElement.getAttribute('data-theme') ?? 'light',
    )
    await page.locator('.theme-toggle').click()
    const after = await page.evaluate(
      () => document.documentElement.getAttribute('data-theme'),
    )
    expect(after).not.toBe(before)
  })
})

test.describe('home-page history sidebar', () => {
  test('clicking the history toggle opens the sidebar', async ({ page }) => {
    await page.goto('/')
    await page.locator('.history-toggle').click()
    await expect(page.locator('.sidebar.open')).toBeVisible()
  })
})

test.describe('home-page create session', () => {
  test('navigates to session page on success', async ({ page }) => {
    await page.goto('/')
    await mockCreateSession(page)
    await page.getByLabel('Session name').fill('Sprint Retro')
    await page.getByRole('button', { name: /Create session/ }).click()
    await expect(page).toHaveTitle('Retrospekt — Session')
    expect(page.url()).toContain('/session/mock-sess-1')
  })

  test('pressing Enter in session name submits the form', async ({ page }) => {
    await page.goto('/')
    await mockCreateSession(page)
    await page.getByLabel('Session name').fill('Sprint Retro')
    await page.getByLabel('Session name').press('Enter')
    await expect(page).toHaveTitle('Retrospekt — Session')
  })

  test('pressing Enter in your name submits the form', async ({ page }) => {
    await page.goto('/')
    await mockCreateSession(page)
    await page.getByLabel('Session name').fill('Sprint Retro')
    await page.getByLabel('Your name').fill('Alice')
    await page.getByLabel('Your name').press('Enter')
    await expect(page).toHaveTitle('Retrospekt — Session')
  })

  test('sends "Facilitator" as participant_name when your name is blank', async ({ page }) => {
    await page.goto('/')
    let body: Record<string, unknown> = {}
    await page.route('/api/v1/sessions', async (route) => {
      body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION),
      })
    })
    await page.getByLabel('Session name').fill('Sprint Retro')
    await page.getByRole('button', { name: /Create session/ }).click()
    expect(body.participant_name).toBe('Facilitator')
  })

  test('sends the selected template columns in the request body', async ({ page }) => {
    await page.goto('/')
    let body: Record<string, unknown> = {}
    await page.route('/api/v1/sessions', async (route) => {
      body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION),
      })
    })
    await page.getByRole('button', { name: /Mad.*Sad.*Glad/ }).click()
    await page.getByLabel('Session name').fill('Sprint Retro')
    await page.getByRole('button', { name: /Create session/ }).click()
    expect(body.columns).toEqual(['Mad', 'Sad', 'Glad'])
  })

  test('shows error message when API call fails', async ({ page }) => {
    await page.goto('/')
    await page.route('/api/v1/sessions', (route) => route.abort())
    await page.getByLabel('Session name').fill('Fail Test')
    await page.getByRole('button', { name: /Create session/ }).click()
    await expect(page.getByText('Failed to create session')).toBeVisible()
  })

  test('create button shows loading state while request is in flight', async ({ page }) => {
    await page.goto('/')
    let resolveRequest!: () => void
    await page.route('/api/v1/sessions', (route) =>
      new Promise<void>((resolve) => {
        resolveRequest = () => {
          resolve()
          void route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_SESSION),
          })
        }
      }),
    )
    await page.getByLabel('Session name').fill('Sprint Retro')
    await page.getByRole('button', { name: /Create session/ }).click()
    await expect(page.getByRole('button', { name: 'Creating…' })).toBeDisabled()
    resolveRequest()
    await expect(page).toHaveTitle('Retrospekt — Session')
  })
})

test.describe('not-found page', () => {
  test('"Back to home" link navigates to home page', async ({ page }) => {
    await page.goto('/does-not-exist')
    await page.getByRole('link', { name: '← Back to home' }).click()
    await expect(page).toHaveTitle('Retrospekt 🥓')
    expect(page.url()).toMatch(/\/$/)
  })
})
