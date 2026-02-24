import { describe, it, expect } from 'vitest'
import { computeRemaining } from './retro-timer'
import type { TimerState } from '../types'

describe('computeRemaining', () => {
  it('returns full duration when not started and no paused_remaining', () => {
    const timer: TimerState = { duration_seconds: 300, started_at: null, paused_remaining: null }
    expect(computeRemaining(timer, Date.now())).toBe(300)
  })

  it('returns paused_remaining when timer is paused', () => {
    const timer: TimerState = { duration_seconds: 300, started_at: null, paused_remaining: 150 }
    expect(computeRemaining(timer, Date.now())).toBe(150)
  })

  it('returns 0 when paused at zero', () => {
    const timer: TimerState = { duration_seconds: 300, started_at: null, paused_remaining: 0 }
    expect(computeRemaining(timer, Date.now())).toBe(0)
  })

  it('returns correct remaining time when running', () => {
    const now = Date.now()
    const startedAt = new Date(now - 60_000).toISOString() // 60 seconds ago
    const timer: TimerState = { duration_seconds: 300, started_at: startedAt, paused_remaining: null }
    const remaining = computeRemaining(timer, now)
    expect(remaining).toBeCloseTo(240, 0)
  })

  it('returns 0 when timer has expired', () => {
    const now = Date.now()
    const startedAt = new Date(now - 400_000).toISOString() // 400 seconds ago, past 300s duration
    const timer: TimerState = { duration_seconds: 300, started_at: startedAt, paused_remaining: null }
    expect(computeRemaining(timer, now)).toBe(0)
  })

  it('uses started_at over paused_remaining when both are set (running takes priority)', () => {
    const now = Date.now()
    const startedAt = new Date(now - 100_000).toISOString()
    const timer: TimerState = { duration_seconds: 300, started_at: startedAt, paused_remaining: 150 }
    // Should use started_at path: 300 - 100 = 200
    const remaining = computeRemaining(timer, now)
    expect(remaining).toBeCloseTo(200, 0)
  })
})
