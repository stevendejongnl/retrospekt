/**
 * The data the design shows, in the shapes the API returns. The comparison run answers the app's
 * requests with these, so the app and the design render the same board, the same stats and the same names.
 */
import type { AdminStats, Card, Note, PublicStats, Reaction, Session, SessionPhase, Vote } from '../src/types'
import { FIXED_TIME } from './browser-settings'

export const FIXTURE_SESSION_ID = 'ad9aaaea-758c-4e27-a70d-169ff1b6cd90'
export const FIXTURE_APP_VERSION = '1.50.1'

const PARTICIPANTS = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve']
const COLUMNS = ['Went Well', 'To Improve', 'Action Items']

export type TimerFixture = 'none' | 'running' | 'up'

const votes = (...names: string[]): Vote[] => names.map((participant_name) => ({ participant_name }))
const reactions = (emoji: string, ...names: string[]): Reaction[] => names.map((participant_name) => ({ emoji, participant_name }))

let counter = 0
function card(column: string, text: string, author: string, extras: Partial<Card> = {}): Card {
  counter += 1
  return {
    id: `card-${String(counter).padStart(2, '0')}`,
    column,
    text,
    author_name: author,
    published: true,
    votes: [],
    reactions: [],
    assignee: null,
    group_id: null,
    created_at: `2026-05-05T09:${String(10 + counter).padStart(2, '0')}:00Z`,
    ...extras,
  }
}

function cardsFor(phase: SessionPhase): Card[] {
  counter = 0
  if (phase === 'collecting') {
    return [
      card('Went Well', 'Shipping went smoothly 🚀', 'Alice', { published: false }),
      card('To Improve', 'Stand-ups ran too long', 'Alice', { published: false }),
      card('Action Items', 'Set up runbooks for deploy', 'Alice', { published: false }),
    ]
  }
  const closed = phase === 'closed'
  return [
    card('Went Well', 'Shipping went smoothly 🚀', 'Bob', {
      votes: votes('Alice', 'Bob', 'Carol'),
      reactions: closed ? [] : [...reactions('❤️', 'Alice', 'Bob'), ...reactions('🎉', 'Carol')],
    }),
    card('Went Well', 'Great team collaboration', 'Bob', { votes: votes('Bob', 'Dave') }),
    card('Went Well', 'Tests caught a regression early', 'Carol'),
    card('To Improve', 'Stand-ups ran too long', 'Alice', { votes: votes('Bob', 'Carol') }),
    card('To Improve', 'Need better deployment docs', 'Bob', { votes: votes('Dave') }),
    ...(closed ? [] : [card('To Improve', 'Retro agenda was packed', 'Alice', { published: false })]),
    card('Action Items', 'Set up runbooks for deploy', 'Bob', {
      votes: closed ? votes('Alice', 'Carol', 'Dave') : votes('Carol', 'Dave'),
      assignee: 'Alice',
    }),
    ...(closed ? [card('Action Items', 'Timebox standups to 15 min', 'Carol', { votes: votes('Alice', 'Bob'), assignee: 'Bob' })] : []),
  ]
}

function timerFor(kind: TimerFixture): Session['timer'] {
  if (kind === 'none') return null
  const elapsedSeconds = kind === 'running' ? 328 : 600
  return {
    duration_seconds: 600,
    started_at: new Date(FIXED_TIME.getTime() - elapsedSeconds * 1000).toISOString(),
    paused_remaining: null,
  }
}

const NOTES: Note[] = [
  { id: 'note-1', title: 'Follow-ups', text: '- [x] Book the retro room\n- [ ] Share the runbook link\n- [ ] Timebox stand-ups', author_name: 'Alice', created_at: '2026-05-05T09:40:00Z' },
  { id: 'note-2', title: null, text: 'Parking lot: should we split the deploy docs by team?', author_name: 'Bob', created_at: '2026-05-05T09:45:00Z' },
  { id: 'note-3', title: 'Next retro', text: 'Try Start / Stop / Continue next sprint.', author_name: 'Carol', created_at: '2026-05-05T09:50:00Z' },
]

export function createSessionFixture(phase: SessionPhase, timer: TimerFixture = 'none', withNotes = false): Session {
  return {
    id: FIXTURE_SESSION_ID,
    name: 'Sprint 42 Retro',
    columns: COLUMNS,
    column_sorts: { 'Went Well': true },
    phase,
    participants: PARTICIPANTS.map((name, i) => ({ name, joined_at: `2026-05-05T09:0${i}:00Z` })),
    cards: cardsFor(phase),
    notes: withNotes ? NOTES : [],
    timer: timerFor(timer),
    reactions_enabled: true,
    open_facilitator: false,
    max_votes_per_participant: 5,
    created_at: '2026-05-05T09:00:00Z',
    updated_at: '2026-05-05T09:30:00Z',
  }
}

const publicStats: PublicStats = {
  total_sessions: 21,
  active_sessions: 18,
  sessions_by_phase: [
    { phase: 'closed', count: 3 },
    { phase: 'collecting', count: 14 },
    { phase: 'discussing', count: 4 },
  ],
  sessions_per_day: Array.from({ length: 6 }, (_, i) => ({ date: `2026-05-0${i}`, count: [4, 5, 3, 6, 4, 5][i] })),
  total_cards: 35,
  avg_cards_per_session: 1.7,
  total_votes: 23,
  total_reactions: 41,
  feedback_total: 18,
  reaction_breakdown: [
    { emoji: '❤️', count: 14 }, { emoji: '🎉', count: 9 }, { emoji: '🥓', count: 8 }, { emoji: '👀', count: 6 }, { emoji: '🤔', count: 4 },
  ],
  cards_per_column: [
    { column: 'Went Well', count: 14 }, { column: 'To Improve', count: 12 }, { column: 'Action Items', count: 9 },
  ],
  engagement_funnel: { created: 21, has_cards: 9, has_votes: 6, closed: 3 },
  session_lifetime: {
    expiry_countdown: { expiring_within_7_days: 2, expiring_within_30_days: 9 },
    lifetime_distribution: [
      { label: '< 1 day', count: 8 }, { label: '1-3 days', count: 6 }, { label: '3-7 days', count: 4 }, { label: '> 7 days', count: 3 },
    ],
    avg_duration: { open_avg_hours: 76.8, closed_avg_hours: 52.1 },
    avg_time_to_close_hours: 48.3,
  },
  feedback_avg_rating: 4.4,
  feedback_by_rating: [
    { rating: 5, count: 9 }, { rating: 4, count: 6 }, { rating: 3, count: 2 }, { rating: 2, count: 1 }, { rating: 1, count: 0 },
  ],
}

/** Seven days of Sentry numbers: the design's sparkline shape, scaled in proportion (so the sparkline has the design's shape) so the averages read 0.4 % / 182 ms and 1.1 % / 640 ms. */
const healthOf = (
  issues: Array<[string, number]>,
  errorRate: number[],
  latency: number[],
): AdminStats['sentry'] => ({
  unresolved_count: issues.length,
  top_issues: issues.map(([title, count], i) => ({ id: `issue-${i}`, title, count, last_seen: '2026-05-05T08:00:00Z' })),
  error_rate_7d: errorRate.map((value, i) => ({ date: `2026-04-${29 + i}`, value })),
  p95_latency_7d: latency.map((value, i) => ({ date: `2026-04-${29 + i}`, value })),
  error: null,
})

const adminStats: AdminStats = {
  sentry: healthOf(
    [['UnicodeEncodeError: surrogates not allowed', 12], ['SSE stream closed early', 4]],
    [3, 4, 2, 5, 3, 2, 1].map((v) => v * 0.14),
    [180, 190, 170, 200, 185, 175, 174],
  ),
  sentry_frontend: healthOf(
    [['ResizeObserver loop limit exceeded', 31], ['Failed to fetch /api/v1/gifs/status', 2]],
    [2, 2, 3, 6, 4, 3, 2].map((v) => (v * 7.7) / 23),
    [620, 650, 600, 700, 660, 630, 620],
  ),
  feedback: {
    total: 18,
    avg_rating: 4.4,
    by_rating: publicStats.feedback_by_rating,
    recent: [
      { id: 'f1', rating: 5, comment: 'Nice banners when sharing a link, exactly what I wanted.', participant_name: 'Alice', app_version: 'v1.50.0', status: 'new', fixed_in_version: null, created_at: '2026-11-09T10:00:00Z' },
      { id: 'f2', rating: 3, comment: 'Cards were tall for the little they said.', participant_name: null, app_version: 'v1.49.2', status: 'new', fixed_in_version: null, created_at: '2026-11-08T10:00:00Z' },
      { id: 'f3', rating: 4, comment: 'Assign control missing for non-facilitators.', participant_name: 'Bob', app_version: 'v1.48.0', status: 'new', fixed_in_version: null, created_at: '2026-11-07T10:00:00Z' },
      { id: 'f4', rating: 4, comment: 'Popups are annoying, use something quieter.', participant_name: null, app_version: 'v1.47.3', status: 'fixed', fixed_in_version: 'v1.47.0', created_at: '2026-11-02T10:00:00Z' },
      { id: 'f5', rating: 2, comment: '', participant_name: null, app_version: 'v1.46.1', status: 'ignored', fixed_in_version: null, created_at: '2026-10-29T10:00:00Z' },
    ],
  },
}

export function createApiResponses() {
  return {
    publicStats,
    adminStats,
    gifsStatus: { enabled: false },
    authToken: { token: 'parity-admin-token' },
  }
}
