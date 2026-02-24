import type { Card, CreateSessionResponse, Session } from './types'

const BASE = '/api/v1'

export function createApi(fetchFn: typeof fetch = fetch) {
  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetchFn(`${BASE}${path}`, {
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

  return {
    createSession: (name: string, participantName: string, columns?: string[], reactionsEnabled = true) =>
      request<CreateSessionResponse>('/sessions', {
        method: 'POST',
        body: JSON.stringify({ name, participant_name: participantName, columns, reactions_enabled: reactionsEnabled }),
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

    publishCard: (sessionId: string, cardId: string, participantName: string) =>
      request<Card>(`/sessions/${sessionId}/cards/${cardId}/publish`, {
        method: 'POST',
        headers: { 'X-Participant-Name': participantName },
      }),

    publishAllCards: (sessionId: string, column: string, participantName: string) =>
      request<Card[]>(`/sessions/${sessionId}/cards/publish-all`, {
        method: 'POST',
        body: JSON.stringify({ column }),
        headers: { 'X-Participant-Name': participantName },
      }),

    addColumn: (sessionId: string, name: string, facilitatorToken: string) =>
      request<Session>(`/sessions/${sessionId}/columns`, {
        method: 'POST',
        body: JSON.stringify({ name }),
        headers: { 'X-Facilitator-Token': facilitatorToken },
      }),

    renameColumn: (sessionId: string, oldName: string, newName: string, facilitatorToken: string) =>
      request<Session>(`/sessions/${sessionId}/columns/${encodeURIComponent(oldName)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }),
        headers: { 'X-Facilitator-Token': facilitatorToken },
      }),

    removeColumn: (sessionId: string, name: string, facilitatorToken: string) =>
      request<void>(`/sessions/${sessionId}/columns/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: { 'X-Facilitator-Token': facilitatorToken },
      }),

    addReaction: (sessionId: string, cardId: string, emoji: string, participantName: string) =>
      request<Card>(`/sessions/${sessionId}/cards/${cardId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
        headers: { 'X-Participant-Name': participantName },
      }),

    removeReaction: (sessionId: string, cardId: string, emoji: string, participantName: string) =>
      request<void>(
        `/sessions/${sessionId}/cards/${cardId}/reactions?emoji=${encodeURIComponent(emoji)}`,
        { method: 'DELETE', headers: { 'X-Participant-Name': participantName } },
      ),

    assignCard: (
      sessionId: string,
      cardId: string,
      assignee: string | null,
      participantName: string,
      facilitatorToken: string,
    ) =>
      request<Card>(`/sessions/${sessionId}/cards/${cardId}/assignee`, {
        method: 'PATCH',
        body: JSON.stringify({ assignee }),
        headers: { 'X-Participant-Name': participantName, 'X-Facilitator-Token': facilitatorToken },
      }),

    setTimerDuration: (sessionId: string, durationSeconds: number, facilitatorToken: string) =>
      request<Session>(`/sessions/${sessionId}/timer`, {
        method: 'PATCH',
        body: JSON.stringify({ duration_seconds: durationSeconds }),
        headers: { 'X-Facilitator-Token': facilitatorToken },
      }),

    startTimer: (sessionId: string, facilitatorToken: string) =>
      request<Session>(`/sessions/${sessionId}/timer/start`, {
        method: 'POST',
        headers: { 'X-Facilitator-Token': facilitatorToken },
      }),

    pauseTimer: (sessionId: string, facilitatorToken: string) =>
      request<Session>(`/sessions/${sessionId}/timer/pause`, {
        method: 'POST',
        headers: { 'X-Facilitator-Token': facilitatorToken },
      }),

    resetTimer: (sessionId: string, facilitatorToken: string) =>
      request<Session>(`/sessions/${sessionId}/timer/reset`, {
        method: 'POST',
        headers: { 'X-Facilitator-Token': facilitatorToken },
      }),
  }
}

export const api = createApi()
