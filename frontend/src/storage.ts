/**
 * Per-session localStorage contract:
 *   retro_name_{id}          — participant name (set on create or join)
 *   retro_facilitator_{id}   — facilitator token UUID (set on create only)
 */
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
}

export const storage = new RetroStorage()
