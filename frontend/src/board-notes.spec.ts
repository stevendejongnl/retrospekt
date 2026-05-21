import type { Page } from '@playwright/test'
import { test, expect } from './playwright-fixtures'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION_ID = 'notes-spec-1'
const FAC_TOKEN = 'fac-tok-notes-1'

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

const NOTE_1 = {
  id: 'note-1',
  text: "Don't forget to celebrate wins",
  author_name: 'Alice',
  created_at: '2026-01-01T10:00:00Z',
}

const NOTE_2 = {
  id: 'note-2',
  text: 'Follow up on CI pipeline',
  author_name: 'Bob',
  created_at: '2026-01-01T11:00:00Z',
}

function makeSession(notes: object[] = []) {
  return {
    id: SESSION_ID,
    name: 'Sprint Retro',
    columns: ['Went Well', 'To Improve', 'Action Items'],
    phase: 'collecting' as const,
    participants: [
      { name: 'Alice', joined_at: '2026-01-01T00:00:00Z' },
    ],
    cards: [] as object[],
    notes,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    facilitator_token: FAC_TOKEN,
    timer: null,
    reactions_enabled: true,
  }
}

async function mockApi(page: Page, session: ReturnType<typeof makeSession>) {
  const id = session.id
  await page.route(`/api/v1/sessions/${id}`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }))
  await page.route(`/api/v1/sessions/${id}/stream`, route =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: sse(session),
    }))
  await page.route(`/api/v1/sessions/${id}/**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }))
}

async function withName(page: Page, name: string, token = '') {
  await page.addInitScript(
    ({ id, n, t }: { id: string; n: string; t: string }) => {
      localStorage.setItem(`retro_name_${id}`, n)
      if (t) localStorage.setItem(`retro_facilitator_${id}`, t)
    },
    { id: SESSION_ID, n: name, t: token },
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('board-notes sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, makeSession())
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()
  })

  test('notes toggle button is visible in session header', async ({ page }) => {
    await expect(page.locator('button[title="Board notes"]')).toBeVisible()
  })

  test('clicking notes button opens the board-notes sidebar', async ({ page }) => {
    await page.locator('button[title="Board notes"]').click()
    await expect(page.locator('board-notes .sidebar.open')).toBeVisible()
  })

  test('shows "No notes yet" when notes list is empty', async ({ page }) => {
    await page.locator('button[title="Board notes"]').click()
    await expect(page.getByText('No notes yet')).toBeVisible()
  })

  test('clicking × close button closes the sidebar', async ({ page }) => {
    await page.locator('button[title="Board notes"]').click()
    await expect(page.locator('board-notes .sidebar.open')).toBeVisible()
    await page.locator('board-notes .close-btn').click()
    await expect(page.locator('board-notes .sidebar.open')).not.toBeVisible()
  })

  test('clicking backdrop closes the sidebar', async ({ page }) => {
    await page.locator('button[title="Board notes"]').click()
    await expect(page.locator('board-notes .sidebar.open')).toBeVisible()
    await page.locator('board-notes .backdrop.visible').click({ position: { x: 400, y: 300 } })
    await expect(page.locator('board-notes .sidebar.open')).not.toBeVisible()
  })
})

test.describe('board-notes with existing notes', () => {
  test.beforeEach(async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, makeSession([NOTE_1, NOTE_2]))
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()
    await page.locator('button[title="Board notes"]').click()
    await expect(page.locator('board-notes .sidebar.open')).toBeVisible()
  })

  test('displays all notes from session', async ({ page }) => {
    await expect(page.locator('board-notes .note-item')).toHaveCount(2)
  })

  test('shows note text and author', async ({ page }) => {
    await expect(page.getByText("Don't forget to celebrate wins")).toBeVisible()
    await expect(page.locator('board-notes .note-author').first()).toContainText('Alice')
  })

  test('each note has a delete button', async ({ page }) => {
    await expect(page.locator('board-notes .delete-note-btn')).toHaveCount(2)
  })
})

test.describe('board-notes add note', () => {
  test.beforeEach(async ({ page }) => {
    await withName(page, 'Alice')
  })

  test('add form is visible at the bottom of the sidebar', async ({ page }) => {
    await mockApi(page, makeSession())
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()
    await page.locator('button[title="Board notes"]').click()
    await expect(page.locator('board-notes .add-note-form')).toBeVisible()
    await expect(page.locator('board-notes .add-note-textarea')).toBeVisible()
  })

  test('Add button calls POST /notes API', async ({ page }) => {
    const session = makeSession()
    await mockApi(page, session)

    const newNote = { ...NOTE_1 }
    let postedBody: unknown = null
    await page.route(`/api/v1/sessions/${SESSION_ID}/notes`, async route => {
      postedBody = JSON.parse(route.request().postData() ?? '{}')
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newNote),
      })
    })

    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()
    await page.locator('button[title="Board notes"]').click()
    await page.locator('board-notes .add-note-textarea').fill('My new note')
    await page.locator('board-notes .add-note-btn').click()

    await expect(async () => {
      expect(postedBody).toMatchObject({ text: 'My new note', author_name: 'Alice' })
    }).toPass({ timeout: 3000 })
  })

  test('Ctrl+Enter submits the add form', async ({ page }) => {
    const session = makeSession()
    await mockApi(page, session)

    let apiCalled = false
    await page.route(`/api/v1/sessions/${SESSION_ID}/notes`, async route => {
      apiCalled = true
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(NOTE_1),
      })
    })

    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()
    await page.locator('button[title="Board notes"]').click()
    await page.locator('board-notes .add-note-textarea').fill('Ctrl enter note')
    await page.locator('board-notes .add-note-textarea').press('Control+Enter')

    await expect(async () => {
      expect(apiCalled).toBe(true)
    }).toPass({ timeout: 3000 })
  })

  test('Escape clears the textarea without submitting', async ({ page }) => {
    const session = makeSession()
    await mockApi(page, session)

    let apiCalled = false
    await page.route(`/api/v1/sessions/${SESSION_ID}/notes`, async route => {
      apiCalled = true
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(NOTE_1) })
    })

    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()
    await page.locator('button[title="Board notes"]').click()
    await page.locator('board-notes .add-note-textarea').fill('Some text')
    await page.locator('board-notes .add-note-textarea').press('Escape')

    await expect(page.locator('board-notes .add-note-textarea')).toHaveValue('')
    expect(apiCalled).toBe(false)
  })
})

test.describe('board-notes delete note', () => {
  test('delete button calls DELETE /notes/:id API', async ({ page }) => {
    await withName(page, 'Alice')
    const session = makeSession([NOTE_1])
    await mockApi(page, session)

    let deleteUrl = ''
    await page.route(`/api/v1/sessions/${SESSION_ID}/notes/**`, async route => {
      deleteUrl = route.request().url()
      await route.fulfill({ status: 204, body: '' })
    })

    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()
    await page.locator('button[title="Board notes"]').click()
    await page.locator('board-notes .delete-note-btn').first().click()

    await expect(async () => {
      expect(deleteUrl).toContain('/notes/note-1')
    }).toPass({ timeout: 3000 })
  })
})

test.describe('board-notes inline edit', () => {
  test('clicking note text starts inline editing', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, makeSession([NOTE_1]))
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()
    await page.locator('button[title="Board notes"]').click()
    await page.locator('board-notes .note-text').first().click()
    await expect(page.locator('board-notes .note-edit-textarea')).toBeVisible()
  })

  test('Enter saves the edit via PATCH API', async ({ page }) => {
    await withName(page, 'Alice')
    const session = makeSession([NOTE_1])
    await mockApi(page, session)

    let patchBody: unknown = null
    await page.route(`/api/v1/sessions/${SESSION_ID}/notes/**`, async route => {
      if (route.request().method() === 'PATCH') {
        patchBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...NOTE_1, text: 'Updated text' }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()
    await page.locator('button[title="Board notes"]').click()
    await page.locator('board-notes .note-text').first().click()
    const textarea = page.locator('board-notes .note-edit-textarea')
    await textarea.fill('Updated text')
    await textarea.press('Enter')

    await expect(async () => {
      expect(patchBody).toMatchObject({ text: 'Updated text' })
    }).toPass({ timeout: 3000 })
  })

  test('Escape cancels the edit without API call', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, makeSession([NOTE_1]))

    let patchCalled = false
    await page.route(`/api/v1/sessions/${SESSION_ID}/notes/**`, async route => {
      if (route.request().method() === 'PATCH') {
        patchCalled = true
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NOTE_1) })
      } else {
        await route.continue()
      }
    })

    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()
    await page.locator('button[title="Board notes"]').click()
    await page.locator('board-notes .note-text').first().click()
    await page.locator('board-notes .note-edit-textarea').press('Escape')

    await expect(page.locator('board-notes .note-edit-textarea')).not.toBeVisible()
    expect(patchCalled).toBe(false)
  })
})
