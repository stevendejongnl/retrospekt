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
    const overlay = el.shadowRoot!.querySelector('.overlay')
    expect(overlay).to.be.null
  })

  it('renders the dialog when open=true', async () => {
    const el = await fixture<WhatsNewDialog>(
      html`<whats-new-dialog .open=${true} .entry=${makeEntry()}></whats-new-dialog>`,
    )
    const overlay = el.shadowRoot!.querySelector('.overlay')
    expect(overlay).to.not.be.null
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

  it('renders feature items in the release list', async () => {
    const el = await fixture<WhatsNewDialog>(
      html`<whats-new-dialog .open=${true} .entry=${makeEntry()}></whats-new-dialog>`,
    )
    const items = el.shadowRoot!.querySelectorAll('.release-item')
    expect(items.length).to.equal(2)
  })

  it('emits whats-new-dismissed when Later is clicked', async () => {
    const el = await fixture<WhatsNewDialog>(
      html`<whats-new-dialog .open=${true} .entry=${makeEntry()}></whats-new-dialog>`,
    )
    let dismissed = false
    el.addEventListener('whats-new-dismissed', () => { dismissed = true })
    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>('.later-btn')
    btn?.click()
    expect(dismissed).to.be.true
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
