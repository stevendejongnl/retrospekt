import { beforeEach, describe, expect, it } from 'vitest'
import { storage, semverGt } from './storage'

describe('semverGt', () => {
  it('returns true when major is greater', () => expect(semverGt('2.0.0', '1.9.9')).toBe(true))
  it('returns true when minor is greater', () => expect(semverGt('1.28.0', '1.27.9')).toBe(true))
  it('returns true when patch is greater', () => expect(semverGt('1.27.10', '1.27.9')).toBe(true))
  it('returns false when equal', () => expect(semverGt('1.27.1', '1.27.1')).toBe(false))
  it('returns false when less', () => expect(semverGt('1.27.0', '1.27.1')).toBe(false))
})

describe('RetroStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getName / setName', () => {
    it('returns null when no name has been stored', () => {
      expect(storage.getName('session-1')).toBeNull()
    })

    it('returns the name after setName', () => {
      storage.setName('session-1', 'Alice')
      expect(storage.getName('session-1')).toBe('Alice')
    })
  })

  describe('getFacilitatorToken / setFacilitatorToken', () => {
    it('returns null when no token has been stored', () => {
      expect(storage.getFacilitatorToken('session-1')).toBeNull()
    })

    it('returns the token after setFacilitatorToken', () => {
      storage.setFacilitatorToken('session-1', 'token-abc')
      expect(storage.getFacilitatorToken('session-1')).toBe('token-abc')
    })
  })

  describe('isFacilitator', () => {
    it('returns false when no token is stored', () => {
      expect(storage.isFacilitator('session-1')).toBe(false)
    })

    it('returns true after setFacilitatorToken', () => {
      storage.setFacilitatorToken('session-1', 'token-abc')
      expect(storage.isFacilitator('session-1')).toBe(true)
    })
  })

  describe('session scoping', () => {
    it('does not leak name across session IDs', () => {
      storage.setName('session-1', 'Alice')
      expect(storage.getName('session-2')).toBeNull()
    })

    it('does not leak facilitator token across session IDs', () => {
      storage.setFacilitatorToken('session-1', 'token-abc')
      expect(storage.isFacilitator('session-2')).toBe(false)
    })
  })

  describe('getHistory', () => {
    it('returns empty array when nothing stored', () => {
      expect(storage.getHistory()).toEqual([])
    })

    it('returns parsed entries when history exists', () => {
      const entry = { id: 's1', name: 'Retro', phase: 'collecting', created_at: '', participantName: 'Alice', isFacilitator: false, joinedAt: '' }
      localStorage.setItem('retro_history', JSON.stringify([entry]))
      expect(storage.getHistory()).toEqual([entry])
    })

    it('returns empty array when stored JSON is corrupted', () => {
      localStorage.setItem('retro_history', 'not-valid-json{{{')
      expect(storage.getHistory()).toEqual([])
    })
  })

  describe('addOrUpdateHistory', () => {
    const base = { name: 'Retro', phase: 'collecting', created_at: '', participantName: 'Alice', isFacilitator: false, joinedAt: '2026-01-01' }

    it('adds a new entry when session is not in history', () => {
      storage.addOrUpdateHistory({ id: 's1', ...base })
      expect(storage.getHistory()).toHaveLength(1)
      expect(storage.getHistory()[0].id).toBe('s1')
    })

    it('updates in-place when session already exists', () => {
      storage.addOrUpdateHistory({ id: 's1', ...base, phase: 'collecting' })
      storage.addOrUpdateHistory({ id: 's1', ...base, phase: 'discussing' })
      const history = storage.getHistory()
      expect(history).toHaveLength(1)
      expect(history[0].phase).toBe('discussing')
    })

    it('preserves the original joinedAt on update', () => {
      storage.addOrUpdateHistory({ id: 's1', ...base, joinedAt: 'original' })
      storage.addOrUpdateHistory({ id: 's1', ...base, joinedAt: 'new-value' })
      expect(storage.getHistory()[0].joinedAt).toBe('original')
    })

    it('caps history at 50 entries', () => {
      for (let i = 0; i < 55; i++) {
        storage.addOrUpdateHistory({ id: `s${i}`, ...base })
      }
      expect(storage.getHistory()).toHaveLength(50)
    })
  })

  describe('removeFromHistory', () => {
    it('removes the entry with the given id', () => {
      const entry = { id: 's1', name: 'Retro', phase: 'collecting', created_at: '', participantName: 'Alice', isFacilitator: false, joinedAt: '' }
      storage.addOrUpdateHistory(entry)
      storage.removeFromHistory('s1')
      expect(storage.getHistory()).toEqual([])
    })

    it('is a no-op when id not found', () => {
      storage.removeFromHistory('ghost')
      expect(storage.getHistory()).toEqual([])
    })
  })

  describe('clearHistory', () => {
    it('removes all history entries', () => {
      storage.addOrUpdateHistory({ id: 's1', name: 'R', phase: 'closed', created_at: '', participantName: 'A', isFacilitator: false, joinedAt: '' })
      storage.clearHistory()
      expect(storage.getHistory()).toEqual([])
    })
  })

  describe('getMaxSeenChangelogVersion', () => {
    const base = { name: 'Retro', phase: 'collecting', created_at: '', participantName: 'Alice', isFacilitator: false, joinedAt: '' }

    it('returns null when history is empty', () => {
      expect(storage.getMaxSeenChangelogVersion()).toBeNull()
    })

    it('returns null when no entries have seenChangelogVersion', () => {
      storage.addOrUpdateHistory({ id: 's1', ...base })
      expect(storage.getMaxSeenChangelogVersion()).toBeNull()
    })

    it('returns the version from the only entry that has it', () => {
      storage.addOrUpdateHistory({ id: 's1', ...base, seenChangelogVersion: '1.27.1' })
      expect(storage.getMaxSeenChangelogVersion()).toBe('1.27.1')
    })

    it('returns the highest version across multiple entries', () => {
      storage.addOrUpdateHistory({ id: 's1', ...base, seenChangelogVersion: '1.27.0' })
      storage.addOrUpdateHistory({ id: 's2', ...base, seenChangelogVersion: '1.28.0' })
      storage.addOrUpdateHistory({ id: 's3', ...base, seenChangelogVersion: '1.27.1' })
      expect(storage.getMaxSeenChangelogVersion()).toBe('1.28.0')
    })

    it('handles semver correctly (1.27.10 > 1.27.9)', () => {
      storage.addOrUpdateHistory({ id: 's1', ...base, seenChangelogVersion: '1.27.9' })
      storage.addOrUpdateHistory({ id: 's2', ...base, seenChangelogVersion: '1.27.10' })
      expect(storage.getMaxSeenChangelogVersion()).toBe('1.27.10')
    })

    it('ignores entries without seenChangelogVersion when computing max', () => {
      storage.addOrUpdateHistory({ id: 's1', ...base })
      storage.addOrUpdateHistory({ id: 's2', ...base, seenChangelogVersion: '1.26.0' })
      expect(storage.getMaxSeenChangelogVersion()).toBe('1.26.0')
    })
  })

  describe('markChangelogSeen', () => {
    const base = { name: 'Retro', phase: 'collecting', created_at: '', participantName: 'Alice', isFacilitator: false, joinedAt: '' }

    it('sets seenChangelogVersion on the matching entry', () => {
      storage.addOrUpdateHistory({ id: 's1', ...base })
      storage.markChangelogSeen('s1', '1.28.0')
      const history = storage.getHistory()
      expect(history[0].seenChangelogVersion).toBe('1.28.0')
    })

    it('is a no-op when session id not in history', () => {
      storage.markChangelogSeen('ghost', '1.28.0')
      expect(storage.getHistory()).toEqual([])
    })

    it('updates the version when called again with a newer version', () => {
      storage.addOrUpdateHistory({ id: 's1', ...base, seenChangelogVersion: '1.27.1' })
      storage.markChangelogSeen('s1', '1.28.0')
      expect(storage.getHistory()[0].seenChangelogVersion).toBe('1.28.0')
    })
  })

})
