import { describe, expect, it } from 'vitest'
import { FIXTURE_SESSION_ID, createApiResponses, createSessionFixture } from './fixtures'

describe('parity fixtures', () => {
  it('shows the session the design shows', () => {
    const session = createSessionFixture('discussing')
    expect(session.id).toBe(FIXTURE_SESSION_ID)
    expect(session.name).toBe('Sprint 42 Retro')
    expect(session.columns).toEqual(['Went Well', 'To Improve', 'Action Items'])
    expect(session.participants.map((p) => p.name)).toEqual(['Alice', 'Bob', 'Carol', 'Dave', 'Eve'])
    expect(session.created_at.startsWith('2026-05-05')).toBe(true)
  })

  it('has one fixture per phase', () => {
    expect(createSessionFixture('collecting').phase).toBe('collecting')
    expect(createSessionFixture('discussing').phase).toBe('discussing')
    expect(createSessionFixture('closed').phase).toBe('closed')
  })

  it('keeps one draft in the discussion, and publishes everything once closed', () => {
    const drafts = (phase: 'discussing' | 'closed') => createSessionFixture(phase).cards.filter((c) => !c.published)
    expect(drafts('discussing').map((c) => c.text)).toEqual(['Retro agenda was packed'])
    expect(drafts('closed')).toHaveLength(0)
  })

  it('gives the first card the votes and reactions the design shows', () => {
    const card = createSessionFixture('discussing').cards.find((c) => c.text.startsWith('Shipping went smoothly'))!
    expect(card.votes.map((v) => v.participant_name)).toEqual(['Alice', 'Bob', 'Carol'])
    expect(card.reactions.filter((r) => r.emoji === '❤️')).toHaveLength(2)
    expect(card.reactions.filter((r) => r.emoji === '🎉')).toHaveLength(1)
  })

  it('assigns the runbook card to Alice', () => {
    const card = createSessionFixture('discussing').cards.find((c) => c.text.startsWith('Set up runbooks'))!
    expect(card.assignee).toBe('Alice')
  })

  it('answers the public stats with the numbers the design shows', () => {
    const stats = createApiResponses().publicStats
    expect(stats.total_sessions).toBe(21)
    expect(stats.total_cards).toBe(35)
    expect(stats.total_votes).toBe(23)
    expect(stats.feedback_avg_rating).toBe(4.4)
  })
})
