export type SessionPhase = 'collecting' | 'discussing' | 'closed'

export interface Vote {
  participant_name: string
}

export interface Card {
  id: string
  column: string
  text: string
  author_name: string
  votes: Vote[]
  created_at: string
}

export interface Participant {
  name: string
  joined_at: string
}

export interface Session {
  id: string
  name: string
  columns: string[]
  phase: SessionPhase
  participants: Participant[]
  cards: Card[]
  created_at: string
  updated_at: string
}

export interface CreateSessionResponse extends Session {
  facilitator_token: string
}
