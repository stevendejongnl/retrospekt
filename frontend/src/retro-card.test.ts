import { describe, it, expect } from 'vitest'
import { buildJiraProjectUrl, formatJiraDescription } from './components/retro-card'
import { extractJiraBaseUrl } from './pages/home-page'

const card = {
  id: 'c1',
  column: 'To Improve',
  text: 'Too many meetings',
  author_name: 'Alice',
  published: true,
  votes: [],
  reactions: [],
  assignee: null,
  group_id: null,
  created_at: '2026-01-01T00:00:00Z',
}

// ── buildJiraProjectUrl ────────────────────────────────────────────────────────

describe('buildJiraProjectUrl', () => {
  it('returns base URL + /browse/ + projectKey', () => {
    const config = { baseUrl: 'https://myorg.atlassian.net', projectKey: 'RETRO' }
    expect(buildJiraProjectUrl(config)).toBe('https://myorg.atlassian.net/browse/RETRO')
  })

  it('trims trailing slash from baseUrl', () => {
    const config = { baseUrl: 'https://myorg.atlassian.net/', projectKey: 'RETRO' }
    expect(buildJiraProjectUrl(config)).toBe('https://myorg.atlassian.net/browse/RETRO')
  })

  it('works with Jira Server (non-atlassian.net) URL', () => {
    const config = { baseUrl: 'https://jira.mycompany.com', projectKey: 'BACK' }
    expect(buildJiraProjectUrl(config)).toBe('https://jira.mycompany.com/browse/BACK')
  })
})

// ── formatJiraDescription ─────────────────────────────────────────────────────

describe('formatJiraDescription', () => {
  it('includes session name', () => {
    expect(formatJiraDescription(card, 'Sprint 42')).toContain('Sprint 42')
  })

  it('includes column name', () => {
    expect(formatJiraDescription(card, 'Sprint 42')).toContain('To Improve')
  })

  it('includes card text', () => {
    expect(formatJiraDescription(card, 'Sprint 42')).toContain('Too many meetings')
  })
})

// ── extractJiraBaseUrl ────────────────────────────────────────────────────────

describe('extractJiraBaseUrl', () => {
  it('extracts origin from a Jira Cloud browse URL', () => {
    expect(extractJiraBaseUrl('https://myorg.atlassian.net/browse/RETRO-1')).toBe('https://myorg.atlassian.net')
  })

  it('extracts origin from a Jira Server project URL', () => {
    expect(extractJiraBaseUrl('https://jira.mycompany.com/projects/BACK/boards')).toBe('https://jira.mycompany.com')
  })

  it('returns empty string for blank input', () => {
    expect(extractJiraBaseUrl('')).toBe('')
  })

  it('returns empty string for invalid URL', () => {
    expect(extractJiraBaseUrl('not a url')).toBe('')
  })

  it('strips path, query, and hash — returns only origin', () => {
    const url = 'https://myorg.atlassian.net/jira/software/projects/RETRO/boards?foo=bar#section'
    expect(extractJiraBaseUrl(url)).toBe('https://myorg.atlassian.net')
  })
})
