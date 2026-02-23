import type { Card, CreateSessionResponse, Session } from './types'

const BASE = '/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API ${response.status}: ${text}`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  createSession: (name: string, participantName: string) =>
    request<CreateSessionResponse>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ name, participant_name: participantName }),
    }),

  getSession: (id: string) => request<Session>(`/sessions/${id}`),

  joinSession: (id: string, participantName: string) =>
    request<Session>(`/sessions/${id}/join`, {
      method: 'POST',
      body: JSON.stringify({ participant_name: participantName }),
    }),

  setPhase: (id: string, phase: string, facilitatorToken: string) =>
    request<Session>(`/sessions/${id}/phase`, {
      method: 'POST',
      body: JSON.stringify({ phase }),
      headers: { 'X-Facilitator-Token': facilitatorToken },
    }),

  addCard: (id: string, column: string, text: string, authorName: string) =>
    request<Card>(`/sessions/${id}/cards`, {
      method: 'POST',
      body: JSON.stringify({ column, text, author_name: authorName }),
    }),

  deleteCard: (sessionId: string, cardId: string, participantName: string) =>
    request<void>(`/sessions/${sessionId}/cards/${cardId}`, {
      method: 'DELETE',
      headers: { 'X-Participant-Name': participantName },
    }),

  addVote: (sessionId: string, cardId: string, participantName: string) =>
    request<Card>(`/sessions/${sessionId}/cards/${cardId}/votes`, {
      method: 'POST',
      headers: { 'X-Participant-Name': participantName },
    }),

  removeVote: (sessionId: string, cardId: string, participantName: string) =>
    request<Card>(`/sessions/${sessionId}/cards/${cardId}/votes`, {
      method: 'DELETE',
      headers: { 'X-Participant-Name': participantName },
    }),
}
