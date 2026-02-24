import { expect, fixture, html } from '@open-wc/testing'
import type { Card } from '../types'
import './retro-column'
import type { RetroColumn } from './retro-column'

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    column: 'Went Well',
    text: 'Great teamwork',
    author_name: 'Alice',
    published: false,
    votes: [],
    reactions: [],
    assignee: null,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('retro-column', () => {
  it('renders the column title and count badge', async () => {
    const el = await fixture<RetroColumn>(
      html`<retro-column .title=${'Went Well'} .cards=${[makeCard(), makeCard({ id: 'c2' })]} .participantName=${'Alice'}></retro-column>`,
    )
    const title = el.shadowRoot!.querySelector('.column-title')
    const badge = el.shadowRoot!.querySelector('.count-badge')
    expect(title?.textContent).to.contain('Went Well')
    expect(badge?.textContent?.trim()).to.equal('2')
  })

  it('renders a <retro-card> element for each card in the list', async () => {
    const cards = [makeCard({ id: 'c1' }), makeCard({ id: 'c2' }), makeCard({ id: 'c3' })]
    const el = await fixture<RetroColumn>(
      html`<retro-column .title=${'Went Well'} .cards=${cards} .phase=${'collecting'} .participantName=${'Alice'}></retro-column>`,
    )
    const retroCards = el.shadowRoot!.querySelectorAll('retro-card')
    expect(retroCards.length).to.equal(3)
  })

  it('add area is hidden when phase is not "collecting" or when participantName is empty', async () => {
    const discussing = await fixture<RetroColumn>(
      html`<retro-column .title=${'Went Well'} .phase=${'discussing'} .participantName=${'Alice'}></retro-column>`,
    )
    expect(discussing.shadowRoot!.querySelector('.add-area')).to.be.null

    const noName = await fixture<RetroColumn>(
      html`<retro-column .title=${'Went Well'} .phase=${'collecting'} .participantName=${''}></retro-column>`,
    )
    expect(noName.shadowRoot!.querySelector('.add-area')).to.be.null
  })

  it('clicking "+ Add a card" shows the textarea form', async () => {
    const el = await fixture<RetroColumn>(
      html`<retro-column .title=${'Went Well'} .phase=${'collecting'} .participantName=${'Alice'}></retro-column>`,
    )
    el.shadowRoot!.querySelector<HTMLButtonElement>('.add-btn')!.click()
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('textarea')).to.not.be.null
  })

  it('pressing Escape hides the textarea and clears the input', async () => {
    const el = await fixture<RetroColumn>(
      html`<retro-column .title=${'Went Well'} .phase=${'collecting'} .participantName=${'Alice'}></retro-column>`,
    )
    el.shadowRoot!.querySelector<HTMLButtonElement>('.add-btn')!.click()
    await el.updateComplete
    const textarea = el.shadowRoot!.querySelector<HTMLTextAreaElement>('textarea')!
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('textarea')).to.be.null
  })

  it('clicking "Add card" dispatches an add-card event with { column, text, authorName }', async () => {
    const el = await fixture<RetroColumn>(
      html`<retro-column .title=${'Went Well'} .phase=${'collecting'} .participantName=${'Alice'}></retro-column>`,
    )
    el.shadowRoot!.querySelector<HTMLButtonElement>('.add-btn')!.click()
    await el.updateComplete

    const textarea = el.shadowRoot!.querySelector<HTMLTextAreaElement>('textarea')!
    textarea.value = 'My feedback'
    textarea.dispatchEvent(new Event('input'))
    await el.updateComplete

    let captured: CustomEvent | null = null
    el.addEventListener('add-card', (e) => {
      captured = e as CustomEvent
    })

    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-submit')!.click()
    await el.updateComplete

    expect(captured).to.not.be.null
    expect(captured!.detail.column).to.equal('Went Well')
    expect(captured!.detail.text).to.equal('My feedback')
    expect(captured!.detail.authorName).to.equal('Alice')
  })

  it('Cmd+Enter / Ctrl+Enter submits the form', async () => {
    const el = await fixture<RetroColumn>(
      html`<retro-column .title=${'Action Items'} .phase=${'collecting'} .participantName=${'Bob'}></retro-column>`,
    )
    el.shadowRoot!.querySelector<HTMLButtonElement>('.add-btn')!.click()
    await el.updateComplete

    const textarea = el.shadowRoot!.querySelector<HTMLTextAreaElement>('textarea')!
    textarea.value = 'Follow up'
    textarea.dispatchEvent(new Event('input'))
    await el.updateComplete

    let captured: CustomEvent | null = null
    el.addEventListener('add-card', (e) => {
      captured = e as CustomEvent
    })

    // Ctrl+Enter
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
    await el.updateComplete

    expect(captured).to.not.be.null
    expect(captured!.detail.text).to.equal('Follow up')
  })
})
