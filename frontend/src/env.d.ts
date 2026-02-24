declare global {
  // Injected by Vite at build time from package.json
  const __APP_VERSION__: string

  interface Window {
    // Injected at container startup by docker-entrypoint.sh via /env.js
    __SENTRY_DSN__: string | undefined
  }
}

export {}
