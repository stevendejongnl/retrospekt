import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isValidRating } from './feedback-dialog'
import { storage } from '../storage'

// ---------------------------------------------------------------------------
// Pure function: isValidRating
// ---------------------------------------------------------------------------

describe('isValidRating', () => {
  it('returns true for rating 1', () => {
    expect(isValidRating(1)).toBe(true)
  })

  it('returns true for rating 5', () => {
    expect(isValidRating(5)).toBe(true)
  })

  it('returns true for ratings 2, 3, 4', () => {
    expect(isValidRating(2)).toBe(true)
    expect(isValidRating(3)).toBe(true)
    expect(isValidRating(4)).toBe(true)
  })

  it('returns false for rating 0', () => {
    expect(isValidRating(0)).toBe(false)
  })

  it('returns false for rating 6', () => {
    expect(isValidRating(6)).toBe(false)
  })

  it('returns false for negative rating', () => {
    expect(isValidRating(-1)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Storage: getFeedbackGiven / setFeedbackGiven
// ---------------------------------------------------------------------------

describe('storage.getFeedbackGiven', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('returns false when no feedback was given', () => {
    expect(storage.getFeedbackGiven('1.0.0')).toBe(false)
  })

  it('returns true after setFeedbackGiven', () => {
    storage.setFeedbackGiven('1.0.0')
    expect(storage.getFeedbackGiven('1.0.0')).toBe(true)
  })

  it('tracks different versions independently', () => {
    storage.setFeedbackGiven('1.0.0')
    expect(storage.getFeedbackGiven('1.0.0')).toBe(true)
    expect(storage.getFeedbackGiven('1.1.0')).toBe(false)
  })

  it('persists the correct key format', () => {
    storage.setFeedbackGiven('2.5.0')
    expect(localStorage.getItem('retro_feedback_v2.5.0')).toBe('true')
  })
})
