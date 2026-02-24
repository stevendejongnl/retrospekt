import { vi, describe, it, expect, beforeEach } from 'vitest'

type TestFn = () => void | Promise<void>

function suppressWarn(fn: TestFn): TestFn {
  return async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await fn()
    } finally {
      spy.mockRestore()
    }
  }
}

// EventSource is not in jsdom — stub it BEFORE importing sse.ts
// (sse.ts does not access EventSource at module load time, only inside connect(),
//  so the global just needs to be in place before connect() is called in tests)
class MockEventSource {
  static instance: MockEventSource | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()
  constructor(public url: string) {
    MockEventSource.instance = this
  }
}
vi.stubGlobal('EventSource', MockEventSource)

import { SSEClient } from './sse'

describe('SSEClient', () => {
  let onUpdate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    MockEventSource.instance = null
    onUpdate = vi.fn()
  })

  it('opens EventSource at the correct URL on connect()', () => {
    const client = new SSEClient('session-abc', onUpdate)
    client.connect()
    expect(MockEventSource.instance).not.toBeNull()
    expect(MockEventSource.instance!.url).toBe('/api/v1/sessions/session-abc/stream')
  })

  it('parses JSON message and calls onUpdate with the Session object', () => {
    const client = new SSEClient('session-abc', onUpdate)
    client.connect()
    const session = {
      id: 'session-abc',
      name: 'Sprint Retro',
      columns: [],
      phase: 'collecting',
      participants: [],
      cards: [],
      created_at: '',
      updated_at: '',
    }
    MockEventSource.instance!.onmessage!(
      new MessageEvent('message', { data: JSON.stringify(session) }),
    )
    expect(onUpdate).toHaveBeenCalledWith(session)
  })

  it('swallows invalid JSON without throwing and without calling onUpdate', suppressWarn(() => {
    const client = new SSEClient('session-abc', onUpdate)
    client.connect()
    expect(() => {
      MockEventSource.instance!.onmessage!(new MessageEvent('message', { data: 'not-valid-json' }))
    }).not.toThrow()
    expect(onUpdate).not.toHaveBeenCalled()
  }))

  it('calls close() on disconnect()', () => {
    const client = new SSEClient('session-abc', onUpdate)
    client.connect()
    const instance = MockEventSource.instance!
    client.disconnect()
    expect(instance.close).toHaveBeenCalled()
  })

  it('disconnect() before connect() is a safe no-op', () => {
    const client = new SSEClient('session-abc', onUpdate)
    expect(() => client.disconnect()).not.toThrow()
  })

  it('onerror handler is a safe no-op', () => {
    const client = new SSEClient('session-abc', onUpdate)
    client.connect()
    expect(() => MockEventSource.instance!.onerror?.()).not.toThrow()
  })
})
