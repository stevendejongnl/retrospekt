import { expect, fixture, html } from '@open-wc/testing'
import './consent-banner'
import type { ConsentBanner } from './consent-banner'

beforeEach(() => {
  localStorage.clear()
  ;(window as { router?: unknown }).router = { navigate: () => {} }
})

afterEach(() => {
  delete (window as { router?: unknown }).router
})

describe('consent-banner', () => {
  it('renders Accept and Decline buttons', async () => {
    const el = await fixture<ConsentBanner>(html`<consent-banner></consent-banner>`)
    expect(el.shadowRoot!.querySelector('.accept')).to.exist
    expect(el.shadowRoot!.querySelector('button:not(.accept)')?.textContent?.trim()).to.equal('Decline')
  })

  it('clicking Accept stores consent and dispatches consent-granted + consent-closed', async () => {
    const el = await fixture<ConsentBanner>(html`<consent-banner></consent-banner>`)
    let granted = false
    let closed = false
    el.addEventListener('consent-granted', () => { granted = true })
    el.addEventListener('consent-closed', () => { closed = true })
    el.shadowRoot!.querySelector<HTMLButtonElement>('.accept')!.click()
    expect(localStorage.getItem('retro_analytics_consent')).to.equal('granted')
    expect(granted).to.be.true
    expect(closed).to.be.true
  })

  it('clicking Decline stores consent and dispatches consent-closed only', async () => {
    const el = await fixture<ConsentBanner>(html`<consent-banner></consent-banner>`)
    let granted = false
    let closed = false
    el.addEventListener('consent-granted', () => { granted = true })
    el.addEventListener('consent-closed', () => { closed = true })
    el.shadowRoot!.querySelector<HTMLButtonElement>('button:not(.accept)')!.click()
    expect(localStorage.getItem('retro_analytics_consent')).to.equal('denied')
    expect(granted).to.be.false
    expect(closed).to.be.true
  })

  it('does not position itself - the notification dock owns the docking', async () => {
    const el = await fixture<ConsentBanner>(html`<consent-banner></consent-banner>`)
    expect(getComputedStyle(el).position).to.not.equal('fixed')
  })
})
