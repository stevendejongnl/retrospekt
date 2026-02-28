export type SessionPhase = 'collecting' | 'discussing' | 'closed'

export interface Vote {
  participant_name: string
}

export interface Reaction {
  emoji: string
  participant_name: string
}

export interface Card {
  id: string
  column: string
  text: string
  author_name: string
  published: boolean
  votes: Vote[]
  reactions: Reaction[]
  assignee: string | null
  created_at: string
}

export interface Participant {
  name: string
  joined_at: string
}

export interface TimerState {
  duration_seconds: number
  started_at: string | null
  paused_remaining: number | null
}

export interface Session {
  id: string
  name: string
  columns: string[]
  phase: SessionPhase
  participants: Participant[]
  cards: Card[]
  timer: TimerState | null
  reactions_enabled: boolean
  created_at: string
  updated_at: string
}

export interface CreateSessionResponse extends Session {
  facilitator_token: string
}

// ---------------------------------------------------------------------------
// Stats types
// ---------------------------------------------------------------------------

export interface PhaseCount {
  phase: string
  count: number
}

export interface DailyCount {
  date: string
  count: number
}

export interface ReactionCount {
  emoji: string
  count: number
}

export interface ColumnCount {
  column: string
  count: number
}

export interface HeatmapCell {
  day_of_week: number
  hour_bucket: number
  count: number
}

export interface FunnelStats {
  created: number
  has_cards: number
  has_votes: number
  closed: number
}

export interface PublicStats {
  total_sessions: number
  active_sessions: number
  sessions_by_phase: PhaseCount[]
  sessions_per_day: DailyCount[]
  total_cards: number
  avg_cards_per_session: number
  total_votes: number
  total_reactions: number
}

export interface AdminStats {
  reaction_breakdown: ReactionCount[]
  cards_per_column: ColumnCount[]
  activity_heatmap: HeatmapCell[]
  engagement_funnel: FunnelStats
}

export const PARTICIPANT_COLORS = [
  '#7c3aed', '#0284c7', '#059669', '#d97706', '#db2777',
  '#0891b2', '#65a30d', '#9333ea', '#ea580c', '#0d9488',
]

export function buildParticipantColorMap(participants: Participant[]): Record<string, string> {
  const map: Record<string, string> = {}
  participants.forEach((p, i) => {
    map[p.name] = PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length]
  })
  return map
}
