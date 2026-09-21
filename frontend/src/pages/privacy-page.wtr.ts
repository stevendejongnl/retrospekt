import { expect, fixture, html } from '@open-wc/testing'
import './privacy-page'
import type { PrivacyPage } from './privacy-page'

afterEach(() => {
  delete (window as { router?: unknown }).router
})

describe('privacy-page', () => {
  it('renders a heading and mentions the data we collect', async () => {
    const el = await fixture<PrivacyPage>(html`<privacy-page></privacy-page>`)
    const heading = el.shadowRoot!.querySelector('h1')
    expect(heading?.textContent?.toLowerCase()).to.contain('privacy')
    expect(el.shadowRoot!.textContent).to.contain('Matomo')
    expect(el.shadowRoot!.textContent).to.contain('Sentry')
  })

  it('clicking the back link calls window.router.navigate("/")', async () => {
    let navigatedTo: string | null = null
    ;(window as { router?: unknown }).router = {
      navigate: (path: string) => { navigatedTo = path },
    }
    const el = await fixture<PrivacyPage>(html`<privacy-page></privacy-page>`)
    el.shadowRoot!.querySelector<HTMLAnchorElement>('.back-pill')!.click()
    expect(navigatedTo).to.equal('/')
  })
})
