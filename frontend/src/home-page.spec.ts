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
  const session = { ...MOCK_SESSION, ...overrides }
  await page.route('/api/v1/sessions', (route) =>
    route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(session) }),
  )
  await page.route(`/api/v1/sessions/${session.id}/stream`, (route) => route.abort())
  await page.route(`/api/v1/sessions/${session.id}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }),
  )
  await page.route(`/api/v1/sessions/${session.id}/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }),
  )
}

test.describe('home-page static content', () => {
  test('renders title, tagline and form fields', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Retrospekt')
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
    await page.route(`/api/v1/sessions/${MOCK_SESSION.id}/stream`, (route) => route.abort())
    await page.route(`/api/v1/sessions/${MOCK_SESSION.id}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION) }),
    )
    await page.route(`/api/v1/sessions/${MOCK_SESSION.id}/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION) }),
    )
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
    await expect(page).toHaveTitle('Retrospekt')
    expect(page.url()).toMatch(/\/$/)
  })
})

// ── reactions_enabled option ──────────────────────────────────────────────────

test.describe('home-page reactions_enabled option', () => {
  test('emoji reactions checkbox is checked by default', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('checkbox')).toBeChecked()
  })

  test('sends reactions_enabled=true by default when creating a session', async ({ page }) => {
    await page.goto('/')
    let body: Record<string, unknown> = {}
    await page.route('/api/v1/sessions', async (route) => {
      body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION) })
    })
    await page.getByLabel('Session name').fill('Sprint Retro')
    await page.getByRole('button', { name: /Create session/ }).click()
    expect(body.reactions_enabled).toBe(true)
  })

  test('sends reactions_enabled=false when checkbox is unchecked', async ({ page }) => {
    await page.goto('/')
    let body: Record<string, unknown> = {}
    await page.route('/api/v1/sessions', async (route) => {
      body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION) })
    })
    await page.getByRole('checkbox').uncheck()
    await page.getByLabel('Session name').fill('Sprint Retro')
    await page.getByRole('button', { name: /Create session/ }).click()
    expect(body.reactions_enabled).toBe(false)
  })
})

// ── Empty session name guard (home-page.ts line 240) ─────────────────────────

test.describe('home-page empty name guard', () => {
  test('pressing Enter on session name input when empty is a no-op', async ({ page }) => {
    await page.goto('/')
    // Do NOT fill the session name — pressing Enter calls createSession() which hits `if (!name) return`
    await page.getByLabel('Session name').press('Enter')
    // Page stays on home page (no navigation)
    await expect(page).toHaveTitle('Retrospekt')
  })
})

// ── matchMedia change (theme.ts lines 24-25) ──────────────────────────────────

test.describe('home-page matchMedia change', () => {
  test('system theme change applies when no stored preference exists', async ({ page }) => {
    // Capture the change listener that initTheme registers before the page loads
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      const origMatchMedia = window.matchMedia.bind(window)
      w.matchMedia = function (query: string) {
        const mql = origMatchMedia(query)
        if (query === '(prefers-color-scheme: dark)') {
          const origAdd = mql.addEventListener.bind(mql)
          ;(mql as any).addEventListener = function (
            type: string,
            fn: EventListenerOrEventListenerObject,
            opts?: boolean | AddEventListenerOptions,
          ) {
            if (type === 'change') w.__darkListener = fn
            return origAdd(type, fn, opts)
          }
        }
        return mql
      }
    })
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    // Fire the captured listener directly with matches=true — hits lines 24-25
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      localStorage.removeItem('retro_theme')
      if (w.__darkListener)
        w.__darkListener({ matches: true, media: '(prefers-color-scheme: dark)' })
    })
    const after = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    expect(after).toBe('dark')
  })

  test('getEffectiveTheme returns dark when system prefers dark and no stored pref', async ({ page }) => {
    // Covers the ? 'dark' : 'light' truthy branch in getEffectiveTheme (theme.ts line 11)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    expect(theme).toBe('dark')
  })

  test('system theme change applies light theme when system switches back to light', async ({ page }) => {
    // Covers the matches=false branch of e.matches ? 'dark' : 'light' (theme.ts line 25)
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      const origMatchMedia = window.matchMedia.bind(window)
      w.matchMedia = function (query: string) {
        const mql = origMatchMedia(query)
        if (query === '(prefers-color-scheme: dark)') {
          const origAdd = mql.addEventListener.bind(mql)
          ;(mql as any).addEventListener = function (
            type: string,
            fn: EventListenerOrEventListenerObject,
            opts?: boolean | AddEventListenerOptions,
          ) {
            if (type === 'change') w.__darkListener = fn
            return origAdd(type, fn, opts)
          }
        }
        return mql
      }
    })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    // Fire listener with matches=false (system switched to light, no stored pref)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      localStorage.removeItem('retro_theme')
      if (w.__darkListener) w.__darkListener({ matches: false, media: '(prefers-color-scheme: dark)' })
    })
    const after = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    expect(after).toBe('light')
  })
})

// ── Theme toggle from dark (theme.ts line 15 'light' branch) ─────────────────

test.describe('home-page theme toggle from dark', () => {
  test('toggleTheme switches from dark to light (covers "light" branch)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    const before = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    expect(before).toBe('dark')
    await page.locator('.theme-toggle').click()
    const after = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    expect(after).toBe('light')
  })
})

// ── Corrupted history JSON (storage.ts line 45) ───────────────────────────────

test.describe('home-page corrupted history', () => {
  test('history sidebar shows empty state when localStorage history is invalid JSON', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('retro_history', 'NOT VALID JSON {{')
    })
    await page.goto('/')
    await page.locator('.history-toggle').click()
    await expect(page.locator('.sidebar.open')).toBeVisible()
    await expect(page.getByText('No sessions yet')).toBeVisible()
  })
})

// ── session-not-found banner ──────────────────────────────────────────────────

test.describe('home-page session-not-found banner', () => {
  test('shows banner when session_not_found param is present', async ({ page }) => {
    await page.goto('/?session_not_found')
    await expect(page.getByText(/session.*not found/i)).toBeVisible()
  })

  test('removes the query param from the URL on load', async ({ page }) => {
    await page.goto('/?session_not_found')
    await expect(page).toHaveURL('/')
  })

  test('banner is dismissed when the close button is clicked', async ({ page }) => {
    await page.goto('/?session_not_found')
    await expect(page.getByText(/session.*not found/i)).toBeVisible()
    await page.getByRole('button', { name: /dismiss/i }).click()
    await expect(page.getByText(/session.*not found/i)).not.toBeVisible()
  })
})
