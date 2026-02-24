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
      body: JSON.stringify({ name: 'Sprint Retro', participant_name: 'Alice', reactions_enabled: true }),
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

describe('joinSession', () => {
  it('POSTs to /api/v1/sessions/:id/join with participant_name', async () => {
    mockOk(mockSession)
    await api.joinSession('sess-1', 'Alice')

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/sessions/sess-1/join', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ participant_name: 'Alice' }),
    }))
  })
})

describe('addCard', () => {
  it('POSTs to /api/v1/sessions/:id/cards with card fields', async () => {
    mockOk({ id: 'card-1', column: 'went-well', text: 'Great sprint', author_name: 'Alice', votes: 0 })
    await api.addCard('sess-1', 'went-well', 'Great sprint', 'Alice')

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/sessions/sess-1/cards', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ column: 'went-well', text: 'Great sprint', author_name: 'Alice' }),
    }))
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

describe('publishCard', () => {
  it('POSTs to /cards/:id/publish with X-Participant-Name', async () => {
    mockOk({ id: 'card-1', published: true })
    await api.publishCard('sess-1', 'card-1', 'Alice')
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/v1/sessions/sess-1/cards/card-1/publish')
    expect(opts.method).toBe('POST')
    expect(opts.headers).toMatchObject({ 'X-Participant-Name': 'Alice' })
  })
})

describe('publishAllCards', () => {
  it('POSTs to /cards/publish-all with column and X-Participant-Name', async () => {
    mockOk([])
    await api.publishAllCards('sess-1', 'Went Well', 'Alice')
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/v1/sessions/sess-1/cards/publish-all')
    expect(opts.body).toBe(JSON.stringify({ column: 'Went Well' }))
    expect(opts.headers).toMatchObject({ 'X-Participant-Name': 'Alice' })
  })
})

describe('addColumn', () => {
  it('POSTs to /columns with name and X-Facilitator-Token', async () => {
    mockOk(mockSession, 201)
    await api.addColumn('sess-1', 'Kudos', 'tok-1')
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/v1/sessions/sess-1/columns')
    expect(opts.body).toBe(JSON.stringify({ name: 'Kudos' }))
    expect(opts.headers).toMatchObject({ 'X-Facilitator-Token': 'tok-1' })
  })
})

describe('renameColumn', () => {
  it('PATCHes /columns/:name with new name and X-Facilitator-Token', async () => {
    mockOk(mockSession)
    await api.renameColumn('sess-1', 'Went Well', 'Highlights', 'tok-1')
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/v1/sessions/sess-1/columns/Went%20Well')
    expect(opts.method).toBe('PATCH')
    expect(opts.body).toBe(JSON.stringify({ name: 'Highlights' }))
  })
})

describe('removeColumn', () => {
  it('DELETEs /columns/:name with X-Facilitator-Token', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 })
    await api.removeColumn('sess-1', 'Action Items', 'tok-1')
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/v1/sessions/sess-1/columns/Action%20Items')
    expect(opts.method).toBe('DELETE')
    expect(opts.headers).toMatchObject({ 'X-Facilitator-Token': 'tok-1' })
  })
})

describe('addReaction', () => {
  it('POSTs to /reactions with emoji and X-Participant-Name', async () => {
    mockOk({ id: 'card-1', reactions: [] })
    await api.addReaction('sess-1', 'card-1', '❤️', 'Alice')
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/v1/sessions/sess-1/cards/card-1/reactions')
    expect(opts.body).toBe(JSON.stringify({ emoji: '❤️' }))
  })
})

describe('removeReaction', () => {
  it('DELETEs /reactions with emoji query param and X-Participant-Name', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 })
    await api.removeReaction('sess-1', 'card-1', '❤️', 'Alice')
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('reactions?emoji=')
    expect(opts.method).toBe('DELETE')
  })
})

describe('assignCard', () => {
  it('PATCHes /assignee with assignee value', async () => {
    mockOk({ id: 'card-1', assignee: 'Bob' })
    await api.assignCard('sess-1', 'card-1', 'Bob', 'Alice', 'tok-1')
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/v1/sessions/sess-1/cards/card-1/assignee')
    expect(opts.method).toBe('PATCH')
    expect(opts.body).toBe(JSON.stringify({ assignee: 'Bob' }))
  })
})

describe('timer endpoints', () => {
  it('setTimerDuration PATCHes /timer with duration_seconds', async () => {
    mockOk(mockSession)
    await api.setTimerDuration('sess-1', 300, 'tok-1')
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/v1/sessions/sess-1/timer')
    expect(opts.method).toBe('PATCH')
    expect(opts.body).toBe(JSON.stringify({ duration_seconds: 300 }))
  })

  it('startTimer POSTs to /timer/start', async () => {
    mockOk(mockSession)
    await api.startTimer('sess-1', 'tok-1')
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/v1/sessions/sess-1/timer/start')
    expect(opts.method).toBe('POST')
  })

  it('pauseTimer POSTs to /timer/pause', async () => {
    mockOk(mockSession)
    await api.pauseTimer('sess-1', 'tok-1')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/v1/sessions/sess-1/timer/pause')
  })

  it('resetTimer POSTs to /timer/reset', async () => {
    mockOk(mockSession)
    await api.resetTimer('sess-1', 'tok-1')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/v1/sessions/sess-1/timer/reset')
  })
})

describe('createSession with custom columns', () => {
  it('includes columns array in the request body when provided', async () => {
    mockOk({ ...mockSession, facilitator_token: 'tok-1' }, 201)
    await api.createSession('Retro', 'Alice', ['Roses', 'Thorns'])
    const [, opts] = mockFetch.mock.calls[0]
    expect(JSON.parse(opts.body as string)).toMatchObject({ columns: ['Roses', 'Thorns'] })
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
