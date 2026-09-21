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

  it('clicking Accept stores consent, dispatches consent-granted, and removes the banner', async () => {
    const el = await fixture<ConsentBanner>(html`<consent-banner></consent-banner>`)
    let granted = false
    el.addEventListener('consent-granted', () => { granted = true })
    el.shadowRoot!.querySelector<HTMLButtonElement>('.accept')!.click()
    expect(localStorage.getItem('retro_analytics_consent')).to.equal('granted')
    expect(granted).to.be.true
    expect(el.isConnected).to.be.false
  })

  it('clicking Decline stores consent and removes the banner without dispatching an event', async () => {
    const el = await fixture<ConsentBanner>(html`<consent-banner></consent-banner>`)
    let granted = false
    el.addEventListener('consent-granted', () => { granted = true })
    el.shadowRoot!.querySelector<HTMLButtonElement>('button:not(.accept)')!.click()
    expect(localStorage.getItem('retro_analytics_consent')).to.equal('denied')
    expect(granted).to.be.false
    expect(el.isConnected).to.be.false
  })
})
