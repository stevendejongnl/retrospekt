import * as Sentry from '@sentry/browser'
import { initTheme, initBrand } from './theme'
import { tagManager } from './analytics'
import { storage } from './storage'

/* istanbul ignore next -- Sentry DSN not set in CT environment; only active in production */
if (window.__SENTRY_DSN__) {
  Sentry.init({ dsn: window.__SENTRY_DSN__, tracesSampleRate: 0 })
}
import './components/background-blobs'
import './components/consent-banner'
import './pages/home-page'
import './pages/session-page'
import './pages/not-found-page'
import './pages/stats-page'
import './pages/admin-page'
import './pages/feedback-page'
import './pages/changelog-page'
import './pages/privacy-page'
import './components/retro-board'
import './components/retro-column'
import './components/retro-card'
import { router } from './router'

initTheme()
initBrand()

// Nothing is tracked until consent is granted — see consent-banner.ts.
const consent = storage.getAnalyticsConsent()
if (consent === 'granted') {
  tagManager.init()
} else if (consent === null) {
  document.body.appendChild(document.createElement('consent-banner'))
}
window.addEventListener('consent-granted', () => tagManager.init())

router.start()
