const STORAGE_KEY = 'retro_theme'
type ThemePreference = 'light' | 'dark'

function applyTheme(theme: ThemePreference): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export function getEffectiveTheme(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function toggleTheme(): void {
  const next: ThemePreference = getEffectiveTheme() === 'dark' ? 'light' : 'dark'
  localStorage.setItem(STORAGE_KEY, next)
  applyTheme(next)
  window.dispatchEvent(new CustomEvent('retro-theme-change', { detail: { theme: next } }))
}

export function initTheme(): void {
  applyTheme(getEffectiveTheme())
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light')
    }
  })
}
