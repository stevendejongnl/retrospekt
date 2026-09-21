import type { AdminStats, Card, CreateSessionResponse, Feedback, GifResult, Note, PublicStats, Session } from './types'
import { tagManager } from './analytics'

const BASE = '/api/v1'

interface TrackedEvent {
  category: string
  action: string
  name?: string
  value?: number
}

export function createApi(fetchFn: typeof fetch = fetch) {
  async function request<T>(path: string, options?: RequestInit, event?: TrackedEvent): Promise<T> {
    const response = await fetchFn(`${BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
    if (!response.ok) {
      const text = await response.text()
      const body = text.length > 200 ? text.slice(0, 200) + '…' : text
      throw new Error(`API ${response.status}: ${body}`)
    }
    if (event) tagManager.trackEvent(event.category, event.action, event.name, event.value)
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }

  return {
    createSession: (name: string, participantName: string, columns?: string[], reactionsEnabled = true, openFacilitator = false, maxVotesPerParticipant: number | null = null) =>
      request<CreateSessionResponse>('/sessions', {
        method: 'POST',
        body: JSON.stringify({ name, participant_name: participantName, columns, reactions_enabled: reactionsEnabled, open_facilitator: openFacilitator, max_votes_per_participant: maxVotesPerParticipant }),
      }, { category: 'Session', action: 'create' }),

    getSession: (id: string) => request<Session>(`/sessions/${id}`),

    updateSession: (id: string, updates: { name?: string; reactions_enabled?: boolean; open_facilitator?: boolean; max_votes_per_participant?: number | null }, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }, { category: 'Session', action: 'update_settings' }),

    joinSession: (id: string, participantName: string) =>
      request<Session>(`/sessions/${id}/join`, {
        method: 'POST',
        body: JSON.stringify({ participant_name: participantName }),
      }, { category: 'Session', action: 'join' }),

    setPhase: (id: string, phase: string, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${id}/phase`, {
        method: 'POST',
        body: JSON.stringify({ phase }),
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }, { category: 'Session', action: 'phase_change', name: phase }),

    addCard: (id: string, column: string, text: string, authorName: string) =>
      request<Card>(`/sessions/${id}/cards`, {
        method: 'POST',
        body: JSON.stringify({ column, text, author_name: authorName }),
      }, { category: 'Card', action: 'add', name: column }),

    deleteCard: (sessionId: string, cardId: string, participantName: string) =>
      request<void>(`/sessions/${sessionId}/cards/${cardId}`, {
        method: 'DELETE',
        headers: { 'X-Participant-Name': participantName },
      }, { category: 'Card', action: 'delete' }),

    updateCardText: (sessionId: string, cardId: string, text: string, participantName: string) =>
      request<Card>(`/sessions/${sessionId}/cards/${cardId}/text`, {
        method: 'PATCH',
        body: JSON.stringify({ text }),
        headers: { 'X-Participant-Name': participantName },
      }, { category: 'Card', action: 'edit' }),

    addVote: (sessionId: string, cardId: string, participantName: string) =>
      request<Card>(`/sessions/${sessionId}/cards/${cardId}/votes`, {
        method: 'POST',
        headers: { 'X-Participant-Name': participantName },
      }, { category: 'Card', action: 'vote' }),

    removeVote: (sessionId: string, cardId: string, participantName: string) =>
      request<Card>(`/sessions/${sessionId}/cards/${cardId}/votes`, {
        method: 'DELETE',
        headers: { 'X-Participant-Name': participantName },
      }, { category: 'Card', action: 'unvote' }),

    publishCard: (sessionId: string, cardId: string, participantName: string) =>
      request<Card>(`/sessions/${sessionId}/cards/${cardId}/publish`, {
        method: 'POST',
        headers: { 'X-Participant-Name': participantName },
      }, { category: 'Card', action: 'publish' }),

    unpublishCard: (sessionId: string, cardId: string, participantName: string) =>
      request<Card>(`/sessions/${sessionId}/cards/${cardId}/unpublish`, {
        method: 'POST',
        headers: { 'X-Participant-Name': participantName },
      }, { category: 'Card', action: 'unpublish' }),

    publishAllCards: (sessionId: string, column: string, participantName: string) =>
      request<Card[]>(`/sessions/${sessionId}/cards/publish-all`, {
        method: 'POST',
        body: JSON.stringify({ column }),
        headers: { 'X-Participant-Name': participantName },
      }, { category: 'Card', action: 'publish_all', name: column }),

    addColumn: (sessionId: string, name: string, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${sessionId}/columns`, {
        method: 'POST',
        body: JSON.stringify({ name }),
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }, { category: 'Column', action: 'add' }),

    renameColumn: (sessionId: string, oldName: string, newName: string, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${sessionId}/columns/${encodeURIComponent(oldName)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }),
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }, { category: 'Column', action: 'rename' }),

    removeColumn: (sessionId: string, name: string, facilitatorToken: string, participantName?: string) =>
      request<void>(`/sessions/${sessionId}/columns/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }, { category: 'Column', action: 'remove' }),

    setColumnSort: (sessionId: string, columnName: string, sortByVotes: boolean, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${sessionId}/columns/${encodeURIComponent(columnName)}/sort`, {
        method: 'PATCH',
        body: JSON.stringify({ sort_by_votes: sortByVotes }),
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }, { category: 'Column', action: 'sort_toggle', name: sortByVotes ? 'votes' : 'default' }),

    addReaction: (sessionId: string, cardId: string, emoji: string, participantName: string) =>
      request<Card>(`/sessions/${sessionId}/cards/${cardId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
        headers: { 'X-Participant-Name': participantName },
      }, { category: 'Reaction', action: 'add', name: emoji }),

    removeReaction: (sessionId: string, cardId: string, emoji: string, participantName: string) =>
      request<void>(
        `/sessions/${sessionId}/cards/${cardId}/reactions?emoji=${encodeURIComponent(emoji)}`,
        { method: 'DELETE', headers: { 'X-Participant-Name': participantName } },
        { category: 'Reaction', action: 'remove', name: emoji },
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
      }, { category: 'Card', action: 'assign', name: assignee ?? 'unassign' }),

    addNote: (sessionId: string, text: string, authorName: string, title?: string) =>
      request<Note>(`/sessions/${sessionId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ text, author_name: authorName, ...(title ? { title } : {}) }),
        headers: { 'X-Participant-Name': authorName },
      }, { category: 'Note', action: 'add' }),

    updateNote: (sessionId: string, noteId: string, text: string, participantName: string, title?: string) =>
      request<Note>(`/sessions/${sessionId}/notes/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify({ text, ...(title ? { title } : {}) }),
        headers: { 'X-Participant-Name': participantName },
      }, { category: 'Note', action: 'edit' }),

    deleteNote: (sessionId: string, noteId: string, participantName: string) =>
      request<void>(`/sessions/${sessionId}/notes/${noteId}`, {
        method: 'DELETE',
        headers: { 'X-Participant-Name': participantName },
      }, { category: 'Note', action: 'delete' }),

    groupCard: (sessionId: string, cardId: string, targetCardId: string, participantName: string) =>
      request<Session>(`/sessions/${sessionId}/cards/${cardId}/group`, {
        method: 'POST',
        body: JSON.stringify({ target_card_id: targetCardId }),
        headers: { 'X-Participant-Name': participantName },
      }, { category: 'Card', action: 'group' }),

    ungroupCard: (sessionId: string, cardId: string, participantName: string) =>
      request<void>(`/sessions/${sessionId}/cards/${cardId}/group`, {
        method: 'DELETE',
        headers: { 'X-Participant-Name': participantName },
      }, { category: 'Card', action: 'ungroup' }),

    submitFeedback: (rating: number, comment: string, sessionId?: string, participantName?: string) =>
      request<Feedback>('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          rating,
          comment,
          session_id: sessionId ?? null,
          participant_name: participantName ?? null,
          app_version: __APP_VERSION__,
        }),
      }, { category: 'Feedback', action: 'submit', name: String(rating), value: rating }),

    getPublicStats: () => request<PublicStats>('/stats'),

    getGifsStatus: () => request<{ enabled: boolean }>('/gifs/status'),

    searchGifs: (query: string) =>
      request<GifResult[]>(`/gifs/search?q=${encodeURIComponent(query)}`),

    adminAuth: (password: string) =>
      request<{ token: string }>('/stats/auth', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),

    getAdminStats: (token: string) =>
      request<AdminStats>('/stats/admin', {
        headers: { 'X-Admin-Token': token },
      }),

    patchFeedback: (feedbackId: string, status: 'new' | 'ignored' | 'fixed', token: string, fixedInVersion?: string) =>
      request<Feedback>(`/feedback/${feedbackId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, fixed_in_version: fixedInVersion ?? null }),
        headers: { 'X-Admin-Token': token },
      }, { category: 'Feedback', action: 'triage', name: status }),

    setTimerDuration: (sessionId: string, durationSeconds: number, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${sessionId}/timer`, {
        method: 'PATCH',
        body: JSON.stringify({ duration_seconds: durationSeconds }),
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }, { category: 'Timer', action: 'set_duration', value: durationSeconds }),

    startTimer: (sessionId: string, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${sessionId}/timer/start`, {
        method: 'POST',
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }, { category: 'Timer', action: 'start' }),

    pauseTimer: (sessionId: string, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${sessionId}/timer/pause`, {
        method: 'POST',
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }, { category: 'Timer', action: 'pause' }),

    resetTimer: (sessionId: string, facilitatorToken: string, participantName?: string) =>
      request<Session>(`/sessions/${sessionId}/timer/reset`, {
        method: 'POST',
        headers: {
          'X-Facilitator-Token': facilitatorToken,
          ...(participantName && { 'X-Participant-Name': participantName }),
        },
      }, { category: 'Timer', action: 'reset' }),
  }
}

export function countParticipantVotes(session: Session, participantName: string): number {
  const seenGroups = new Set<string>()
  let count = 0
  for (const card of session.cards) {
    if (card.votes.some((v) => v.participant_name === participantName)) {
      if (card.group_id) {
        if (!seenGroups.has(card.group_id)) {
          seenGroups.add(card.group_id)
          count++
        }
      } else {
        count++
      }
    }
  }
  return count
}

export const api = createApi()
