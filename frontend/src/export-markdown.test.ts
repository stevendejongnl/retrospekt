import { describe, expect, it } from 'vitest'

import { exportFilename, sessionToMarkdown } from './export-markdown'
import type { Card, Note, Session } from './types'

function card(overrides: Partial<Card>): Card {
  return {
    id: 'c',
    column: 'Went Well',
    text: '',
    author_name: 'Alice',
    published: true,
    votes: [],
    reactions: [],
    assignee: null,
    group_id: null,
    created_at: '2026-10-19T12:00:00Z',
    ...overrides,
  }
}

const votes = (n: number) => Array.from({ length: n }, (_, i) => ({ participant_name: `p${i}` }))

function note(overrides: Partial<Note>): Note {
  return { id: 'n', title: null, text: '', author_name: 'Alice', created_at: '2026-10-19T12:00:00Z', ...overrides }
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    name: 'Sprint 42 Retro',
    columns: ['Went Well', 'To Improve', 'Action Items'],
    column_sorts: {},
    phase: 'closed',
    participants: ['Alice', 'Bob', 'Carol'].map(name => ({ name, joined_at: '2026-10-19T12:00:00Z' })),
    cards: [],
    notes: [],
    timer: null,
    reactions_enabled: true,
    open_facilitator: false,
    max_votes_per_participant: null,
    created_at: '2026-10-19T12:00:00Z',
    updated_at: '2026-10-19T12:00:00Z',
    ...overrides,
  }
}

// Lines inside one list item end in two spaces (a markdown hard break),
// written here as ␠␠ so they are visible.
const md = (s: string) => s.replace(/␠␠/g, '  ')

describe('sessionToMarkdown', () => {
  it('has no separate action items section', () => {
    const s = session({ cards: [card({ text: 'Split the e2e job', assignee: 'Bob' })] })
    expect(sessionToMarkdown(s)).not.toContain('Action items')
  })

  it('renders the agreed layout: short lines, groups nested, assignees listed at the bottom', () => {
    const s = session({
      cards: [
        card({ id: 'c1', column: 'Went Well', author_name: 'Alice', text: 'Deploys were smooth', votes: votes(3),
          reactions: [{ emoji: '🎉', participant_name: 'Bob' }, { emoji: '🎉', participant_name: 'Carol' }] }),
        card({ id: 'c2', column: 'To Improve', author_name: 'Carol', text: 'Too many meetings', votes: votes(2), group_id: 'g1' }),
        card({ id: 'c3', column: 'To Improve', author_name: 'Bob', text: 'CI is slow\nEspecially the e2e job', votes: votes(4) }),
        card({ id: 'c4', column: 'To Improve', author_name: 'Alice', text: 'Standups run long', votes: votes(1), group_id: 'g1' }),
        card({ id: 'c5', column: 'Action Items', author_name: 'Bob', text: 'Split the e2e job', assignee: 'Bob' }),
        card({ id: 'c6', column: 'To Improve', author_name: 'Bob', text: 'Secret draft', published: false }),
      ],
      notes: [note({ title: 'Parking lot', text: '- [ ] Ask ops about runners\n- [x] Book next retro' })],
    })

    expect(sessionToMarkdown(s)).toBe(md(`# Sprint 42 Retro

Date: 19 Oct 2026␠␠
Participants: Alice, Bob, Carol␠␠
Cards: 5␠␠
Votes: 10

## Went Well
- **Alice** · 3 votes␠␠
  Deploys were smooth␠␠
  🎉 2

## To Improve
- **Bob** · 4 votes␠␠
  CI is slow␠␠
  Especially the e2e job
- **Group** · 3 votes
  - **Carol** · 2 votes␠␠
    Too many meetings
  - **Alice** · 1 vote␠␠
    Standups run long

## Action Items
- **Bob** · 0 votes␠␠
  Split the e2e job␠␠
  @Bob

## Notes
### Parking lot
- [ ] Ask ops about runners␠␠
- [x] Book next retro

## Assignees
- **Bob**
  - Split the e2e job
`))
  })

  it('leaves out empty sections', () => {
    expect(sessionToMarkdown(session({ participants: [] }))).toBe(md(`# Sprint 42 Retro

Date: 19 Oct 2026␠␠
Cards: 0␠␠
Votes: 0
`))
  })

  it('keeps an assigned card in its column and its group, with the assignee as last line', () => {
    const s = session({
      cards: [
        card({ id: 'c1', text: 'Pairing helped', group_id: 'g1' }),
        card({ id: 'c2', text: 'Keep pairing', group_id: 'g1', assignee: 'Bob',
          reactions: [{ emoji: '🎉', participant_name: 'Bob' }] }),
      ],
    })
    expect(sessionToMarkdown(s)).toContain(md(`## Went Well
- **Group** · 0 votes
  - **Alice** · 0 votes␠␠
    Pairing helped
  - **Alice** · 0 votes␠␠
    Keep pairing␠␠
    🎉 1␠␠
    @Bob
`))
  })

  it('lists several reactions on one line, most used first', () => {
    const s = session({
      cards: [card({
        text: 'Nice',
        reactions: [
          { emoji: '❤️', participant_name: 'Bob' },
          { emoji: '🎉', participant_name: 'Bob' },
          { emoji: '🎉', participant_name: 'Carol' },
        ],
      })],
    })
    expect(sessionToMarkdown(s)).toContain(md('  Nice␠␠\n  🎉 2 · ❤️ 1\n'))
  })

  it('renders an untitled note without a heading and keeps plain lines apart', () => {
    const s = session({ notes: [note({ text: 'Retro was good\nShorter next time' })] })
    expect(sessionToMarkdown(s)).toContain(md('## Notes\nRetro was good␠␠\nShorter next time\n'))
  })

  it('separates notes with a blank line', () => {
    const s = session({ notes: [note({ title: 'One', text: 'a' }), note({ title: 'Two', text: 'b' })] })
    expect(sessionToMarkdown(s)).toContain('## Notes\n### One\na\n\n### Two\nb\n')
  })

  it('groups assignees by name, sorted, with multi-line card text indented under the item', () => {
    const s = session({
      cards: [
        card({ id: 'c1', text: 'Fix flaky test', assignee: 'Carol' }),
        card({ id: 'c2', text: 'Book room\nfor Friday', assignee: 'Bob' }),
        card({ id: 'c3', text: 'Update docs', assignee: 'Carol' }),
      ],
    })
    expect(sessionToMarkdown(s)).toContain(md(`## Assignees
- **Bob**
  - Book room␠␠
    for Friday
- **Carol**
  - Fix flaky test
  - Update docs
`))
  })
})

describe('exportFilename', () => {
  it('turns the session name into a lowercase, dash-separated .md filename', () => {
    expect(exportFilename('Sprint 42 Retro!')).toBe('sprint-42-retro.md')
  })

  it('keeps non-Latin letters', () => {
    expect(exportFilename('Ретро спринт')).toBe('ретро-спринт.md')
  })

  it('falls back to retro.md when nothing usable is left', () => {
    expect(exportFilename('🎉🎉')).toBe('retro.md')
  })
})
