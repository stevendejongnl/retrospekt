import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MatomoTagManager, tagManager, type TagManager } from './analytics'

describe('MatomoTagManager', () => {
  const containerUrl = 'https://analytics.example.test/js/container_test.js'
  let matomo: MatomoTagManager

  beforeEach(() => {
    matomo = new MatomoTagManager(containerUrl)
    const anchor = document.createElement('script')
    document.body.appendChild(anchor)
  })

  afterEach(() => {
    delete window._mtm
    document.body.replaceChildren()
  })

  it('creates window._mtm lazily and pushes an mtm.Start event on init', () => {
    matomo.init()
    expect(window._mtm).toBeDefined()
    const events = window._mtm!.map((entry) => entry.event)
    expect(events).toContain('mtm.Start')
  })

  it('injects the container script tag pointing at the configured URL', () => {
    matomo.init()
    const script = document.querySelector(`script[src="${containerUrl}"]`)
    expect(script).not.toBeNull()
    expect((script as HTMLScriptElement).async).toBe(true)
  })

  it('pushes a custom event with page url and title on trackPageView', () => {
    window._mtm = []
    matomo.trackPageView('/stats', 'Stats — Retrospekt')
    const entry = window._mtm.find((e) => e.event === 'retrospektPageView')
    expect(entry).toEqual({
      event: 'retrospektPageView',
      pageUrl: '/stats',
      pageTitle: 'Stats — Retrospekt',
    })
  })

  it('creates window._mtm lazily if trackPageView is called before init', () => {
    matomo.trackPageView('/', 'Retrospekt')
    expect(window._mtm).toBeDefined()
  })
})

describe('tagManager', () => {
  it('exports a singleton conforming to the TagManager interface', () => {
    const t: TagManager = tagManager
    expect(typeof t.init).toBe('function')
    expect(typeof t.trackPageView).toBe('function')
  })
})
