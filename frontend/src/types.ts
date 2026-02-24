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
  created_at: string
  updated_at: string
}

export interface CreateSessionResponse extends Session {
  facilitator_token: string
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
