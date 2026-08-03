import { describe, it, expect } from 'vitest'
import { parseChecklistLine, toggleChecklistLine } from './components/board-notes'

describe('parseChecklistLine', () => {
  it('parses an unchecked item', () => {
    expect(parseChecklistLine('- [ ] write tests')).toEqual({ checked: false, label: 'write tests' })
  })

  it('parses a checked item', () => {
    expect(parseChecklistLine('- [x] deploy')).toEqual({ checked: true, label: 'deploy' })
  })

  it('parses a checked item with uppercase X', () => {
    expect(parseChecklistLine('- [X] deploy')).toEqual({ checked: true, label: 'deploy' })
  })

  it('returns null for a plain text line', () => {
    expect(parseChecklistLine('just some text')).toBeNull()
  })

  it('returns null for an empty line', () => {
    expect(parseChecklistLine('')).toBeNull()
  })
})

describe('toggleChecklistLine', () => {
  it('toggles an unchecked line to checked at the given index', () => {
    const text = '- [ ] a\n- [ ] b'
    expect(toggleChecklistLine(text, 1)).toBe('- [ ] a\n- [x] b')
  })

  it('toggles a checked line to unchecked', () => {
    const text = '- [x] a'
    expect(toggleChecklistLine(text, 0)).toBe('- [ ] a')
  })

  it('leaves non-checklist lines untouched when toggling another line', () => {
    const text = 'plain line\n- [ ] item'
    expect(toggleChecklistLine(text, 1)).toBe('plain line\n- [x] item')
  })

  it('is a no-op when the target line is not a checklist item', () => {
    const text = 'plain line\n- [ ] item'
    expect(toggleChecklistLine(text, 0)).toBe(text)
  })
})
