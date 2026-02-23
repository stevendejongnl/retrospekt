import { beforeEach, describe, expect, it } from 'vitest'
import { storage } from './storage'

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
})
