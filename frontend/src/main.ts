import { initTheme } from './theme'
import './pages/home-page'
import './pages/session-page'
import './pages/not-found-page'
import './components/retro-board'
import './components/retro-column'
import './components/retro-card'
import { router } from './router'

initTheme()
router.start()
