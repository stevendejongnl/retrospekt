import { LitElement, css, html, nothing } from 'lit'
import { baseStyles } from '../styles'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import { storage } from '../storage'
import { getBrand, clearBrand, bacon } from '../theme'
import { faIconStyles, designIcon } from '../icons'
import '../components/session-history'
import '../components/theme-menu'
import type { ColumnColor } from '../column-colors'

// Each template's colours follow what its columns mean (Mad is red, Glad green).
const COLUMN_TEMPLATES: Array<{ label: string; columns: string[]; colors: ColumnColor[] }> = [
  { label: 'Standard', columns: ['Went Well', 'To Improve', 'Action Items'], colors: ['green', 'amber', 'blue'] },
  { label: 'Mad · Sad · Glad', columns: ['Mad', 'Sad', 'Glad'], colors: ['red', 'blue', 'green'] },
  { label: 'Start · Stop · Continue', columns: ['Start', 'Stop', 'Continue'], colors: ['green', 'red', 'blue'] },
  { label: '4Ls', columns: ['Liked', 'Learned', 'Lacked', 'Longed for'], colors: ['green', 'blue', 'amber', 'purple'] },
]

@customElement('home-page')
export class HomePage extends LitElement {
  @state() private sessionName = ''
  @state() private yourName = ''
  @state() private loading = false
  @state() private error = ''
  @state() private selectedTemplate = 0
  @state() private brand = getBrand()
  @state() private showHistory = false
  @state() private reactionsEnabled = true
  @state() private openFacilitator = false
  @state() private maxVotesPerParticipant: number | null = null
  @state() private sessionNotFound = false

  private _brandListener!: EventListener
  private _halalListener!: EventListener

  connectedCallback(): void {
    super.connectedCallback()
    this._brandListener = () => {
      this.brand = getBrand()
    }
    this._halalListener = () => {
      this.requestUpdate()
    }
    window.addEventListener('retro-brand-change', this._brandListener)
    window.addEventListener('retro-halal-change', this._halalListener)
    const params = new URLSearchParams(window.location.search)
    if (params.has('session_not_found')) {
      this.sessionNotFound = true
      history.replaceState(null, '', '/')
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    window.removeEventListener('retro-brand-change', this._brandListener)
    window.removeEventListener('retro-halal-change', this._halalListener)
  }

  static styles = [ baseStyles, faIconStyles, css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--retro-bg-page);
    }
    .page {
      min-height: 100vh;
      padding: 24px 32px;
      position: relative;
    }
    .corner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .corner-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--retro-corner-bg);
      border: 1px solid var(--retro-corner-border);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      color: var(--retro-text-secondary);
      transition: border-color 0.12s, color 0.12s;
    }
    .corner-btn:hover {
      border-color: var(--retro-accent);
      color: var(--retro-accent);
    }
    .hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      margin-top: 32px;
      position: relative;
    }
    .logo {
      font-size: 68px;
      line-height: 1;
      filter: drop-shadow(0 8px 24px rgba(217, 116, 38, 0.35));
      user-select: none;
    }
    .title {
      text-align: center;
    }
    h1 {
      font-size: 44px;
      font-weight: 800;
      color: var(--retro-text-primary);
      letter-spacing: -0.025em;
      margin-bottom: 8px;
    }
    h1 em {
      font-style: normal;
      color: var(--retro-accent);
    }
    .tagline {
      font-size: 14px;
      color: var(--retro-text-secondary);
    }
    .card {
      width: 460px;
      max-width: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: var(--retro-glass-bg-strong);
      border: 1px solid var(--retro-glass-border);
      border-radius: var(--retro-radius-lg);
      padding: 24px;
      box-shadow: var(--retro-shadow-float);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-align: left;
    }
    .field-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .field-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--retro-text-primary);
    }
    input[type='text'], input[type='number'] {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--retro-input-border);
      border-radius: var(--retro-radius-md);
      font-size: 14px;
      font-family: inherit;
      color: var(--retro-text-primary);
      background: var(--retro-input-bg);
      outline: none;
    }
    input[type='text']:focus, input[type='number']:focus {
      border-color: color-mix(in srgb, var(--retro-accent) 45%, transparent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--retro-accent) 12%, transparent);
    }
    input::placeholder {
      color: var(--retro-text-muted);
    }
    input:disabled {
      opacity: 0.6;
    }
    input.narrow {
      width: 140px;
    }
    .create-btn {
      padding: 14px;
      background: var(--retro-accent);
      color: var(--retro-accent-contrast);
      border: 1px solid color-mix(in srgb, var(--retro-accent) 50%, transparent);
      border-radius: var(--retro-radius-md);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .create-btn:hover:not(:disabled) {
      background: var(--retro-accent-hover);
    }
    .create-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .error-msg {
      font-size: 13px;
      color: var(--retro-error);
      text-align: center;
    }
    .footer {
      margin-top: 8px;
      font-size: 11px;
      color: var(--retro-text-muted);
    }
    .footer a {
      color: var(--retro-accent);
      text-decoration: none;
    }
    .template-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .template-btn {
      padding: 10px 12px;
      border: 1px solid var(--retro-check-border);
      border-radius: var(--retro-radius-md);
      cursor: pointer;
      background: var(--retro-check-bg);
      text-align: left;
      font-family: inherit;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }
    .template-btn:hover {
      border-color: var(--retro-accent);
    }
    .template-btn.selected {
      border-color: color-mix(in srgb, var(--retro-accent) 50%, transparent);
      background: color-mix(in srgb, var(--retro-accent) 8%, transparent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--retro-accent) 12%, transparent);
    }
    .template-btn .t-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--retro-text-primary);
      margin-bottom: 2px;
    }
    .template-btn .t-cols {
      font-size: 11px;
      line-height: 1.3;
      color: var(--retro-text-muted);
    }
    .option-row {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid var(--retro-check-border);
      border-radius: var(--retro-radius-md);
      background: var(--retro-check-bg);
      cursor: pointer;
      user-select: none;
    }
    .option-row input[type='checkbox'] {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }
    .option-row:focus-within .check-box {
      outline: 2px solid color-mix(in srgb, var(--retro-accent) 55%, transparent);
      outline-offset: 2px;
    }
    .check-box {
      width: 18px;
      height: 18px;
      border-radius: 5px;
      border: 1px solid var(--retro-check-box-border);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--retro-accent-contrast);
      flex-shrink: 0;
      margin-top: 1px;
    }
    .check-box.on {
      background: var(--retro-accent);
      border-color: var(--retro-accent);
    }
    .option-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--retro-text-primary);
    }
    .option-label small {
      display: block;
      font-size: 11px;
      font-weight: 400;
      color: var(--retro-text-muted);
      margin-top: 2px;
    }
    .not-found-banner {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--retro-glass-bg-strong);
      border: 1.5px solid var(--retro-error);
      border-radius: var(--retro-radius-md);
      padding: 10px 16px;
      font-size: 13px;
      color: var(--retro-text-primary);
      white-space: nowrap;
      box-shadow: var(--retro-shadow-float);
      z-index: 10;
    }
    .not-found-banner .dismiss {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--retro-text-muted);
      font-size: 18px;
      line-height: 1;
      padding: 0;
    }
    .not-found-banner .dismiss:hover {
      color: var(--retro-text-primary);
    }
  `]

  private async createSession(): Promise<void> {
    const name = this.sessionName.trim()
    const yourName = this.yourName.trim() || 'Facilitator'
    if (!name) return

    this.loading = true
    this.error = ''

    try {
      const { columns, colors } = COLUMN_TEMPLATES[this.selectedTemplate]
      const columnColors = Object.fromEntries(columns.map((column, i) => [column, colors[i]]))
      const session = await api.createSession(name, yourName, columns, this.reactionsEnabled, this.openFacilitator, this.maxVotesPerParticipant, columnColors)
      storage.setFacilitatorToken(session.id, session.facilitator_token)
      storage.setName(session.id, yourName)
      storage.addOrUpdateHistory({
        id: session.id,
        name: session.name,
        phase: session.phase,
        created_at: session.created_at,
        participantName: yourName,
        isFacilitator: true,
        joinedAt: new Date().toISOString(),
      })
      window.router.navigate(`/session/${session.id}`)
    } catch {
      this.error = 'Failed to create session. Is the backend running?'
    } finally {
      this.loading = false
    }
  }

  private onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') void this.createSession()
  }

  private onBrandReset(): void {
    clearBrand()
  }

  private checkRow(label: string, sub: string, checked: boolean, onChange: (value: boolean) => void) {
    return html`
      <label class="option-row">
        <input
          type="checkbox"
          aria-label=${label}
          .checked=${checked}
          @change=${(e: Event) => onChange((e.target as HTMLInputElement).checked)}
          ?disabled=${this.loading}
        />
        <span class="check-box ${checked ? 'on' : ''}">${checked ? designIcon('check', 12) : nothing}</span>
        <span class="option-label">${label}<small>${sub}</small></span>
      </label>
    `
  }

  render() {
    const canCreate = !!this.sessionName.trim() && !this.loading

    return html`
      ${this.sessionNotFound ? html`
        <div class="not-found-banner">
          <span>Session not found — it may have expired or the link is broken.</span>
          <button class="dismiss" aria-label="dismiss" @click=${() => { this.sessionNotFound = false }}>×</button>
        </div>
      ` : ''}
      <session-history side="left" .open=${this.showHistory} @close=${() => { this.showHistory = false }}></session-history>
      <div class="page">
      <div class="corner">
        <button class="corner-btn history-toggle" @click=${() => { this.showHistory = true }} title="Your sessions" aria-label="Your sessions">${designIcon('history', 15)}</button>
        ${this.brand === 'cs'
          ? html`<button class="corner-btn brand-reset" @click=${this.onBrandReset} title="Reset to default theme" aria-label="Reset to default theme">${designIcon('settings', 15)}</button>`
          : html`<theme-menu></theme-menu>`}
      </div>
      <div class="hero">
        <div class="logo">${bacon()}</div>
        <div class="title">
          <h1>Retro<em>spekt</em></h1>
          <p class="tagline">A simple, self-hosted retrospective board</p>
        </div>

        <div class="card">
          <div class="field">
            <label class="field-label" for="session-name">Session name</label>
            <div class="field-body">
              <input
                id="session-name"
                type="text"
                placeholder="e.g. Sprint 42 Retro"
                .value=${this.sessionName}
                @input=${(e: Event) => {
                  this.sessionName = (e.target as HTMLInputElement).value
                }}
                @keydown=${this.onKeydown}
                ?disabled=${this.loading}
                autofocus
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="your-name">Your name</label>
            <div class="field-body">
              <input
                id="your-name"
                type="text"
                placeholder="e.g. Alice (facilitator)"
                .value=${this.yourName}
                @input=${(e: Event) => {
                  this.yourName = (e.target as HTMLInputElement).value
                }}
                @keydown=${this.onKeydown}
                ?disabled=${this.loading}
              />
            </div>
          </div>

          <div class="field">
            <span class="field-label">Column template</span>
            <div class="template-grid">
              ${COLUMN_TEMPLATES.map(
                (t, i) => html`
                  <button
                    class="template-btn ${this.selectedTemplate === i ? 'selected' : ''}"
                    @click=${() => {
                      this.selectedTemplate = i
                    }}
                    ?disabled=${this.loading}
                  >
                    <div class="t-label">${t.label}</div>
                    <div class="t-cols">${t.columns.join(' · ')}</div>
                  </button>
                `,
              )}
            </div>
          </div>

          <div class="field">
            <span class="field-label">Options</span>
            <div class="field-body">
              ${this.checkRow('Emoji reactions on cards', 'Participants can react to published cards with emoji', this.reactionsEnabled, (value) => { this.reactionsEnabled = value })}
              ${this.checkRow('Open facilitator mode', 'All participants can control the session (phase, timer, columns)', this.openFacilitator, (value) => { this.openFacilitator = value })}
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="max-votes">Max votes per participant</label>
            <div class="field-body">
              <input
                id="max-votes"
                class="narrow"
                type="number"
                aria-label="Max votes per participant"
                min="1"
                placeholder="Unlimited"
                .value=${this.maxVotesPerParticipant !== null ? String(this.maxVotesPerParticipant) : ''}
                @input=${(e: Event) => {
                  const v = (e.target as HTMLInputElement).value
                  this.maxVotesPerParticipant = v ? Math.max(1, parseInt(v, 10)) : null
                }}
                ?disabled=${this.loading}
              />
            </div>
          </div>

          ${this.error ? html`<p class="error-msg">${this.error}</p>` : ''}

          <button class="create-btn" @click=${this.createSession} ?disabled=${!canCreate}>
            ${this.loading ? 'Creating…' : 'Create session →'}
          </button>
        </div>

        <p class="footer">
          No account required &middot; Share the URL to collaborate &middot;
          <a href="https://github.com/stevendejongnl/retrospekt" target="_blank" rel="noopener noreferrer">GitHub</a>
          &middot;
          <a href="/privacy" @click=${(e: Event) => { e.preventDefault(); window.router.navigate('/privacy') }}>Privacy</a>
          &middot;
          <a class="stats-link" href="/stats" @click=${(e: Event) => { e.preventDefault(); window.router.navigate('/stats') }}>Stats</a>
          &middot; v${__APP_VERSION__}
        </p>
      </div>
      </div>
    `
  }
}
