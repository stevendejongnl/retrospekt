import { describe, expect, it } from 'vitest'
import { COLUMN_COLORS, columnColorVar, resolveColumnColor } from './column-colors'

describe('column colours', () => {
  it('offers six colours, the design three first', () => {
    expect(COLUMN_COLORS).toEqual(['green', 'amber', 'blue', 'red', 'purple', 'pink'])
  })

  it('maps each colour to its token', () => {
    expect(columnColorVar('green')).toBe('var(--retro-col-1)')
    expect(columnColorVar('pink')).toBe('var(--retro-col-6)')
  })

  it('uses the chosen colour for a column', () => {
    expect(resolveColumnColor({ Mad: 'red' }, 'Mad', 0)).toBe('red')
  })

  it('falls back to the position when no colour was chosen, wrapping after six', () => {
    expect(resolveColumnColor({}, 'A', 0)).toBe('green')
    expect(resolveColumnColor({}, 'B', 1)).toBe('amber')
    expect(resolveColumnColor(undefined, 'G', 6)).toBe('green')
  })
})
