import { describe, expect, it } from 'vitest'
import { COMPARED_SCREENS, PARITY_SCREENS, PENDING_SCREENS } from './screens'

describe('parity screens', () => {
  it('has a unique name for every screen', () => {
    const names = PARITY_SCREENS.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('uses whole-pixel sizes of at least 300 px', () => {
    for (const { name, size } of PARITY_SCREENS) {
      expect(size.every((n) => Number.isInteger(n) && n >= 300), name).toBe(true)
    }
  })

  it('covers every comparable view of the design: pages, boards per phase and theme, and the CS brand', () => {
    const names = PARITY_SCREENS.map((s) => s.name)
    for (const expected of [
      'home-light', 'home-dark', 'home-cs-brand',
      'board-collecting-light', 'board-collecting-dark', 'board-discussing-light', 'board-discussing-dark',
      'board-closed-light', 'board-closed-dark', 'board-cs-brand',
      'stats-light', 'stats-dark', 'privacy-light', 'privacy-dark', 'not-found-light', 'not-found-dark',
      'changelog-light', 'changelog-dark', 'feedback-page-light', 'feedback-page-dark',
    ]) {
      expect(names, expected).toContain(expected)
    }
  })

  it('says why a screen cannot be compared yet', () => {
    expect(PENDING_SCREENS.length).toBeGreaterThan(0)
    for (const screen of PENDING_SCREENS) expect(screen.pending, screen.name).toMatch(/.{20,}/)
  })

  it('compares every screen that is not pending', () => {
    expect(COMPARED_SCREENS.length + PENDING_SCREENS.length).toBe(PARITY_SCREENS.length)
    expect(COMPARED_SCREENS.length).toBeGreaterThan(20)
  })

  it('gives every board screen a facilitator or participant, and the CS brand a light theme only', () => {
    for (const screen of PARITY_SCREENS.filter((s) => s.route.startsWith('/session/') && !s.name.startsWith('join'))) {
      expect(['facilitator', 'participant'], screen.name).toContain(screen.viewer)
    }
    for (const screen of PARITY_SCREENS.filter((s) => s.brand === 'cs')) expect(screen.theme).toBe('light')
  })
})
