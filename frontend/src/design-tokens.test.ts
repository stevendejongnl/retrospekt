import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The design tokens live in index.html (the app has no CSS build step for them).
// This spec pins the "Slate + Soft" values from the design's Handoff section.
const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8')

function tokensOf(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const tokens: Record<string, string> = {}
  for (const block of html.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))) {
    for (const [, name, value] of block[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      tokens[name] = value.trim()
    }
  }
  return tokens
}

const light = tokensOf(':root')
const dark = tokensOf("[data-theme='dark']")

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const isHex = (value: string | undefined): value is string => !!value && /^#[0-9a-f]{6}$/i.test(value)

const THEMED = [
  'bg-page', 'bg-surface', 'bg-subtle', 'border-default',
  'text-primary', 'text-secondary', 'text-muted',
  'accent', 'accent-ink', 'accent-contrast', 'accent-tint', 'accent-border',
  'col-1', 'col-2', 'col-3', 'col-4', 'col-5', 'col-6', 'col-ink', 'strong-bg', 'shadow-float',
]

describe('design tokens (Slate + Soft)', () => {
  it.each(THEMED)('defines --retro-%s for both themes', (name) => {
    expect(light[`--retro-${name}`], `light --retro-${name}`).toBeTruthy()
    expect(dark[`--retro-${name}`], `dark --retro-${name}`).toBeTruthy()
  })

  it('has the three radii of the shape scale', () => {
    expect(light['--retro-radius-sm']).toBe('10px')
    expect(light['--retro-radius-md']).toBe('14px')
    expect(light['--retro-radius-lg']).toBe('20px')
  })

  it('has one body font token, so the typeface changes in one place', () => {
    expect(light['--retro-font-body']).toMatch(/Inter/)
  })

  it('has a mono font token for timers, urls and numbers', () => {
    expect(light['--retro-font-mono']).toMatch(/JetBrains Mono/)
  })

  it('uses the amber accent and the cool slate page', () => {
    expect(light['--retro-accent']).toBe('#b45309')
    expect(dark['--retro-accent']).toBe('#f59e0b')
    expect(light['--retro-bg-page']).toBe('#f3f5f8')
    expect(dark['--retro-bg-page']).toBe('#0e1218')
  })

  const PAIRS: Array<[string, string]> = [
    ['text-primary', 'bg-page'],
    ['text-primary', 'bg-surface'],
    ['text-secondary', 'bg-surface'],
    ['text-muted', 'bg-surface'],
    ['text-muted', 'bg-subtle'],
    ['accent-contrast', 'accent'],
    ['accent-ink', 'bg-surface'],
    ['accent-ink', 'accent-tint'],
    ['col-ink', 'col-1'],
    ['col-ink', 'col-2'],
    ['col-ink', 'col-3'],
    ['col-ink', 'col-4'],
    ['col-ink', 'col-5'],
    ['col-ink', 'col-6'],
  ]

  describe.each([['light', light], ['dark', dark]] as const)('%s contrast (WCAG AA, 4.5:1)', (_mode, tokens) => {
    it.each(PAIRS)('%s on %s', (fg, bg) => {
      const a = tokens[`--retro-${fg}`]
      const b = tokens[`--retro-${bg}`]
      // translucent tokens (e.g. the dark accent tint) cannot be measured as a flat pair
      if (!isHex(a) || !isHex(b)) return
      expect(contrast(a, b)).toBeGreaterThanOrEqual(4.5)
    })
  })
})
