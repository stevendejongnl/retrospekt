import { expect, fixture, html, oneEvent } from '@open-wc/testing'
import type { GifPicker } from './gif-picker'

const SEARCH_DEBOUNCE_MS = 350

// api.ts's singleton captures `fetch` as a default parameter value at
// module-evaluation time — reassigning globalThis.fetch afterward has no
// effect on it. So the stub below must be in place BEFORE api.ts (imported
// transitively by gif-picker.ts) is first evaluated. A static `import
// './gif-picker'` would be hoisted ahead of this file's own top-level code,
// defeating that — so it's imported dynamically, after the stub, instead.
let currentHandler: (url: string) => Promise<Response> = () => Promise.resolve(new Response('{}', { status: 200 }))
;(globalThis as { fetch: typeof fetch }).fetch = ((input: RequestInfo | URL) =>
  currentHandler(String(input))) as typeof fetch

before(async () => {
  await import('./gif-picker')
})

function stubFetch(handlers: { status?: boolean; results?: unknown[] }): void {
  const { status = true, results = [] } = handlers
  currentHandler = async (url) => {
    if (url.includes('/gifs/status')) return new Response(JSON.stringify({ enabled: status }), { status: 200 })
    if (url.includes('/gifs/search')) return new Response(JSON.stringify(results), { status: 200 })
    return new Response('not found', { status: 404 })
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

describe('gif-picker', () => {
  it('renders nothing when no GIF provider is configured', async () => {
    stubFetch({ status: false })
    const el = await fixture<GifPicker>(html`<gif-picker></gif-picker>`)
    await wait(10)
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('.trigger')).to.not.exist
  })

  it('renders the trigger once the backend reports a provider is configured', async () => {
    stubFetch({ status: true })
    const el = await fixture<GifPicker>(html`<gif-picker></gif-picker>`)
    await wait(10)
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('.trigger')).to.exist
  })

  it('clicking the trigger opens the popup with a search input', async () => {
    stubFetch({ status: true })
    const el = await fixture<GifPicker>(html`<gif-picker></gif-picker>`)
    await wait(10)
    await el.updateComplete
    el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('.search-input')).to.exist
  })

  it('typing debounces a search and renders results as thumbnail buttons', async () => {
    stubFetch({
      status: true,
      results: [
        { id: 'g1', preview_url: 'https://x/small.gif', url: 'https://x/full.gif', provider: 'giphy' },
      ],
    })
    const el = await fixture<GifPicker>(html`<gif-picker></gif-picker>`)
    await wait(10)
    await el.updateComplete
    el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
    await el.updateComplete

    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.search-input')!
    input.value = 'cat'
    input.dispatchEvent(new Event('input'))
    await wait(SEARCH_DEBOUNCE_MS + 50)
    await el.updateComplete

    const buttons = el.shadowRoot!.querySelectorAll('.gif-btn')
    expect(buttons.length).to.equal(1)
    expect(buttons[0].querySelector('img')!.getAttribute('src')).to.equal('https://x/small.gif')
  })

  it('clicking a result dispatches pick-gif with the full-quality url and closes', async () => {
    stubFetch({
      status: true,
      results: [
        { id: 'g1', preview_url: 'https://x/small.gif', url: 'https://x/full.gif', provider: 'giphy' },
      ],
    })
    const el = await fixture<GifPicker>(html`<gif-picker></gif-picker>`)
    await wait(10)
    await el.updateComplete
    el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
    await el.updateComplete
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.search-input')!
    input.value = 'cat'
    input.dispatchEvent(new Event('input'))
    await wait(SEARCH_DEBOUNCE_MS + 50)
    await el.updateComplete

    const listener = oneEvent(el, 'pick-gif')
    el.shadowRoot!.querySelector<HTMLButtonElement>('.gif-btn')!.click()
    const { detail } = await listener
    expect(detail.url).to.equal('https://x/full.gif')
    expect(el.shadowRoot!.querySelector('.popup')).to.not.exist
  })

  it('pressing Escape closes the popup', async () => {
    stubFetch({ status: true })
    const el = await fixture<GifPicker>(html`<gif-picker></gif-picker>`)
    await wait(10)
    await el.updateComplete
    el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('.popup')).to.exist
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('.popup')).to.not.exist
  })
})
