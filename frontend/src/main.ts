import * as Sentry from '@sentry/browser'
import { initTheme, initBrand } from './theme'

if (window.__SENTRY_DSN__) {
  Sentry.init({ dsn: window.__SENTRY_DSN__, tracesSampleRate: 0 })
}
import './pages/home-page'
import './pages/session-page'
import './pages/not-found-page'
import './components/retro-board'
import './components/retro-column'
import './components/retro-card'
import { router } from './router'

initTheme()
initBrand()
router.start()
