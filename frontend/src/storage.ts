/**
 * Per-session localStorage contract:
 *   retro_name_{id}          — participant name (set on create or join)
 *   retro_facilitator_{id}   — facilitator token UUID (set on create only)
 *
 * Cross-session localStorage contract:
 *   retro_history            — JSON array of SessionHistoryEntry (newest first, max 50)
 */

export interface SessionHistoryEntry {
  id: string
  name: string
  phase: string
  created_at: string
  participantName: string
  isFacilitator: boolean
  joinedAt: string
}

class RetroStorage {
  getName(sessionId: string): string | null {
    return localStorage.getItem(`retro_name_${sessionId}`)
  }

  setName(sessionId: string, name: string): void {
    localStorage.setItem(`retro_name_${sessionId}`, name)
  }

  getFacilitatorToken(sessionId: string): string | null {
    return localStorage.getItem(`retro_facilitator_${sessionId}`)
  }

  setFacilitatorToken(sessionId: string, token: string): void {
    localStorage.setItem(`retro_facilitator_${sessionId}`, token)
  }

  isFacilitator(sessionId: string): boolean {
    return this.getFacilitatorToken(sessionId) !== null
  }

  getHistory(): SessionHistoryEntry[] {
    try {
      return JSON.parse(localStorage.getItem('retro_history') ?? '[]') as SessionHistoryEntry[]
    } catch {
      return []
    }
  }

  addOrUpdateHistory(entry: SessionHistoryEntry): void {
    const history = this.getHistory()
    const idx = history.findIndex((e) => e.id === entry.id)
    if (idx >= 0) {
      // Update in-place but preserve the original joinedAt
      history[idx] = { ...history[idx], ...entry, joinedAt: history[idx].joinedAt }
    } else {
      history.unshift(entry)
    }
    localStorage.setItem('retro_history', JSON.stringify(history.slice(0, 50)))
  }

  removeFromHistory(id: string): void {
    const history = this.getHistory().filter((e) => e.id !== id)
    localStorage.setItem('retro_history', JSON.stringify(history))
  }

  clearHistory(): void {
    localStorage.removeItem('retro_history')
  }
}

export const storage = new RetroStorage()
