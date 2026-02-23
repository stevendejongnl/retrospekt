import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { Session } from '../types'
import { api } from '../api'
import { SSEClient } from '../sse'
import { storage } from '../storage'
import '../components/retro-board'

@customElement('session-page')
export class SessionPage extends LitElement {
  @property({ attribute: 'session-id', type: String }) sessionId = ''

  @state() private session: Session | null = null
  @state() private participantName = ''
  @state() private nameInput = ''
  @state() private loading = true
  @state() private error = ''
  @state() private showNamePrompt = false
  @state() private copied = false

  private sseClient: SSEClient | null = null

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: #faf9f7;
    }

    /* ── Header ── */
    header {
      position: sticky;
      top: 0;
      z-index: 20;
      height: 56px;
      background: white;
      border-bottom: 1px solid #f0ede8;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand {
      font-size: 20px;
      font-weight: 900;
      color: #111;
      text-decoration: none;
      letter-spacing: -0.5px;
      cursor: pointer;
      flex-shrink: 0;
    }
    .brand em {
      font-style: normal;
      color: #e85d04;
    }
    .session-title {
      font-size: 14px;
      color: #666;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      text-align: center;
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
      background: #e85d04;
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
      color: #666;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
      background: #f0f9ff;
      border: 1px solid #bae6fd;
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
      color: #0369a1;
      font-family: 'SF Mono', 'Fira Code', monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .copy-btn {
      background: none;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 12px;
      color: #0369a1;
      font-family: inherit;
      transition: background 0.12s;
      flex-shrink: 0;
    }
    .copy-btn:hover {
      background: #e0f2fe;
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
      background: #fff7ed;
      color: #c2410c;
      border: 1px solid #fed7aa;
    }
    .banner-closed {
      background: #faf5ff;
      color: #7e22ce;
      border: 1px solid #e9d5ff;
    }

    /* ── States ── */
    .state-center {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 50vh;
      flex-direction: column;
      gap: 12px;
      color: #aaa;
      font-size: 16px;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #f0ede8;
      border-top-color: #e85d04;
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
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 24px;
    }
    .name-card {
      background: white;
      border-radius: 20px;
      padding: 36px 32px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 16px 64px rgba(0, 0, 0, 0.16);
    }
    .name-card .logo {
      font-size: 40px;
      margin-bottom: 12px;
    }
    .name-card h2 {
      font-size: 22px;
      font-weight: 800;
      color: #111;
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }
    .name-card p {
      font-size: 14px;
      color: #888;
      margin-bottom: 24px;
    }
    .name-card input {
      width: 100%;
      padding: 12px 16px;
      border: 1.5px solid #e8e8e8;
      border-radius: 10px;
      font-size: 16px;
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 0.12s;
      background: #fafafa;
    }
    .name-card input:focus {
      outline: none;
      border-color: #e85d04;
      background: white;
    }
    .name-card button {
      width: 100%;
      margin-top: 10px;
      padding: 13px;
      background: #e85d04;
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
      background: #c44e00;
    }
    .name-card button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `

  async connectedCallback(): Promise<void> {
    super.connectedCallback()
    await this.loadSession()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.sseClient?.disconnect()
  }

  private async loadSession(): Promise<void> {
    this.loading = true
    this.error = ''

    try {
      const session = await api.getSession(this.sessionId)
      this.session = session

      const storedName = storage.getName(this.sessionId)
      if (storedName) {
        this.participantName = storedName
        await api.joinSession(this.sessionId, storedName)
      } else {
        this.showNamePrompt = true
      }

      this.sseClient = new SSEClient(this.sessionId, (updated) => {
        this.session = updated
      })
      this.sseClient.connect()
    } catch {
      this.error = 'Session not found or could not be loaded.'
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

  render() {
    if (this.loading) {
      return html`
        <div class="state-center">
          <div class="spinner"></div>
          <span>Loading session…</span>
        </div>
      `
    }

    if (this.error || !this.session) {
      return html`
        <div class="state-center">
          <span style="font-size:48px">🥓</span>
          <strong>Session not found</strong>
          <span style="font-size:14px">${this.error}</span>
        </div>
      `
    }

    const { session } = this

    return html`
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
        <span class="session-title">${session.name}</span>
        ${this.participantName
          ? html`
              <div class="user-chip">
                <div class="avatar">${this.participantName[0].toUpperCase()}</div>
                <span class="avatar-name">${this.participantName}</span>
              </div>
            `
          : ''}
      </header>

      <main>
        <div class="share-bar">
          <span class="share-icon">🔗</span>
          <span class="share-url">${window.location.href}</span>
          <button class="copy-btn" @click=${this.copyUrl}>
            ${this.copied ? '✓ Copied' : 'Copy link'}
          </button>
        </div>

        ${session.phase === 'discussing'
          ? html`<div class="phase-banner banner-discussing">
              💬 Discussion phase — vote on the cards that matter most
            </div>`
          : session.phase === 'closed'
            ? html`<div class="phase-banner banner-closed">
                🔒 This session is closed
              </div>`
            : ''}

        <retro-board .session=${session} .participantName=${this.participantName}></retro-board>
      </main>
    `
  }
}
