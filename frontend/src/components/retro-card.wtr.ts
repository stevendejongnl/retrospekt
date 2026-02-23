import { expect, fixture, html } from '@open-wc/testing'
import type { Card } from '../types'
import './retro-card'
import type { RetroCard } from './retro-card'

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    column: 'Went Well',
    text: 'Great teamwork',
    author_name: 'Alice',
    published: false,
    votes: [],
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('retro-card', () => {
  it('renders card text and author name', async () => {
    const card = makeCard()
    const el = await fixture<RetroCard>(
      html`<retro-card .card=${card} .participantName=${'Alice'}></retro-card>`,
    )
    const text = el.shadowRoot!.querySelector('.card-text')
    const author = el.shadowRoot!.querySelector('.card-author')
    expect(text?.textContent?.trim()).to.equal('Great teamwork')
    expect(author?.textContent?.trim()).to.equal('Alice')
  })

  it('vote button shows vote count and has "voted" class when user has voted', async () => {
    const card = makeCard({ votes: [{ participant_name: 'Alice' }] })
    const el = await fixture<RetroCard>(
      html`<retro-card .card=${card} .participantName=${'Alice'} .canVote=${true}></retro-card>`,
    )
    const voteBtn = el.shadowRoot!.querySelector('.vote-btn')!
    expect(voteBtn.classList.contains('voted')).to.be.true
    expect(voteBtn.textContent).to.contain('1')
  })

  it('vote button is disabled when canVote=false', async () => {
    const card = makeCard()
    const el = await fixture<RetroCard>(
      html`<retro-card .card=${card} .participantName=${'Alice'} .canVote=${false}></retro-card>`,
    )
    const voteBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.vote-btn')!
    expect(voteBtn.disabled).to.be.true
  })

  it('clicking the vote button dispatches a "vote" CustomEvent with cardId', async () => {
    const card = makeCard()
    const el = await fixture<RetroCard>(
      html`<retro-card .card=${card} .participantName=${'Bob'} .canVote=${true}></retro-card>`,
    )
    let captured: CustomEvent | null = null
    el.addEventListener('vote', (e) => {
      captured = e as CustomEvent
    })
    el.shadowRoot!.querySelector<HTMLButtonElement>('.vote-btn')!.click()
    expect(captured).to.not.be.null
    expect(captured!.detail.cardId).to.equal('card-1')
  })

  it('clicking an already-voted button dispatches an "unvote" CustomEvent', async () => {
    const card = makeCard({ votes: [{ participant_name: 'Alice' }] })
    const el = await fixture<RetroCard>(
      html`<retro-card .card=${card} .participantName=${'Alice'} .canVote=${true}></retro-card>`,
    )
    let captured: CustomEvent | null = null
    el.addEventListener('unvote', (e) => {
      captured = e as CustomEvent
    })
    el.shadowRoot!.querySelector<HTMLButtonElement>('.vote-btn')!.click()
    expect(captured).to.not.be.null
    expect(captured!.detail.cardId).to.equal('card-1')
  })

  it('delete button is absent when canDelete=false', async () => {
    const card = makeCard()
    const el = await fixture<RetroCard>(
      html`<retro-card .card=${card} .canDelete=${false}></retro-card>`,
    )
    expect(el.shadowRoot!.querySelector('.delete-btn')).to.be.null
  })

  it('delete button is present and dispatches "delete-card" CustomEvent when canDelete=true', async () => {
    const card = makeCard()
    const el = await fixture<RetroCard>(
      html`<retro-card .card=${card} .canDelete=${true}></retro-card>`,
    )
    const deleteBtn = el.shadowRoot!.querySelector('.delete-btn')
    expect(deleteBtn).to.not.be.null
    let captured: CustomEvent | null = null
    el.addEventListener('delete-card', (e) => {
      captured = e as CustomEvent
    })
    ;(deleteBtn as HTMLButtonElement).click()
    expect(captured).to.not.be.null
    expect(captured!.detail.cardId).to.equal('card-1')
  })
})
