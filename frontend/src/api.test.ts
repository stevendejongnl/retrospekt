import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApi } from './api'

const mockFetch = vi.fn()
const api = createApi(mockFetch)

const mockSession = {
  id: 'sess-1',
  name: 'Sprint Retro',
  columns: ['went-well', 'to-improve'],
  phase: 'collecting',
  participants: [],
  cards: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function mockOk(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(''),
  })
}

function mockError(status: number, message: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: () => Promise.resolve(message),
  })
}

beforeEach(() => mockFetch.mockReset())

describe('createSession', () => {
  it('POSTs to /api/v1/sessions with name and participant_name', async () => {
    mockOk({ ...mockSession, facilitator_token: 'tok-1' }, 201)
    await api.createSession('Sprint Retro', 'Alice')

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/sessions', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Sprint Retro', participant_name: 'Alice' }),
    }))
  })
})

describe('getSession', () => {
  it('GETs /api/v1/sessions/:id', async () => {
    mockOk(mockSession)
    await api.getSession('sess-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/sessions/sess-1', expect.objectContaining({}))
  })
})

describe('setPhase', () => {
  it('POSTs with X-Facilitator-Token header', async () => {
    mockOk(mockSession)
    await api.setPhase('sess-1', 'discussing', 'my-token')

    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers).toMatchObject({ 'X-Facilitator-Token': 'my-token' })
  })
})

describe('deleteCard', () => {
  it('sends DELETE with X-Participant-Name header', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 })
    await api.deleteCard('sess-1', 'card-1', 'Alice')

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/v1/sessions/sess-1/cards/card-1')
    expect(options.method).toBe('DELETE')
    expect(options.headers).toMatchObject({ 'X-Participant-Name': 'Alice' })
  })
})

describe('addVote / removeVote', () => {
  it('addVote POSTs to /votes with X-Participant-Name', async () => {
    mockOk(mockSession.cards[0])
    await api.addVote('sess-1', 'card-1', 'Alice')

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/v1/sessions/sess-1/cards/card-1/votes')
    expect(options.method).toBe('POST')
    expect(options.headers).toMatchObject({ 'X-Participant-Name': 'Alice' })
  })

  it('removeVote DELETEs /votes', async () => {
    mockOk(mockSession.cards[0])
    await api.removeVote('sess-1', 'card-1', 'Alice')

    const [, options] = mockFetch.mock.calls[0]
    expect(options.method).toBe('DELETE')
  })
})

describe('error handling', () => {
  it('throws with status and message on non-ok response', async () => {
    mockError(404, 'Not Found')
    await expect(api.getSession('bad-id')).rejects.toThrow('API 404: Not Found')
  })

  it('returns undefined for 204 No Content', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 })
    const result = await api.deleteCard('sess-1', 'card-1', 'Alice')
    expect(result).toBeUndefined()
  })
})
