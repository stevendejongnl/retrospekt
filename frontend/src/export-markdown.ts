import type { Card, Note, Session } from './types'

/**
 * Markdown export of a retro, built for reading: one fact per line, groups
 * nested, assigned cards pulled out as action items.
 *
 * Consecutive lines inside one list item are joined with a hard break (two
 * trailing spaces); without it most renderers glue them into one long line.
 */

const HARD_BREAK = '  '

// Each line ends in a hard break except the last, so the block stays one item
// but renders line by line.
function block(lines: string[]): string[] {
  return lines.map((line, i) => (i < lines.length - 1 ? line + HARD_BREAK : line))
}

// First line gets `bullet`, the rest are indented by `pad` (by default lined up under the text).
function listItem(bullet: string, lines: string[], indent = '', pad = ' '.repeat(bullet.length)): string[] {
  return block(lines).map((line, i) => indent + (i === 0 ? bullet : pad) + line)
}

function textLines(text: string): string[] {
  return text.split('\n').map(line => line.trimEnd()).filter(line => line !== '')
}

const voteCount = (n: number) => `${n} vote${n === 1 ? '' : 's'}`

function reactionLine(card: Card): string | null {
  const counts = new Map<string, number>()
  for (const r of card.reactions ?? []) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1)
  if (counts.size === 0) return null
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([emoji, n]) => `${emoji} ${n}`)
    .join(' · ')
}

function cardItem(card: Card, indent = ''): string[] {
  const lines = [`**${card.author_name}** · ${voteCount(card.votes.length)}`, ...textLines(card.text)]
  const reactions = reactionLine(card)
  if (reactions) lines.push(reactions)
  return listItem('- ', lines, indent)
}

type ColumnItem = { votes: number; cards: Card[] }

// Group members stay together under one item, worth the votes of all of them.
function columnItems(cards: Card[]): ColumnItem[] {
  const byGroup = new Map<string, Card[]>()
  const items: ColumnItem[] = []
  for (const card of cards) {
    if (!card.group_id) {
      items.push({ votes: card.votes.length, cards: [card] })
      continue
    }
    const members = byGroup.get(card.group_id)
    if (members) {
      members.push(card)
    } else {
      const group = [card]
      byGroup.set(card.group_id, group)
      items.push({ votes: 0, cards: group })
    }
  }
  for (const item of items) {
    item.cards.sort((a, b) => b.votes.length - a.votes.length)
    item.votes = item.cards.reduce((sum, c) => sum + c.votes.length, 0)
  }
  return items.sort((a, b) => b.votes - a.votes)
}

function columnSection(column: string, cards: Card[]): string[] {
  const lines = [`## ${column}`]
  for (const item of columnItems(cards)) {
    if (item.cards.length === 1) {
      lines.push(...cardItem(item.cards[0]))
    } else {
      lines.push(`- **Group** · ${voteCount(item.votes)}`)
      for (const card of item.cards) lines.push(...cardItem(card, '  '))
    }
  }
  return lines
}

function noteLines(note: Note): string[] {
  const lines = note.title ? [`### ${note.title}`] : []
  return [...lines, ...block(textLines(note.text))]
}

function assigneesSection(assigned: Card[]): string[] {
  const byName = new Map<string, Card[]>()
  for (const card of assigned) {
    const name = card.assignee as string
    byName.set(name, [...(byName.get(name) ?? []), card])
  }
  const lines = ['## Assignees']
  for (const name of [...byName.keys()].sort((a, b) => a.localeCompare(b))) {
    lines.push(`- **${name}**`)
    for (const card of byName.get(name) ?? []) lines.push(...listItem('- ', textLines(card.text), '  '))
  }
  return lines
}

export function sessionToMarkdown(session: Session): string {
  const published = session.cards.filter(c => c.published)
  const assigned = published.filter(c => c.assignee)
  const unassigned = published.filter(c => !c.assignee)
  const date = new Date(session.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const header = [`Date: ${date}`]
  if (session.participants.length > 0) {
    header.push(`Participants: ${session.participants.map(p => p.name).join(', ')}`)
  }
  header.push(`Cards: ${published.length}`)
  header.push(`Votes: ${published.reduce((sum, c) => sum + c.votes.length, 0)}`)

  const sections: string[][] = [[`# ${session.name}`], block(header)]

  if (assigned.length > 0) {
    const lines = ['## Action items']
    for (const card of assigned) {
      // Indent by 2, not under the text: renderers read 6 spaces as a code block
      lines.push(...listItem('- [ ] ', [...textLines(card.text), `@${card.assignee}`], '', '  '))
    }
    sections.push(lines)
  }

  for (const column of session.columns) {
    const cards = unassigned.filter(c => c.column === column)
    if (cards.length > 0) sections.push(columnSection(column, cards))
  }

  // Sessions from before notes existed have no notes field
  const notes = (session.notes ?? []).map(noteLines)
  if (notes.length > 0) {
    sections.push(['## Notes', ...notes.flatMap((lines, i) => (i === 0 ? lines : ['', ...lines]))])
  }

  if (assigned.length > 0) sections.push(assigneesSection(assigned))

  return sections.map(lines => lines.join('\n')).join('\n\n') + '\n'
}

export function exportFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'retro'}.md`
}
