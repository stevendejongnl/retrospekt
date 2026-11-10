import { expect, fixture, html } from '@open-wc/testing'
import type { Session } from '../types'
import { api } from '../api'
import { storage } from '../storage'
import './retro-board'
import type { RetroBoard } from './retro-board'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    name: 'Sprint Retro',
    columns: ['Went Well', 'To Improve', 'Action Items'],
    column_sorts: {},
    phase: 'collecting',
    participants: [{ name: 'Alice', joined_at: '2025-01-01T00:00:00Z' }],
    cards: [],
    notes: [],
    timer: null,
    reactions_enabled: true,
    open_facilitator: false,
    max_votes_per_participant: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

// Saved original methods for restoration after each test
const origIsFacilitator = storage.isFacilitator.bind(storage)
const origGetToken = storage.getFacilitatorToken.bind(storage)
const origSetPhase = api.setPhase
const origAddCard = api.addCard
const origAddVote = api.addVote
const origRemoveVote = api.removeVote
const origDeleteCard = api.deleteCard
const origPublishCard = api.publishCard

afterEach(() => {
  storage.isFacilitator = origIsFacilitator
  storage.getFacilitatorToken = origGetToken
  api.setPhase = origSetPhase
  api.addCard = origAddCard
  api.addVote = origAddVote
  api.removeVote = origRemoveVote
  api.deleteCard = origDeleteCard
  api.publishCard = origPublishCard
})

describe('retro-board', () => {
  it('renders a <retro-column> for each column in the session', async () => {
    storage.isFacilitator = () => false
    const el = await fixture<RetroBoard>(
      html`<retro-board .session=${makeSession()} .participantName=${'Alice'}></retro-board>`,
    )
    const columns = el.shadowRoot!.querySelectorAll('retro-column')
    expect(columns.length).to.equal(3)
  })

  it('facilitator bar is absent when the user is not a facilitator', async () => {
    storage.isFacilitator = () => false
    const el = await fixture<RetroBoard>(
      html`<retro-board .session=${makeSession()} .participantName=${'Alice'}></retro-board>`,
    )
    expect(el.shadowRoot!.querySelector('.facilitator-dock')).to.be.null
  })

  it('facilitator bar is present with a phase button when user is the facilitator', async () => {
    storage.isFacilitator = () => true
    storage.getFacilitatorToken = () => 'tok-abc'
    const el = await fixture<RetroBoard>(
      html`<retro-board .session=${makeSession()} .participantName=${'Alice'}></retro-board>`,
    )
    expect(el.shadowRoot!.querySelector('.facilitator-dock')).to.not.be.null
    expect(el.shadowRoot!.querySelector('.phase-btn')).to.not.be.null
  })

  describe('facilitator dock', () => {
    const dockOf = async (phase: Session['phase']) => {
      storage.isFacilitator = () => true
      storage.getFacilitatorToken = () => 'tok-abc'
      const el = await fixture<RetroBoard>(
        html`<retro-board .session=${makeSession({ phase })} .participantName=${'Alice'}></retro-board>`,
      )
      return el.shadowRoot!
    }
    const text = (root: ShadowRoot, selector: string) => root.querySelector(selector)?.textContent?.trim()

    it('floats over the board instead of taking a row above the columns', async () => {
      const root = await dockOf('collecting')
      const dock = root.querySelector('.facilitator-dock')!
      expect(getComputedStyle(dock).position).to.equal('fixed')
    })

    it('does not repeat the phase, the header stepper shows it', async () => {
      const root = await dockOf('discussing')
      expect(root.querySelector('.phase-badge')).to.be.null
      expect(root.querySelector('.bar-label')).to.be.null
    })

    it('collecting: Start discussion, Add column and Settings, no Back', async () => {
      const root = await dockOf('collecting')
      expect(text(root, '.phase-btn')).to.equal('Start discussion')
      expect(root.querySelector('.add-column-btn')).to.not.be.null
      expect(root.querySelector('.settings-btn')).to.not.be.null
      expect(root.querySelector('.back-btn')).to.be.null
    })

    it('discussing: Back and Close session, no Add column', async () => {
      const root = await dockOf('discussing')
      expect(text(root, '.back-btn')).to.equal('Back')
      expect(text(root, '.phase-btn.close-btn')).to.equal('Close session')
      expect(root.querySelector('.add-column-btn')).to.be.null
    })

    it('closed: Reopen instead of Back, and no phase button', async () => {
      const root = await dockOf('closed')
      expect(text(root, '.back-btn')).to.equal('Reopen')
      expect(root.querySelector('.phase-btn')).to.be.null
    })

    it('Reopen goes back one phase', async () => {
      let setPhaseArgs: unknown[] | null = null
      api.setPhase = (...args: unknown[]) => {
        setPhaseArgs = args
        return Promise.resolve(makeSession({ phase: 'discussing' }))
      }
      const root = await dockOf('closed')
      root.querySelector<HTMLButtonElement>('.back-btn')!.click()
      await new Promise((r) => setTimeout(r, 0))
      expect(setPhaseArgs![1]).to.equal('discussing')
    })
  })

  it('phase transition button calls api.setPhase() with the next phase', async () => {
    storage.isFacilitator = () => true
    storage.getFacilitatorToken = () => 'tok-abc'
    let setPhaseArgs: unknown[] | null = null
    api.setPhase = (...args: unknown[]) => {
      setPhaseArgs = args
      return Promise.resolve(makeSession({ phase: 'discussing' }))
    }

    const el = await fixture<RetroBoard>(
      html`<retro-board .session=${makeSession({ phase: 'collecting' })} .participantName=${'Alice'}></retro-board>`,
    )
    el.shadowRoot!.querySelector<HTMLButtonElement>('.phase-btn')!.click()
    await new Promise((r) => setTimeout(r, 0))

    expect(setPhaseArgs).to.not.be.null
    expect(setPhaseArgs![0]).to.equal('session-1')
    expect(setPhaseArgs![1]).to.equal('discussing')
    expect(setPhaseArgs![2]).to.equal('tok-abc')
  })

  it('forwarded add-card event calls api.addCard()', async () => {
    storage.isFacilitator = () => false
    let addCardArgs: unknown[] | null = null
    api.addCard = (...args: unknown[]) => {
      addCardArgs = args
      return Promise.resolve({
        id: 'c1',
        column: 'Went Well',
        text: 'hi',
        author_name: 'Alice',
        published: false,
        votes: [],
        reactions: [],
        assignee: null,
        group_id: null,
        created_at: '',
      })
    }

    const el = await fixture<RetroBoard>(
      html`<retro-board .session=${makeSession()} .participantName=${'Alice'}></retro-board>`,
    )
    el.shadowRoot!.querySelector('.columns')!.dispatchEvent(
      new CustomEvent('add-card', {
        detail: { column: 'Went Well', text: 'Nice work', authorName: 'Alice' },
        bubbles: true,
      }),
    )

    expect(addCardArgs).to.not.be.null
    expect(addCardArgs![1]).to.equal('Went Well')
    expect(addCardArgs![2]).to.equal('Nice work')
  })

  it('forwarded vote / unvote / delete-card events call the correct api methods', async () => {
    storage.isFacilitator = () => false
    const mockCard = {
      id: 'c1',
      column: 'Went Well',
      text: 'hi',
      author_name: 'Alice',
      published: false,
      votes: [],
      reactions: [],
      assignee: null,
      group_id: null,
      created_at: '',
    }
    let voteCalled = false
    let unvoteCalled = false
    let deleteCalled = false
    api.addVote = () => {
      voteCalled = true
      return Promise.resolve(mockCard)
    }
    api.removeVote = () => {
      unvoteCalled = true
      return Promise.resolve(mockCard)
    }
    api.deleteCard = () => {
      deleteCalled = true
      return Promise.resolve(undefined)
    }

    const el = await fixture<RetroBoard>(
      html`<retro-board .session=${makeSession()} .participantName=${'Alice'}></retro-board>`,
    )
    const columns = el.shadowRoot!.querySelector('.columns')!

    columns.dispatchEvent(new CustomEvent('vote', { detail: { cardId: 'c1' }, bubbles: true }))
    columns.dispatchEvent(new CustomEvent('unvote', { detail: { cardId: 'c1' }, bubbles: true }))
    columns.dispatchEvent(
      new CustomEvent('delete-card', { detail: { cardId: 'c1' }, bubbles: true }),
    )

    expect(voteCalled).to.be.true
    expect(unvoteCalled).to.be.true
    expect(deleteCalled).to.be.true
  })
})
