import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// router.ts runs `new Router(document.getElementById('app')!)` at module load time.
// We must use vi.resetModules() + dynamic import() so the #app div exists
// in the DOM before the module executes.
describe('Router', () => {
  let router: { navigate: (path: string) => void }

  beforeEach(async () => {
    vi.resetModules()

    // Create a fresh #app outlet for this test
    const app = document.createElement('div')
    app.id = 'app'
    document.body.replaceChildren(app)

    // Dynamic import picks up the freshly-cleared module cache and the live #app
    const mod = await import('./router')
    router = mod.router
  })

  afterEach(() => {
    document.body.replaceChildren()
  })

  it('routes / to <home-page> and sets the correct document title', () => {
    router.navigate('/')
    const app = document.getElementById('app')!
    expect(app.children[0].tagName.toLowerCase()).toBe('home-page')
    expect(document.title).toBe('Retrospekt')
  })

  it('routes /session/:id to <session-page> with session-id attribute', () => {
    router.navigate('/session/abc123')
    const app = document.getElementById('app')!
    const el = app.children[0]
    expect(el.tagName.toLowerCase()).toBe('session-page')
    expect(el.getAttribute('session-id')).toBe('abc123')
  })

  it('routes /privacy to <privacy-page>', () => {
    router.navigate('/privacy')
    const app = document.getElementById('app')!
    expect(app.children[0].tagName.toLowerCase()).toBe('privacy-page')
    expect(document.title).toBe('Privacy — Retrospekt')
  })

  it('routes unknown paths to <not-found-page> (wildcard fallback)', () => {
    router.navigate('/this/does/not/exist')
    const app = document.getElementById('app')!
    expect(app.children[0].tagName.toLowerCase()).toBe('not-found-page')
  })

  it('start() performs the initial route render', () => {
    window.history.pushState({}, '', '/session/start-test')
    ;(router as unknown as { start: () => void }).start()
    const app = document.getElementById('app')!
    expect(app.children[0].tagName.toLowerCase()).toBe('session-page')
  })

  it('re-routes when a popstate event fires', () => {
    // Push a URL that matches a known route
    window.history.pushState({}, '', '/session/xyz')
    window.dispatchEvent(new PopStateEvent('popstate'))
    const app = document.getElementById('app')!
    const el = app.children[0]
    expect(el.tagName.toLowerCase()).toBe('session-page')
    expect(el.getAttribute('session-id')).toBe('xyz')
  })

  describe('analytics tracking', () => {
    afterEach(() => {
      delete window._mtm
    })

    it('pushes a tag manager page-view event on navigate', () => {
      window._mtm = []
      router.navigate('/stats')
      const entry = window._mtm.find((e) => e.event === 'retrospektPageView')
      expect(entry).toEqual({
        event: 'retrospektPageView',
        pageUrl: '/stats',
        pageTitle: 'Stats — Retrospekt',
      })
    })

    it('creates window._mtm lazily if the tag manager script has not loaded yet', () => {
      router.navigate('/stats')
      expect(window._mtm).toBeDefined()
    })
  })
})
