import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { Session } from '../types'
import { buildParticipantColorMap } from '../types'
import { api } from '../api'
import { SSEClient } from '../sse'
import { storage } from '../storage'
import { getEffectiveTheme, toggleTheme } from '../theme'
import {
  faIconStyles,
  iconPencil,
  iconCommentDots,
  iconLock,
  iconSun,
  iconMoon,
  iconLink,
  iconCheck,
  iconClockRotateLeft,
  iconFileArrowDown,
} from '../icons'
import '../components/retro-board'
import '../components/session-history'

@customElement('session-page')
export class SessionPage extends LitElement {
  @property({ attribute: 'session-id', type: String }) sessionId = ''

  @state() private session: Session | null = null
  @state() private participantName = ''
  @state() private nameInput = ''
  @state() private loading = true
  @state() private showNamePrompt = false
  @state() private copied = false
  @state() private isDark = getEffectiveTheme() === 'dark'
  @state() private showHelp = false
  @state() private showHistory = false

  private sseClient: SSEClient | null = null
  private _themeListener!: EventListener

  static styles = [faIconStyles, css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--retro-bg-page);
    }

    /* ── Header ── */
    header {
      position: sticky;
      top: 0;
      z-index: 20;
      height: 56px;
      background: var(--retro-bg-surface);
      border-bottom: 1px solid var(--retro-border-subtle);
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand {
      font-size: 20px;
      font-weight: 900;
      color: var(--retro-text-primary);
      text-decoration: none;
      letter-spacing: -0.5px;
      cursor: pointer;
      flex-shrink: 0;
    }
    .brand em {
      font-style: normal;
      color: var(--retro-accent);
    }
    .session-title {
      font-size: 14px;
      color: var(--retro-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      text-align: center;
    }
    .session-date {
      color: var(--retro-text-disabled);
      font-size: 12px;
      font-weight: 400;
      margin-left: 6px;
    }
    .icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--retro-bg-subtle);
      border: 1.5px solid var(--retro-border-default);
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
      flex-shrink: 0;
    }
    .icon-btn:hover {
      border-color: var(--retro-accent);
      background: var(--retro-accent-tint);
      color: var(--retro-accent);
    }
    .theme-toggle {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--retro-bg-subtle);
      border: 1.5px solid var(--retro-border-default);
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s, border-color 0.12s;
      flex-shrink: 0;
    }
    .theme-toggle:hover {
      border-color: var(--retro-accent);
      background: var(--retro-accent-tint);
    }
    .user-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .avatar-name {
      font-size: 13px;
      color: var(--retro-text-secondary);
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .help-btn {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 1.5px solid #e0dbd4;
      background: none;
      font-size: 13px;
      font-weight: 700;
      color: #9a6a3a;
      cursor: pointer;
      font-family: inherit;
      flex-shrink: 0;
      transition: background 0.12s;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .help-btn:hover {
      background: #f5f0eb;
    }

    .help-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 24px;
    }
    .help-card {
      background: var(--retro-bg-surface);
      border-radius: 20px;
      padding: 32px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 16px 64px rgba(0, 0, 0, 0.16);
    }
    .help-card h3 {
      font-size: 18px;
      font-weight: 800;
      color: var(--retro-text-primary);
      margin: 0 0 6px;
      letter-spacing: -0.4px;
    }
    .help-card .subtitle {
      font-size: 13px;
      color: var(--retro-text-muted);
      margin-bottom: 24px;
    }
    .help-phase {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      padding: 14px 0;
      border-top: 1px solid var(--retro-border-subtle);
    }
    .help-phase-icon {
      font-size: 24px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .help-phase-body h4 {
      font-size: 14px;
      font-weight: 700;
      color: var(--retro-text-primary);
      margin: 0 0 4px;
    }
    .help-phase-body p {
      font-size: 13px;
      color: var(--retro-text-secondary);
      margin: 0;
      line-height: 1.5;
    }
    .help-close-btn {
      margin-top: 24px;
      width: 100%;
      padding: 11px;
      background: var(--retro-accent);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s;
    }
    .help-close-btn:hover {
      background: var(--retro-accent-hover);
    }
    .help-footer {
      margin-top: 16px;
      font-size: 11px;
      color: var(--retro-text-muted);
      text-align: center;
    }
    .help-footer a {
      color: var(--retro-accent);
      text-decoration: none;
    }
    .help-footer a:hover {
      text-decoration: underline;
    }

    /* ── Main ── */
    main {
      max-width: 1280px;
      margin: 0 auto;
      padding: 20px 24px 40px;
    }

    /* ── Share bar ── */
    .share-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 14px;
      background: var(--retro-share-bg);
      border: 1px solid var(--retro-share-border);
      border-radius: 10px;
      margin-bottom: 16px;
    }
    .share-icon {
      font-size: 14px;
      flex-shrink: 0;
    }
    .share-url {
      flex: 1;
      font-size: 12px;
      color: var(--retro-share-text);
      font-family: 'SF Mono', 'Fira Code', monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .copy-btn {
      background: none;
      border: 1px solid var(--retro-share-border);
      border-radius: 6px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 12px;
      color: var(--retro-share-text);
      font-family: inherit;
      transition: background 0.12s;
      flex-shrink: 0;
    }
    .copy-btn:hover {
      background: color-mix(in srgb, var(--retro-share-border) 25%, var(--retro-share-bg));
    }
    .export-btn {
      background: none;
      border: 1px solid var(--retro-share-border);
      border-radius: 6px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 14px;
      color: var(--retro-share-text);
      display: inline-flex;
      align-items: center;
      transition: background 0.12s;
      flex-shrink: 0;
    }
    .export-btn:hover {
      background: color-mix(in srgb, var(--retro-share-border) 25%, var(--retro-share-bg));
    }

    /* ── Phase banner ── */
    .phase-banner {
      text-align: center;
      padding: 9px 16px;
      margin-bottom: 16px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
    }
    .banner-discussing {
      background: var(--retro-phase-discussing-bg);
      color: var(--retro-phase-discussing-text);
      border: 1px solid var(--retro-facilitator-border);
    }
    .banner-closed {
      background: var(--retro-phase-closed-bg);
      color: var(--retro-phase-closed-text);
      border: 1px solid color-mix(in srgb, var(--retro-phase-closed-text) 25%, transparent);
    }

    /* ── States ── */
    .state-center {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 50vh;
      flex-direction: column;
      gap: 12px;
      color: var(--retro-text-disabled);
      font-size: 16px;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--retro-border-subtle);
      border-top-color: var(--retro-accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    /* ── Name prompt overlay ── */
    .overlay {
      position: fixed;
      inset: 0;
      background: var(--retro-overlay-bg);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 24px;
    }
    .name-card {
      background: var(--retro-bg-surface);
      border-radius: 20px;
      padding: 36px 32px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 16px 64px var(--retro-card-shadow);
    }
    .name-card .logo {
      font-size: 40px;
      margin-bottom: 12px;
    }
    .name-card h2 {
      font-size: 22px;
      font-weight: 800;
      color: var(--retro-text-primary);
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }
    .name-card p {
      font-size: 14px;
      color: var(--retro-text-muted);
      margin-bottom: 24px;
    }
    .name-card input {
      width: 100%;
      padding: 12px 16px;
      border: 1.5px solid var(--retro-border-default);
      border-radius: 10px;
      font-size: 16px;
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 0.12s;
      background: var(--retro-bg-subtle);
      color: var(--retro-text-primary);
    }
    .name-card input:focus {
      outline: none;
      border-color: var(--retro-accent);
      background: var(--retro-bg-surface);
    }
    .name-card input::placeholder {
      color: var(--retro-text-disabled);
    }
    .name-card button {
      width: 100%;
      margin-top: 10px;
      padding: 13px;
      background: var(--retro-accent);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s;
    }
    .name-card button:hover:not(:disabled) {
      background: var(--retro-accent-hover);
    }
    .name-card button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]

  async connectedCallback(): Promise<void> {
    super.connectedCallback()
    this._themeListener = () => {
      this.isDark = getEffectiveTheme() === 'dark'
    }
    window.addEventListener('retro-theme-change', this._themeListener)
    await this.loadSession()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.sseClient?.disconnect()
    window.removeEventListener('retro-theme-change', this._themeListener)
  }

  private async loadSession(): Promise<void> {
    this.loading = true

    try {
      const session = await api.getSession(this.sessionId)
      this.session = session

      const storedName = storage.getName(this.sessionId)
      if (storedName) {
        this.participantName = storedName
        await api.joinSession(this.sessionId, storedName)
        this.saveToHistory(session, storedName)
      } else {
        this.showNamePrompt = true
      }

      this.sseClient = new SSEClient(this.sessionId, (updated) => {
        this.session = updated
        if (this.participantName) {
          this.saveToHistory(updated, this.participantName)
        }
      })
      this.sseClient.connect()
    } catch {
      window.router.navigate('/?session_not_found')
    } finally {
      this.loading = false
    }
  }

  private async submitName(): Promise<void> {
    const name = this.nameInput.trim()
    if (!name) return

    storage.setName(this.sessionId, name)
    this.participantName = name
    this.showNamePrompt = false
    await api.joinSession(this.sessionId, name)
    if (this.session) this.saveToHistory(this.session, name)
  }

  private async copyUrl(): Promise<void> {
    await navigator.clipboard.writeText(window.location.href)
    this.copied = true
    setTimeout(() => (this.copied = false), 2000)
  }

  private goHome(e: Event): void {
    e.preventDefault()
    window.router.navigate('/')
  }

  private get myColor(): string {
    if (!this.session || !this.participantName) return 'var(--retro-accent)'
    const map = buildParticipantColorMap(this.session.participants)
    return map[this.participantName] ?? 'var(--retro-accent)'
  }

  private saveToHistory(session: Session, name: string): void {
    storage.addOrUpdateHistory({
      id: session.id,
      name: session.name,
      phase: session.phase,
      created_at: session.created_at,
      participantName: name,
      isFacilitator: storage.isFacilitator(session.id),
      joinedAt: new Date().toISOString(),
    })
  }

  private exportSession(): void {
    if (!this.session) return
    const { session } = this
    const date = new Date().toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })
    let md = `# ${session.name}\n_Exported ${date} · Phase: ${session.phase}_\n\n`

    for (const column of session.columns) {
      const cards = session.cards
        .filter((c) => c.column === column && c.published)
        .sort((a, b) => b.votes.length - a.votes.length)
      if (cards.length === 0) continue

      md += `## ${column}\n`
      for (const card of cards) {
        md += `- **${card.author_name}** · ${card.votes.length} vote${card.votes.length !== 1 ? 's' : ''}\n`
        md += `  ${card.text}\n`
        const reactions = card.reactions ?? []
        if (reactions.length > 0) {
          const counts: Record<string, number> = {}
          for (const r of reactions) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1
          const reactionStr = Object.entries(counts).map(([e, n]) => `${e}×${n}`).join('  ')
          md += `  Reactions: ${reactionStr}\n`
        }
        if (card.assignee) md += `  Assignee: ${card.assignee}\n`
      }
      md += '\n'
    }

    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  private onThemeToggle(): void {
    toggleTheme()
  }

  render() {
    if (this.loading) {
      return html`
        <div class="state-center">
          <div class="spinner"></div>
          <span>Loading session…</span>
        </div>
      `
    }

    if (!this.session) return nothing

    const { session } = this

    return html`
      <session-history .open=${this.showHistory} @close=${() => { this.showHistory = false }}></session-history>

      ${this.showHelp
        ? html`
            <div class="help-overlay" @click=${() => (this.showHelp = false)}>
              <div class="help-card" @click=${(e: Event) => e.stopPropagation()}>
                <h3>How Retrospekt works</h3>
                <p class="subtitle">
                  A session moves through three phases, guided by the facilitator.
                </p>
                <div class="help-phase">
                  <span class="help-phase-icon">${iconPencil()}</span>
                  <div class="help-phase-body">
                    <h4>Collecting</h4>
                    <p>
                      Add cards to the columns privately. Your cards are only visible to you until
                      you publish them — be honest!
                    </p>
                  </div>
                </div>
                <div class="help-phase">
                  <span class="help-phase-icon">${iconCommentDots()}</span>
                  <div class="help-phase-body">
                    <h4>Discussing</h4>
                    <p>
                      Publish your cards to share them with the team. Once visible, others can vote
                      on them. No new cards can be added.
                    </p>
                  </div>
                </div>
                <div class="help-phase">
                  <span class="help-phase-icon">${iconLock()}</span>
                  <div class="help-phase-body">
                    <h4>Closed</h4>
                    <p>
                      The session is read-only. The facilitator has wrapped up — results are
                      available to review.
                    </p>
                  </div>
                </div>
                <button class="help-close-btn" @click=${() => (this.showHelp = false)}>
                  Got it
                </button>
                <p class="help-footer">
                  Open source &middot;
                  <a href="https://github.com/stevendejongnl/retrospekt" target="_blank" rel="noopener noreferrer">github.com/stevendejongnl/retrospekt</a>
                </p>
              </div>
            </div>
          `
        : ''}

      ${this.showNamePrompt
        ? html`
            <div class="overlay">
              <div class="name-card">
                <div class="logo">🥓</div>
                <h2>${session.name}</h2>
                <p>Enter your name to join the retrospective.</p>
                <input
                  type="text"
                  placeholder="Your name"
                  .value=${this.nameInput}
                  @input=${(e: Event) => {
                    this.nameInput = (e.target as HTMLInputElement).value
                  }}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter') void this.submitName()
                  }}
                  autofocus
                />
                <button @click=${this.submitName} ?disabled=${!this.nameInput.trim()}>
                  Join session →
                </button>
              </div>
            </div>
          `
        : ''}

      <header>
        <span class="brand" @click=${this.goHome}>🥓 Retro<em>spekt</em></span>
        <span class="session-title">
          ${session.name}<span class="session-date">· ${new Date(session.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </span>
        <button class="icon-btn" @click=${() => { this.showHistory = true }} title="Your sessions">${iconClockRotateLeft()}</button>
        <button class="theme-toggle" @click=${this.onThemeToggle}>${this.isDark ? iconSun() : iconMoon()}</button>
        ${this.participantName
          ? html`
              <div class="user-chip">
                <div class="avatar" style="background:${this.myColor}">${this.participantName[0].toUpperCase()}</div>
                <span class="avatar-name">${this.participantName}</span>
                <button class="help-btn" @click=${() => (this.showHelp = true)}>?</button>
              </div>
            `
          : ''}
      </header>

      <main>
        <div class="share-bar">
          <span class="share-icon">${iconLink()}</span>
          <span class="share-url">${window.location.href}</span>
          <button class="copy-btn" @click=${this.copyUrl}>
            ${this.copied ? html`${iconCheck()} Copied` : 'Copy link'}
          </button>
          ${session.phase !== 'collecting'
            ? html`
                <button class="export-btn" @click=${this.exportSession} title="Export to Markdown">
                  ${iconFileArrowDown()}
                </button>
              `
            : ''}
        </div>

        ${session.phase === 'discussing'
          ? html`<div class="phase-banner banner-discussing">
              ${iconCommentDots()} Discussion phase — vote on the cards that matter most
            </div>`
          : session.phase === 'closed'
            ? html`<div class="phase-banner banner-closed">
                ${iconLock()} This session is closed
              </div>`
            : ''}

        <retro-board .session=${session} .participantName=${this.participantName}></retro-board>
      </main>
    `
  }
}
