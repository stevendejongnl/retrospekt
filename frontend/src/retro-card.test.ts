import { describe, it, expect } from 'vitest'
import { buildJiraUrl } from './components/retro-card'
import { extractJiraBaseUrl } from './pages/home-page'

// ── buildJiraUrl ──────────────────────────────────────────────────────────────

describe('buildJiraUrl', () => {
  const config = { baseUrl: 'https://myorg.atlassian.net', projectKey: 'RETRO' }
  const card = {
    id: 'c1',
    column: 'To Improve',
    text: 'Too many meetings',
    author_name: 'Alice',
    published: true,
    votes: [],
    reactions: [],
    assignee: null,
    created_at: '2026-01-01T00:00:00Z',
  }

  it('returns a URL starting with the Jira base URL', () => {
    const url = buildJiraUrl(config, card, 'Sprint 42')
    expect(url.startsWith('https://myorg.atlassian.net/')).toBe(true)
  })

  it('includes the correct path', () => {
    const url = buildJiraUrl(config, card, 'Sprint 42')
    expect(url).toContain('/secure/CreateIssueDetails.jspa')
  })

  it('includes projectKey query param', () => {
    const url = buildJiraUrl(config, card, 'Sprint 42')
    expect(url).toContain('projectKey=RETRO')
  })

  it('includes summary from card text', () => {
    const url = buildJiraUrl(config, card, 'Sprint 42')
    expect(url).toContain('Too+many+meetings')
  })

  it('URL-encodes special characters in summary', () => {
    const specialCard = { ...card, text: 'Fix: auth & session <token>' }
    const url = buildJiraUrl(config, specialCard, 'Q1 Retro')
    expect(url).toContain('Fix%3A+auth+%26+session+%3Ctoken%3E')
  })

  it('includes session name in description', () => {
    const url = buildJiraUrl(config, card, 'Sprint 42')
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('description')).toContain('Sprint 42')
  })

  it('includes column name in description', () => {
    const url = buildJiraUrl(config, card, 'Sprint 42')
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('description')).toContain('To Improve')
  })

  it('trims trailing slash from baseUrl', () => {
    const configWithSlash = { baseUrl: 'https://myorg.atlassian.net/', projectKey: 'RETRO' }
    const url = buildJiraUrl(configWithSlash, card, 'Sprint 42')
    expect(url).not.toContain('//secure')
  })

  it('works with Jira Server (non-atlassian.net) URL', () => {
    const serverConfig = { baseUrl: 'https://jira.mycompany.com', projectKey: 'BACK' }
    const url = buildJiraUrl(serverConfig, card, 'Sprint 42')
    expect(url.startsWith('https://jira.mycompany.com/')).toBe(true)
    expect(url).toContain('projectKey=BACK')
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
