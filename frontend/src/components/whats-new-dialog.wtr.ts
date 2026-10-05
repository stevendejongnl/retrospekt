import { expect, fixture, html } from '@open-wc/testing'
import type { ChangelogEntry } from '../generated/changelog'
import './whats-new-dialog'
import type { WhatsNewDialog } from './whats-new-dialog'

function makeEntry(overrides: Partial<ChangelogEntry> = {}): ChangelogEntry {
  return {
    version: '1.27.1',
    date: '2026-03-23',
    groups: [
      {
        kind: 'Features',
        items: [
          { scope: 'ui', text: 'glassmorphism redesign' },
          { scope: 'changelog', text: 'add changelog page' },
        ],
      },
    ],
    highlight: { title: 'Glass redesign is here', body: 'Frosted panels and drifting orbs.' },
    ...overrides,
  }
}

describe('whats-new-dialog', () => {
  it('renders nothing when open=false', async () => {
    const el = await fixture<WhatsNewDialog>(
      html`<whats-new-dialog .open=${false} .entry=${makeEntry()}></whats-new-dialog>`,
    )
    expect(el.shadowRoot!.querySelector('.card')).to.be.null
  })

  it('renders the card when open=true', async () => {
    const el = await fixture<WhatsNewDialog>(
      html`<whats-new-dialog .open=${true} .entry=${makeEntry()}></whats-new-dialog>`,
    )
    expect(el.shadowRoot!.querySelector('.card')).to.not.be.null
  })

  it('is a docked card, not a blocking full-screen overlay', async () => {
    const el = await fixture<WhatsNewDialog>(
      html`<whats-new-dialog .open=${true} .entry=${makeEntry()}></whats-new-dialog>`,
    )
    expect(el.shadowRoot!.querySelector('.overlay')).to.be.null
    expect(getComputedStyle(el.shadowRoot!.querySelector('.card')!).position).to.not.equal('fixed')
  })

  it('shows the highlight title', async () => {
    const el = await fixture<WhatsNewDialog>(
      html`<whats-new-dialog .open=${true} .entry=${makeEntry()}></whats-new-dialog>`,
    )
    const headline = el.shadowRoot!.querySelector('.headline')
    expect(headline?.textContent?.trim()).to.equal('Glass redesign is here')
  })

  it('shows the highlight body', async () => {
    const el = await fixture<WhatsNewDialog>(
      html`<whats-new-dialog .open=${true} .entry=${makeEntry()}></whats-new-dialog>`,
    )
    const body = el.shadowRoot!.querySelector('.highlight-body')
    expect(body?.textContent?.trim()).to.equal('Frosted panels and drifting orbs.')
  })

  it('does not render the full release list - the changelog page has it', async () => {
    const el = await fixture<WhatsNewDialog>(
      html`<whats-new-dialog .open=${true} .entry=${makeEntry()}></whats-new-dialog>`,
    )
    expect(el.shadowRoot!.querySelectorAll('.release-item').length).to.equal(0)
    expect(el.shadowRoot!.querySelector('.view-changelog')).to.not.be.null
  })

  it('has a single acknowledge button - no redundant Later', async () => {
    const el = await fixture<WhatsNewDialog>(
      html`<whats-new-dialog .open=${true} .entry=${makeEntry()}></whats-new-dialog>`,
    )
    expect(el.shadowRoot!.querySelector('.later-btn')).to.be.null
    expect(el.shadowRoot!.querySelector('.got-it-btn')).to.not.be.null
  })

  it('emits whats-new-acknowledged when Got it is clicked', async () => {
    const el = await fixture<WhatsNewDialog>(
      html`<whats-new-dialog .open=${true} .entry=${makeEntry()}></whats-new-dialog>`,
    )
    let acknowledged = false
    el.addEventListener('whats-new-acknowledged', () => { acknowledged = true })
    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>('.got-it-btn')
    btn?.click()
    expect(acknowledged).to.be.true
  })

  it('renders the version number', async () => {
    const el = await fixture<WhatsNewDialog>(
      html`<whats-new-dialog .open=${true} .entry=${makeEntry()}></whats-new-dialog>`,
    )
    const version = el.shadowRoot!.querySelector('.version-badge')
    expect(version?.textContent?.trim()).to.include('1.27.1')
  })
})
