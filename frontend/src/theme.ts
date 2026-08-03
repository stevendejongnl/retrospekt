const STORAGE_KEY = 'retro_theme'
type ThemePreference = 'light' | 'dark'
type ThemeChoice = ThemePreference | 'system'

const HALAL_STORAGE_KEY = 'retro_halal_mode'

const BRAND_STORAGE_KEY = 'retro_brand'
const SUPPORTED_BRANDS = ['cs'] as const
type Brand = (typeof SUPPORTED_BRANDS)[number]

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

export function getThemePreference(): ThemeChoice {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return 'system'
}

export function setThemePreference(choice: ThemeChoice): void {
  if (choice === 'system') {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, choice)
  }
  const effective = getEffectiveTheme()
  applyTheme(effective)
  window.dispatchEvent(new CustomEvent('retro-theme-change', { detail: { theme: effective } }))
}

export function getHalalMode(): boolean {
  return localStorage.getItem(HALAL_STORAGE_KEY) === 'true'
}

export function setHalalMode(enabled: boolean): void {
  if (enabled) localStorage.setItem(HALAL_STORAGE_KEY, 'true')
  else localStorage.removeItem(HALAL_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent('retro-halal-change', { detail: { halal: enabled } }))
}

export function bacon(): string {
  return getHalalMode() ? '🍆' : '🥓'
}

export function getBrand(): Brand | null {
  const v = localStorage.getItem(BRAND_STORAGE_KEY)
  return (SUPPORTED_BRANDS as readonly string[]).includes(v ?? '') ? (v as Brand) : null
}

function applyBrand(brand: Brand | null): void {
  if (brand) document.documentElement.setAttribute('data-brand', brand)
  else document.documentElement.removeAttribute('data-brand')
}

export function clearBrand(): void {
  localStorage.removeItem(BRAND_STORAGE_KEY)
  applyBrand(null)
  applyTheme(getEffectiveTheme())
  window.dispatchEvent(new CustomEvent('retro-brand-change'))
  window.dispatchEvent(new CustomEvent('retro-theme-change'))
}

export function initBrand(): void {
  const params = new URLSearchParams(window.location.search)
  const urlTheme = params.get('theme')
  if (urlTheme !== null) {
    if ((SUPPORTED_BRANDS as readonly string[]).includes(urlTheme))
      localStorage.setItem(BRAND_STORAGE_KEY, urlTheme)
    const clean = new URL(window.location.href)
    clean.searchParams.delete('theme')
    history.replaceState(null, '', clean.toString())
  }
  applyBrand(getBrand())
  if (getBrand() === 'cs') applyTheme('light')
}

export function initTheme(): void {
  applyTheme(getEffectiveTheme())
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light')
    }
  })
}
