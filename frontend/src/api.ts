import type { AdminStats, Card, CreateSessionResponse, Feedback, Note, PublicStats, Session } from './types'

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
    createSession: (name: string, participantName: string, columns?: string[], reactionsEnabled = true, openFacilitator = false) =>
      request<CreateSessionResponse>('/sessions', {
        method: 'POST',
        body: JSON.stringify({ name, participant_name: participantName, columns, reactions_enabled: reactionsEnabled, open_facilitator: openFacilitator }),
      }),

    getSession: (id: string) => request<Session>(`/sessions/${id}`),

    updateSession: (id: string, updates: { name?: string; reactions_enabled?: boolean; open_facilitator?: boolean }, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }),

    joinSession: (id: string, participantName: string) =>
      request<Session>(`/sessions/${id}/join`, {
        method: 'POST',
        body: JSON.stringify({ participant_name: participantName }),
      }),

    setPhase: (id: string, phase: string, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${id}/phase`, {
        method: 'POST',
        body: JSON.stringify({ phase }),
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
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

    updateCardText: (sessionId: string, cardId: string, text: string, participantName: string) =>
      request<Card>(`/sessions/${sessionId}/cards/${cardId}/text`, {
        method: 'PATCH',
        body: JSON.stringify({ text }),
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

    addColumn: (sessionId: string, name: string, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${sessionId}/columns`, {
        method: 'POST',
        body: JSON.stringify({ name }),
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }),

    renameColumn: (sessionId: string, oldName: string, newName: string, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${sessionId}/columns/${encodeURIComponent(oldName)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }),
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }),

    removeColumn: (sessionId: string, name: string, facilitatorToken: string, participantName?: string) =>
      request<void>(`/sessions/${sessionId}/columns/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
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

    addNote: (sessionId: string, text: string, authorName: string) =>
      request<Note>(`/sessions/${sessionId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ text, author_name: authorName }),
        headers: { 'X-Participant-Name': authorName },
      }),

    updateNote: (sessionId: string, noteId: string, text: string, participantName: string) =>
      request<Note>(`/sessions/${sessionId}/notes/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify({ text }),
        headers: { 'X-Participant-Name': participantName },
      }),

    deleteNote: (sessionId: string, noteId: string, participantName: string) =>
      request<void>(`/sessions/${sessionId}/notes/${noteId}`, {
        method: 'DELETE',
        headers: { 'X-Participant-Name': participantName },
      }),

    groupCard: (sessionId: string, cardId: string, targetCardId: string, participantName: string) =>
      request<Session>(`/sessions/${sessionId}/cards/${cardId}/group`, {
        method: 'POST',
        body: JSON.stringify({ target_card_id: targetCardId }),
        headers: { 'X-Participant-Name': participantName },
      }),

    ungroupCard: (sessionId: string, cardId: string, participantName: string) =>
      request<void>(`/sessions/${sessionId}/cards/${cardId}/group`, {
        method: 'DELETE',
        headers: { 'X-Participant-Name': participantName },
      }),

    submitFeedback: (rating: number, comment: string, sessionId?: string) =>
      request<Feedback>('/feedback', {
        method: 'POST',
        body: JSON.stringify({ rating, comment, session_id: sessionId ?? null, app_version: __APP_VERSION__ }),
      }),

    listFeedback: (token: string) =>
      request<Feedback[]>('/feedback', {
        headers: { 'X-Admin-Token': token },
      }),

    getPublicStats: () => request<PublicStats>('/stats'),

    adminAuth: (password: string) =>
      request<{ token: string }>('/stats/auth', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),

    getAdminStats: (token: string) =>
      request<AdminStats>('/stats/admin', {
        headers: { 'X-Admin-Token': token },
      }),

    setTimerDuration: (sessionId: string, durationSeconds: number, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${sessionId}/timer`, {
        method: 'PATCH',
        body: JSON.stringify({ duration_seconds: durationSeconds }),
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }),

    startTimer: (sessionId: string, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${sessionId}/timer/start`, {
        method: 'POST',
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }),

    pauseTimer: (sessionId: string, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${sessionId}/timer/pause`, {
        method: 'POST',
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }),

    resetTimer: (sessionId: string, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${sessionId}/timer/reset`, {
        method: 'POST',
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }),
  }
}

export const api = createApi()
