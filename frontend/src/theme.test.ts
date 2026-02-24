import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEffectiveTheme, toggleTheme, initTheme } from './theme'

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
