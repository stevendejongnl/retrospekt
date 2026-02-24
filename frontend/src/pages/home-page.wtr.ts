import { expect, fixture, html } from '@open-wc/testing'
import type { CreateSessionResponse } from '../types'
import { api } from '../api'
import { storage } from '../storage'
import './home-page'
import type { HomePage } from './home-page'

const origCreateSession = api.createSession
const origSetFacilitatorToken = storage.setFacilitatorToken.bind(storage)
const origSetName = storage.setName.bind(storage)

afterEach(() => {
  api.createSession = origCreateSession
  storage.setFacilitatorToken = origSetFacilitatorToken
  storage.setName = origSetName
  delete (window as { router?: unknown }).router
})

function makeSessionResponse(overrides: Partial<CreateSessionResponse> = {}): CreateSessionResponse {
  return {
    id: 'session-123',
    name: 'Test Sprint Retro',
    facilitator_token: 'tok-abc',
    columns: ['Went Well', 'To Improve', 'Action Items'],
    phase: 'collecting',
    participants: [],
    cards: [],
    timer: null,
    reactions_enabled: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('home-page', () => {
  it('create button is disabled when session name is empty', async () => {
    ;(window as { router?: unknown }).router = { navigate: () => {} }
    const el = await fixture<HomePage>(html`<home-page></home-page>`)
    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>('.create-btn')!
    expect(btn.disabled).to.be.true
  })

  it('create button becomes enabled once session name is filled', async () => {
    ;(window as { router?: unknown }).router = { navigate: () => {} }
    const el = await fixture<HomePage>(html`<home-page></home-page>`)

    const input = el.shadowRoot!.querySelector<HTMLInputElement>('#session-name')!
    input.value = 'Sprint 42 Retro'
    input.dispatchEvent(new Event('input'))
    await el.updateComplete

    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>('.create-btn')!
    expect(btn.disabled).to.be.false
  })

  it('clicking create calls api.createSession(), stores the token, and navigates', async () => {
    const mockResponse = makeSessionResponse()
    api.createSession = () => Promise.resolve(mockResponse)

    const stored: Record<string, string> = {}
    storage.setFacilitatorToken = (_id: string, token: string) => {
      stored.token = token
    }
    storage.setName = (_id: string, name: string) => {
      stored.name = name
    }

    let navigatedTo: string | null = null
    ;(window as { router?: unknown }).router = {
      navigate: (path: string) => {
        navigatedTo = path
      },
    }

    const el = await fixture<HomePage>(html`<home-page></home-page>`)

    const input = el.shadowRoot!.querySelector<HTMLInputElement>('#session-name')!
    input.value = 'Sprint 42 Retro'
    input.dispatchEvent(new Event('input'))
    await el.updateComplete

    el.shadowRoot!.querySelector<HTMLButtonElement>('.create-btn')!.click()
    // Flush microtasks and Lit update
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete

    expect(stored.token).to.equal('tok-abc')
    expect(navigatedTo).to.equal('/session/session-123')
  })

  it('shows .error-msg when the API call rejects', async () => {
    api.createSession = () => Promise.reject(new Error('network error'))
    ;(window as { router?: unknown }).router = { navigate: () => {} }

    const el = await fixture<HomePage>(html`<home-page></home-page>`)

    const input = el.shadowRoot!.querySelector<HTMLInputElement>('#session-name')!
    input.value = 'Sprint 42 Retro'
    input.dispatchEvent(new Event('input'))
    await el.updateComplete

    el.shadowRoot!.querySelector<HTMLButtonElement>('.create-btn')!.click()
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete

    const errorMsg = el.shadowRoot!.querySelector('.error-msg')
    expect(errorMsg).to.not.be.null
    expect(errorMsg!.textContent).to.contain('Failed to create session')
  })
})
