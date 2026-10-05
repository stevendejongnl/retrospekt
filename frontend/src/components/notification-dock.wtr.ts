import { expect, fixture, html } from '@open-wc/testing'
import type { ChangelogEntry } from '../generated/changelog'
import './notification-dock'
import { notifications } from './notification-dock'
import type { NotificationDock } from './notification-dock'

function makeEntry(): ChangelogEntry {
  return {
    version: '1.27.1',
    date: '2026-03-23',
    groups: [{ kind: 'Features', items: [{ scope: 'ui', text: 'glassmorphism redesign' }] }],
    highlight: { title: 'Glass redesign is here', body: 'Frosted panels and drifting orbs.' },
  }
}

function dock(): NotificationDock | null {
  return document.querySelector('notification-dock')
}

async function settled(): Promise<NotificationDock> {
  const el = dock()!
  await el.updateComplete
  return el
}

beforeEach(() => {
  localStorage.clear()
  ;(window as { router?: unknown }).router = { navigate: () => {} }
})

afterEach(() => {
  dock()?.remove()
  delete (window as { router?: unknown }).router
})

describe('notification-dock', () => {
  it('is created lazily in document.body on the first notification', async () => {
    expect(dock()).to.be.null
    notifications.consent()
    expect(dock()).to.not.be.null
    expect(dock()!.parentElement).to.equal(document.body)
  })

  it('reuses the same dock across notifications', async () => {
    notifications.consent()
    const first = dock()
    notifications.feedback({})
    expect(dock()).to.equal(first)
  })

  it('re-creates the dock if it was removed from the document', async () => {
    notifications.consent()
    dock()!.remove()
    notifications.consent()
    expect(dock()).to.not.be.null
    expect(dock()!.isConnected).to.be.true
  })

  it('stacks consent, feedback and whats-new at the same time', async () => {
    notifications.consent()
    notifications.feedback({ sessionId: 's1', participantName: 'Alice' })
    notifications.whatsNew(makeEntry())
    const el = await settled()
    expect(el.shadowRoot!.querySelector('consent-banner')).to.not.be.null
    expect(el.shadowRoot!.querySelector('feedback-dialog')).to.not.be.null
    expect(el.shadowRoot!.querySelector('whats-new-dialog')).to.not.be.null
  })

  it('keeps the first-added notification nearest the corner (call order = DOM order)', async () => {
    notifications.consent()
    notifications.feedback({})
    const el = await settled()
    const tags = [...el.shadowRoot!.children].map((c) => c.tagName.toLowerCase())
    expect(tags).to.deep.equal(['consent-banner', 'feedback-dialog'])
  })

  it('never stacks two notifications of the same kind', async () => {
    notifications.feedback({})
    notifications.feedback({})
    const el = await settled()
    expect(el.shadowRoot!.querySelectorAll('feedback-dialog').length).to.equal(1)
  })

  it('passes sessionId and participantName through to the feedback card', async () => {
    notifications.feedback({ sessionId: 's1', participantName: 'Alice' })
    const el = await settled()
    const card = el.shadowRoot!.querySelector('feedback-dialog')!
    expect(card.sessionId).to.equal('s1')
    expect(card.participantName).to.equal('Alice')
  })

  it('passes the changelog entry through to the whats-new card', async () => {
    notifications.whatsNew(makeEntry())
    const el = await settled()
    const card = el.shadowRoot!.querySelector('whats-new-dialog')!
    expect(card.entry?.version).to.equal('1.27.1')
  })

  it('removes a feedback card and runs its onClose when it is dismissed', async () => {
    let closed = false
    notifications.feedback({ onClose: () => { closed = true } })
    const el = await settled()
    el.shadowRoot!.querySelector('feedback-dialog')!
      .dispatchEvent(new CustomEvent('feedback-dismissed', { bubbles: true, composed: true }))
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('feedback-dialog')).to.be.null
    expect(closed).to.be.true
  })

  it('removes the whats-new card on acknowledge', async () => {
    let closed = 0
    notifications.whatsNew(makeEntry(), { onClose: () => { closed += 1 } })
    const el = await settled()
    el.shadowRoot!.querySelector('whats-new-dialog')!
      .dispatchEvent(new CustomEvent('whats-new-acknowledged', { bubbles: true, composed: true }))
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('whats-new-dialog')).to.be.null
    expect(closed).to.equal(1)
  })

  it('removes the consent banner once it is answered', async () => {
    notifications.consent()
    const el = await settled()
    el.shadowRoot!.querySelector('consent-banner')!
      .dispatchEvent(new CustomEvent('consent-closed', { bubbles: true, composed: true }))
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('consent-banner')).to.be.null
  })

  it('dismissing one card leaves the others stacked', async () => {
    notifications.consent()
    notifications.feedback({})
    const el = await settled()
    el.shadowRoot!.querySelector('feedback-dialog')!
      .dispatchEvent(new CustomEvent('feedback-dismissed', { bubbles: true, composed: true }))
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('feedback-dialog')).to.be.null
    expect(el.shadowRoot!.querySelector('consent-banner')).to.not.be.null
  })

  it('docks bottom-left and never captures pointer events itself', async () => {
    const el = await fixture<NotificationDock>(html`<notification-dock></notification-dock>`)
    const style = getComputedStyle(el)
    expect(style.position).to.equal('fixed')
    expect(style.pointerEvents).to.equal('none')
    expect(style.flexDirection).to.equal('column-reverse')
  })
})
