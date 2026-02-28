export interface Route {
  path: string
  component: string
  title: string
}

const routes: Route[] = [
  { path: '/', component: 'home-page', title: 'Retrospekt' },
  { path: '/session/:id', component: 'session-page', title: 'Retrospekt — Session' },
  { path: '/stats', component: 'stats-page', title: 'Stats — Retrospekt' },
  { path: '*', component: 'not-found-page', title: 'Not Found — Retrospekt' },
]

function matchRoute(path: string): { route: Route; params: Record<string, string> } {
  for (const route of routes) {
    if (route.path === path) return { route, params: {} }

    if (route.path.includes(':')) {
      const paramNames = (route.path.match(/:[^/]+/g) ?? []).map((p) => p.slice(1))
      const pattern = route.path.replace(/:[^/]+/g, '([^/]+)')
      const match = path.match(new RegExp(`^${pattern}$`))
      if (match) {
        const params = Object.fromEntries(paramNames.map((name, i) => [name, match[i + 1]]))
        return { route, params }
      }
    }
  }
  return { route: routes[routes.length - 1], params: {} }
}

class Router {
  private outlet: HTMLElement

  constructor(outlet: HTMLElement) {
    this.outlet = outlet
    window.addEventListener('popstate', () => this.handleRoute())
  }

  navigate(path: string): void {
    window.history.pushState({}, '', path)
    this.handleRoute()
  }

  handleRoute(): void {
    const { route, params } = matchRoute(window.location.pathname)
    document.title = route.title

    // Use replaceChildren() — safe DOM clearing (no innerHTML)
    const el = document.createElement(route.component)
    if (params.id) el.setAttribute('session-id', params.id)
    this.outlet.replaceChildren(el)
  }

  start(): void {
    this.handleRoute()
  }
}

export const router = new Router(document.getElementById('app')!)

// Expose globally so Lit components can navigate without circular imports
declare global {
  interface Window {
    router: Router
  }
}
window.router = router
