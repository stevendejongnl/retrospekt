import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getEffectiveTheme,
  toggleTheme,
  initTheme,
  getBrand,
  initBrand,
  clearBrand,
  getThemePreference,
  setThemePreference,
  getHalalMode,
  setHalalMode,
  bacon,
} from './theme'

// jsdom doesn't implement matchMedia — stub it
function mockMatchMedia(prefersDark: boolean) {
  const mql = {
    matches: prefersDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => mql))
  return mql
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-brand')
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

describe('getEffectiveTheme', () => {
  it('returns stored "light" when set', () => {
    mockMatchMedia(true) // system = dark, but stored overrides
    localStorage.setItem('retro_theme', 'light')
    expect(getEffectiveTheme()).toBe('light')
  })

  it('returns stored "dark" when set', () => {
    mockMatchMedia(false) // system = light, but stored overrides
    localStorage.setItem('retro_theme', 'dark')
    expect(getEffectiveTheme()).toBe('dark')
  })

  it('falls back to system dark preference when nothing is stored', () => {
    mockMatchMedia(true)
    expect(getEffectiveTheme()).toBe('dark')
  })

  it('falls back to light when system preference is light and nothing stored', () => {
    mockMatchMedia(false)
    expect(getEffectiveTheme()).toBe('light')
  })
})

describe('toggleTheme', () => {
  it('switches from dark to light', () => {
    mockMatchMedia(true)
    // System is dark, no stored value → effective = dark
    toggleTheme()
    expect(localStorage.getItem('retro_theme')).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('switches from light to dark', () => {
    mockMatchMedia(false)
    localStorage.setItem('retro_theme', 'light')
    toggleTheme()
    expect(localStorage.getItem('retro_theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('dispatches retro-theme-change event with the new theme', () => {
    mockMatchMedia(false)
    localStorage.setItem('retro_theme', 'light')
    const handler = vi.fn()
    window.addEventListener('retro-theme-change', handler)
    toggleTheme()
    window.removeEventListener('retro-theme-change', handler)
    expect(handler).toHaveBeenCalledOnce()
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ theme: 'dark' })
  })
})

describe('initTheme', () => {
  it('applies the effective theme to document on init', () => {
    mockMatchMedia(false)
    localStorage.setItem('retro_theme', 'dark')
    initTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('listens for system preference changes and applies them when no stored theme', () => {
    const mql = mockMatchMedia(false)
    initTheme()
    // Simulate system change to dark
    const changeHandler = mql.addEventListener.mock.calls[0][1] as (e: MediaQueryListEvent) => void
    changeHandler({ matches: true } as MediaQueryListEvent)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('applies light theme when system preference changes to light and no stored theme', () => {
    const mql = mockMatchMedia(true)
    initTheme()
    const changeHandler = mql.addEventListener.mock.calls[0][1] as (e: MediaQueryListEvent) => void
    changeHandler({ matches: false } as MediaQueryListEvent) // system → light
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('ignores system preference changes when a theme is explicitly stored', () => {
    const mql = mockMatchMedia(false)
    localStorage.setItem('retro_theme', 'light')
    initTheme()
    const changeHandler = mql.addEventListener.mock.calls[0][1] as (e: MediaQueryListEvent) => void
    changeHandler({ matches: true } as MediaQueryListEvent) // system → dark, but stored = light
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})

describe('getBrand', () => {
  it('returns null when no localStorage entry exists', () => {
    expect(getBrand()).toBeNull()
  })

  it('returns "cs" when retro_brand = "cs"', () => {
    localStorage.setItem('retro_brand', 'cs')
    expect(getBrand()).toBe('cs')
  })

  it('returns null for unrecognised stored value', () => {
    localStorage.setItem('retro_brand', 'unknown')
    expect(getBrand()).toBeNull()
  })
})

describe('initBrand', () => {
  it('sets data-brand="cs" on documentElement from localStorage on startup', () => {
    localStorage.setItem('retro_brand', 'cs')
    initBrand()
    expect(document.documentElement.getAttribute('data-brand')).toBe('cs')
  })

  it('does not set data-brand when localStorage is empty', () => {
    initBrand()
    expect(document.documentElement.getAttribute('data-brand')).toBeNull()
  })

  it('reads ?theme=cs URL param, stores "cs" in localStorage, sets data-brand', () => {
    window.history.replaceState(null, '', '/?theme=cs')
    initBrand()
    expect(localStorage.getItem('retro_brand')).toBe('cs')
    expect(document.documentElement.getAttribute('data-brand')).toBe('cs')
  })

  it('ignores unknown ?theme=unknown — no storage written, no attribute set', () => {
    window.history.replaceState(null, '', '/?theme=unknown')
    initBrand()
    expect(localStorage.getItem('retro_brand')).toBeNull()
    expect(document.documentElement.getAttribute('data-brand')).toBeNull()
  })

  it('does not overwrite existing localStorage when no URL param is present', () => {
    localStorage.setItem('retro_brand', 'cs')
    initBrand()
    expect(localStorage.getItem('retro_brand')).toBe('cs')
  })

  it('strips ?theme= from URL via history.replaceState after processing', () => {
    window.history.replaceState(null, '', '/?theme=cs')
    initBrand()
    expect(window.location.search).toBe('')
  })

  it('strips unknown ?theme= from URL even when value is invalid', () => {
    window.history.replaceState(null, '', '/?theme=unknown')
    initBrand()
    expect(window.location.search).toBe('')
  })
})

describe('getThemePreference / setThemePreference', () => {
  it('returns "system" when nothing is stored', () => {
    expect(getThemePreference()).toBe('system')
  })

  it('returns "light" when stored', () => {
    localStorage.setItem('retro_theme', 'light')
    expect(getThemePreference()).toBe('light')
  })

  it('returns "dark" when stored', () => {
    localStorage.setItem('retro_theme', 'dark')
    expect(getThemePreference()).toBe('dark')
  })

  it('setThemePreference("dark") stores and applies dark', () => {
    mockMatchMedia(false)
    setThemePreference('dark')
    expect(localStorage.getItem('retro_theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('setThemePreference("light") stores and applies light', () => {
    mockMatchMedia(true)
    setThemePreference('light')
    expect(localStorage.getItem('retro_theme')).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('setThemePreference("system") clears storage and applies system preference', () => {
    mockMatchMedia(true)
    localStorage.setItem('retro_theme', 'light')
    setThemePreference('system')
    expect(localStorage.getItem('retro_theme')).toBeNull()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('dispatches retro-theme-change on setThemePreference', () => {
    mockMatchMedia(false)
    const handler = vi.fn()
    window.addEventListener('retro-theme-change', handler)
    setThemePreference('dark')
    window.removeEventListener('retro-theme-change', handler)
    expect(handler).toHaveBeenCalledOnce()
  })
})

describe('halal mode', () => {
  it('getHalalMode returns false by default', () => {
    expect(getHalalMode()).toBe(false)
  })

  it('setHalalMode(true) persists and getHalalMode reflects it', () => {
    setHalalMode(true)
    expect(getHalalMode()).toBe(true)
  })

  it('setHalalMode(false) clears the stored flag', () => {
    setHalalMode(true)
    setHalalMode(false)
    expect(getHalalMode()).toBe(false)
  })

  it('dispatches retro-halal-change when toggled', () => {
    const handler = vi.fn()
    window.addEventListener('retro-halal-change', handler)
    setHalalMode(true)
    window.removeEventListener('retro-halal-change', handler)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('bacon() returns the pig emoji when halal mode is off', () => {
    setHalalMode(false)
    expect(bacon()).toBe('🥓')
  })

  it('bacon() returns the eggplant emoji when halal mode is on', () => {
    setHalalMode(true)
    expect(bacon()).toBe('🍆')
  })
})

describe('clearBrand', () => {
  it('removes retro_brand from localStorage and data-brand attribute', () => {
    mockMatchMedia(false)
    localStorage.setItem('retro_brand', 'cs')
    document.documentElement.setAttribute('data-brand', 'cs')
    clearBrand()
    expect(localStorage.getItem('retro_brand')).toBeNull()
    expect(document.documentElement.getAttribute('data-brand')).toBeNull()
  })

  it('dispatches retro-brand-change and retro-theme-change events', () => {
    mockMatchMedia(false)
    const brandHandler = vi.fn()
    const themeHandler = vi.fn()
    window.addEventListener('retro-brand-change', brandHandler)
    window.addEventListener('retro-theme-change', themeHandler)
    clearBrand()
    expect(brandHandler).toHaveBeenCalledTimes(1)
    expect(themeHandler).toHaveBeenCalledTimes(1)
    window.removeEventListener('retro-brand-change', brandHandler)
    window.removeEventListener('retro-theme-change', themeHandler)
  })
})
