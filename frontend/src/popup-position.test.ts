import { describe, it, expect } from 'vitest'
import { computePopupPosition } from './popup-position'

function rect(partial: Partial<DOMRect>): DOMRect {
  return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...partial } as DOMRect
}

describe('computePopupPosition', () => {
  it('opens below and aligns left with the trigger when there is plenty of room', () => {
    const pos = computePopupPosition(rect({ top: 100, bottom: 126, left: 50, right: 76 }), 1000, 800, 260, 260)
    expect(pos.left).toBe(50)
    expect(pos.top).toBe(126 + 8)
  })

  it('clamps left so the popup never overflows the right edge of the viewport', () => {
    const pos = computePopupPosition(rect({ top: 100, bottom: 126, left: 950, right: 976 }), 1000, 800, 260, 260)
    expect(pos.left).toBe(1000 - 260 - 8)
    expect(pos.left + 260).toBeLessThanOrEqual(1000)
  })

  it('never clamps left below the margin, even for a trigger near x=0', () => {
    const pos = computePopupPosition(rect({ top: 100, bottom: 126, left: -5, right: 21 }), 1000, 800, 260, 260)
    expect(pos.left).toBe(8)
  })

  it('opens above the trigger when there is not enough room below but there is above', () => {
    const pos = computePopupPosition(rect({ top: 700, bottom: 726, left: 50, right: 76 }), 1000, 800, 260, 260)
    expect(pos.top).toBe(700 - 260 - 8)
    expect(pos.top + 260).toBeLessThanOrEqual(726)
  })

  it('never produces a top less than the margin, even when squeezed', () => {
    const pos = computePopupPosition(rect({ top: 50, bottom: 76, left: 50, right: 76 }), 1000, 100, 260, 260)
    expect(pos.top).toBeGreaterThanOrEqual(8)
  })

  it('never produces a bottom edge past the viewport height', () => {
    const pos = computePopupPosition(rect({ top: 780, bottom: 796, left: 50, right: 76 }), 1000, 800, 260, 260)
    expect(pos.top + 260).toBeLessThanOrEqual(800)
  })
})
