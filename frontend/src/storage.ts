/**
 * Per-session localStorage contract:
 *   retro_name_{id}          — participant name (set on create or join)
 *   retro_facilitator_{id}   — facilitator token UUID (set on create only)
 *
 * Cross-session localStorage contract:
 *   retro_history            — JSON array of SessionHistoryEntry (newest first, max 50)
 *   retro_feedback_v{ver}    — "true" when feedback was submitted for that app version
 */

export interface SessionHistoryEntry {
  id: string
  name: string
  phase: string
  created_at: string
  participantName: string
  isFacilitator: boolean
  joinedAt: string
  seenChangelogVersion?: string
}

function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    /* istanbul ignore next */
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true
    /* istanbul ignore next */
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false
  }
  return false
}

export { semverGt }

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

  getMaxSeenChangelogVersion(): string | null {
    const versions = this.getHistory()
      .map((e) => e.seenChangelogVersion)
      .filter((v): v is string => v !== undefined)
    if (versions.length === 0) return null
    return versions.reduce((max, v) => (semverGt(v, max) ? v : max))
  }

  markChangelogSeen(sessionId: string, version: string): void {
    const history = this.getHistory()
    const idx = history.findIndex((e) => e.id === sessionId)
    if (idx < 0) return
    history[idx] = { ...history[idx], seenChangelogVersion: version }
    localStorage.setItem('retro_history', JSON.stringify(history))
  }

  getFeedbackGiven(version: string): boolean {
    return localStorage.getItem(`retro_feedback_v${version}`) === 'true'
  }

  setFeedbackGiven(version: string): void {
    localStorage.setItem(`retro_feedback_v${version}`, 'true')
  }
}

export const storage = new RetroStorage()
