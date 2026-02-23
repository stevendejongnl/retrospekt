import { expect, fixture, html } from '@open-wc/testing'
import type { Session } from '../types'
import { api } from '../api'
import { storage } from '../storage'
import './session-page'
import type { SessionPage } from './session-page'

// Minimal EventSource mock — prevents real SSE connections in Chromium
class MockEventSource {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  close() {}
  constructor(_url: string) {}
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-session',
    name: 'Test Sprint Retro',
    columns: ['Went Well', 'To Improve', 'Action Items'],
    phase: 'collecting',
    participants: [],
    cards: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

// Save originals for restoration
const origGetSession = api.getSession
const origJoinSession = api.joinSession
const origGetName = storage.getName.bind(storage)
const origSetName = storage.setName.bind(storage)

beforeEach(() => {
  // Replace EventSource globally so session-page never opens a real SSE connection
  ;(window as { EventSource?: unknown }).EventSource = MockEventSource
})

afterEach(() => {
  api.getSession = origGetSession
  api.joinSession = origJoinSession
  storage.getName = origGetName
  storage.setName = origSetName
  delete (window as { router?: unknown }).router
})

describe('session-page', () => {
  it('shows the .spinner while api.getSession() is in-flight', async () => {
    // Return a promise that never resolves → loading stays true
    api.getSession = () => new Promise<Session>(() => {})

    const el = await fixture<SessionPage>(
      html`<session-page session-id="test-session"></session-page>`,
    )
    expect(el.shadowRoot!.querySelector('.spinner')).to.not.be.null
  })

  it('shows an error state when api.getSession() rejects', async () => {
    api.getSession = () => Promise.reject(new Error('not found'))
    ;(window as { router?: unknown }).router = { navigate: () => {} }

    const el = await fixture<SessionPage>(
      html`<session-page session-id="test-session"></session-page>`,
    )
    // Wait for the rejection to propagate through loadSession and re-render
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete

    expect(el.shadowRoot!.querySelector('.state-center')).to.not.be.null
  })

  it('shows the name-prompt overlay when no name is stored for the session', async () => {
    const mockSession = makeSession()
    api.getSession = () => Promise.resolve(mockSession)
    api.joinSession = () => Promise.resolve(mockSession)
    storage.getName = () => null
    ;(window as { router?: unknown }).router = { navigate: () => {} }

    const el = await fixture<SessionPage>(
      html`<session-page session-id="test-session"></session-page>`,
    )
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete

    expect(el.shadowRoot!.querySelector('.overlay')).to.not.be.null
  })

  it('submitting the name calls api.joinSession() and hides the overlay', async () => {
    const mockSession = makeSession()
    api.getSession = () => Promise.resolve(mockSession)

    let joinArgs: unknown[] | null = null
    api.joinSession = (...args: unknown[]) => {
      joinArgs = args
      return Promise.resolve(mockSession)
    }
    storage.getName = () => null
    storage.setName = () => {}
    ;(window as { router?: unknown }).router = { navigate: () => {} }

    const el = await fixture<SessionPage>(
      html`<session-page session-id="test-session"></session-page>`,
    )
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete

    // Fill in the name input inside the overlay
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('.name-card input')!
    nameInput.value = 'Bob'
    nameInput.dispatchEvent(new Event('input'))
    await el.updateComplete

    // Click "Join session"
    el.shadowRoot!.querySelector<HTMLButtonElement>('.name-card button')!.click()
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete

    expect(joinArgs).to.not.be.null
    expect(joinArgs![1]).to.equal('Bob')
    expect(el.shadowRoot!.querySelector('.overlay')).to.be.null
  })

  it('when stored name exists, skips the prompt and calls joinSession immediately', async () => {
    const mockSession = makeSession()
    api.getSession = () => Promise.resolve(mockSession)

    let joinCalled = false
    api.joinSession = () => {
      joinCalled = true
      return Promise.resolve(mockSession)
    }
    storage.getName = () => 'Alice'
    ;(window as { router?: unknown }).router = { navigate: () => {} }

    const el = await fixture<SessionPage>(
      html`<session-page session-id="test-session"></session-page>`,
    )
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete

    expect(el.shadowRoot!.querySelector('.overlay')).to.be.null
    expect(joinCalled).to.be.true
  })
})
