import { expect, fixture, html } from '@open-wc/testing'
import './not-found-page'
import type { NotFoundPage } from './not-found-page'

afterEach(() => {
  // Restore any router stub placed by a test
  delete (window as { router?: unknown }).router
})

describe('not-found-page', () => {
  it('renders the 404 heading', async () => {
    ;(window as { router?: unknown }).router = { navigate: () => {} }
    const el = await fixture<NotFoundPage>(html`<not-found-page></not-found-page>`)
    const heading = el.shadowRoot!.querySelector('h2')
    expect(heading?.textContent?.trim()).to.equal('404 — Nothing to retrospekt')
  })

  it('clicking the back link calls window.router.navigate("/")', async () => {
    let navigatedTo: string | null = null
    ;(window as { router?: unknown }).router = {
      navigate: (path: string) => {
        navigatedTo = path
      },
    }
    const el = await fixture<NotFoundPage>(html`<not-found-page></not-found-page>`)
    el.shadowRoot!.querySelector<HTMLAnchorElement>('a')!.click()
    expect(navigatedTo).to.equal('/')
  })
})
