import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import { storage } from '../storage'
import { getEffectiveTheme, toggleTheme, getBrand, clearBrand } from '../theme'
import { faIconStyles, iconSun, iconMoon, iconClockRotateLeft, iconRotateLeft } from '../icons'
import '../components/session-history'

const COLUMN_TEMPLATES = [
  { label: 'Standard', columns: ['Went Well', 'To Improve', 'Action Items'] },
  { label: 'Mad · Sad · Glad', columns: ['Mad', 'Sad', 'Glad'] },
  { label: 'Start · Stop · Continue', columns: ['Start', 'Stop', 'Continue'] },
  { label: '4Ls', columns: ['Liked', 'Learned', 'Lacked', 'Longed for'] },
]

@customElement('home-page')
export class HomePage extends LitElement {
  @state() private sessionName = ''
  @state() private yourName = ''
  @state() private loading = false
  @state() private error = ''
  @state() private selectedTemplate = 0
  @state() private isDark = getEffectiveTheme() === 'dark'
  @state() private brand = getBrand()
  @state() private showHistory = false
  @state() private reactionsEnabled = true
  @state() private sessionNotFound = false

  private _themeListener!: EventListener
  private _brandListener!: EventListener

  connectedCallback(): void {
    super.connectedCallback()
    this._themeListener = () => {
      this.isDark = getEffectiveTheme() === 'dark'
    }
    this._brandListener = () => {
      this.brand = getBrand()
    }
    window.addEventListener('retro-theme-change', this._themeListener)
    window.addEventListener('retro-brand-change', this._brandListener)
    const params = new URLSearchParams(window.location.search)
    if (params.has('session_not_found')) {
      this.sessionNotFound = true
      history.replaceState(null, '', '/')
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    window.removeEventListener('retro-theme-change', this._themeListener)
    window.removeEventListener('retro-brand-change', this._brandListener)
  }

  static styles = [faIconStyles, css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(160deg, var(--retro-bg-page) 0%, var(--retro-accent-tint) 100%);
      padding: 24px;
      position: relative;
    }
    .history-toggle {
      position: absolute;
      top: 16px;
      left: 16px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--retro-bg-surface);
      border: 1.5px solid var(--retro-border-default);
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s, border-color 0.12s;
      z-index: 1;
    }
    .history-toggle:hover {
      border-color: var(--retro-accent);
      background: var(--retro-accent-tint);
      color: var(--retro-accent);
    }
    .theme-toggle {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--retro-bg-surface);
      border: 1.5px solid var(--retro-border-default);
      color: var(--retro-text-primary);
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s, border-color 0.12s;
      z-index: 1;
    }
    .brand-reset {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--retro-bg-surface);
      border: 1.5px solid var(--retro-border-default);
      color: var(--retro-text-primary);
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s, border-color 0.12s;
      z-index: 1;
    }
    .brand-reset:hover {
      border-color: var(--retro-accent);
      background: var(--retro-accent-tint);
    }
    .theme-toggle:hover {
      border-color: var(--retro-accent);
      background: var(--retro-accent-tint);
    }
    .hero {
      width: 100%;
      max-width: 460px;
      text-align: center;
    }
    .logo {
      font-size: 72px;
      line-height: 1;
      margin-bottom: 12px;
      filter: drop-shadow(0 4px 8px rgba(232, 93, 4, 0.2));
    }
    h1 {
      font-size: 44px;
      font-weight: 900;
      color: var(--retro-text-primary);
      letter-spacing: -2px;
      line-height: 1;
      margin-bottom: 10px;
    }
    h1 em {
      font-style: normal;
      color: var(--retro-accent);
    }
    .tagline {
      font-size: 16px;
      color: var(--retro-text-muted);
      margin-bottom: 36px;
    }
    .card {
      background: var(--retro-bg-surface);
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 4px 32px var(--retro-card-shadow), 0 1px 4px var(--retro-card-shadow);
    }
    .field {
      margin-bottom: 16px;
      text-align: left;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--retro-text-secondary);
      margin-bottom: 6px;
      letter-spacing: 0.2px;
    }
    input {
      width: 100%;
      padding: 12px 16px;
      border: 1.5px solid var(--retro-border-default);
      border-radius: 10px;
      font-size: 15px;
      font-family: inherit;
      color: var(--retro-text-primary);
      box-sizing: border-box;
      transition: border-color 0.12s;
      background: var(--retro-bg-subtle);
    }
    input:focus {
      outline: none;
      border-color: var(--retro-accent);
      background: var(--retro-bg-surface);
    }
    input::placeholder {
      color: var(--retro-text-disabled);
    }
    input:disabled {
      opacity: 0.6;
    }
    .create-btn {
      width: 100%;
      margin-top: 8px;
      padding: 14px;
      background: var(--retro-accent);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s, transform 0.1s;
      letter-spacing: 0.1px;
    }
    .create-btn:hover:not(:disabled) {
      background: var(--retro-accent-hover);
    }
    .create-btn:active:not(:disabled) {
      transform: scale(0.99);
    }
    .create-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .error-msg {
      margin-top: 10px;
      font-size: 13px;
      color: var(--retro-error);
      text-align: center;
    }
    .footer {
      margin-top: 28px;
      font-size: 13px;
      color: var(--retro-text-disabled);
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
      border: 1.5px solid var(--retro-border-default);
      border-radius: 10px;
      cursor: pointer;
      background: var(--retro-bg-subtle);
      text-align: left;
      font-family: inherit;
      transition: border-color 0.12s, background 0.12s;
    }
    .template-btn:hover {
      border-color: var(--retro-accent);
      background: var(--retro-accent-tint);
    }
    .template-btn.selected {
      border-color: var(--retro-accent);
      background: var(--retro-accent-tint);
    }
    .template-btn .t-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--retro-text-secondary);
      margin-bottom: 3px;
    }
    .template-btn .t-cols {
      font-size: 11px;
      color: var(--retro-text-muted);
    }
    .option-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border: 1.5px solid var(--retro-border-default);
      border-radius: 10px;
      cursor: pointer;
      background: var(--retro-bg-subtle);
      transition: border-color 0.12s, background 0.12s;
      user-select: none;
    }
    .option-row:hover {
      border-color: var(--retro-accent);
      background: var(--retro-accent-tint);
    }
    .option-row input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: var(--retro-accent);
      cursor: pointer;
      flex-shrink: 0;
      margin: 0;
      padding: 0;
      border: none;
    }
    .option-label {
      font-size: 13px;
      color: var(--retro-text-primary);
      font-weight: 500;
      line-height: 1.4;
    }
    .option-label small {
      display: block;
      font-size: 11px;
      font-weight: 400;
      color: var(--retro-text-muted);
      margin-top: 1px;
    }
    .not-found-banner {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--retro-bg-surface);
      border: 1.5px solid var(--retro-error);
      border-radius: 10px;
      padding: 10px 16px;
      font-size: 13px;
      color: var(--retro-text-primary);
      white-space: nowrap;
      box-shadow: 0 2px 8px var(--retro-card-shadow);
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
      const columns = COLUMN_TEMPLATES[this.selectedTemplate].columns
      const session = await api.createSession(name, yourName, columns, this.reactionsEnabled)
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

  private onThemeToggle(): void {
    toggleTheme()
  }

  private onBrandReset(): void {
    clearBrand()
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
      <session-history .open=${this.showHistory} @close=${() => { this.showHistory = false }}></session-history>
      <button class="history-toggle" @click=${() => { this.showHistory = true }} title="Your sessions">${iconClockRotateLeft()}</button>
      ${this.brand === 'cs'
        ? html`<button class="brand-reset" @click=${this.onBrandReset} title="Reset to default theme">${iconRotateLeft()}</button>`
        : html`<button class="theme-toggle" @click=${this.onThemeToggle}>${this.isDark ? iconSun() : iconMoon()}</button>`}
      <div class="hero">
        <div class="logo">🥓</div>
        <h1>Retro<em>spekt</em></h1>
        <p class="tagline">A simple, self-hosted retrospective board</p>

        <div class="card">
          <div class="field">
            <label for="session-name">Session name</label>
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
          <div class="field">
            <label for="your-name">Your name</label>
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

          <div class="field">
            <label>Column template</label>
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
            <label>Options</label>
            <label class="option-row">
              <input
                type="checkbox"
                .checked=${this.reactionsEnabled}
                @change=${(e: Event) => { this.reactionsEnabled = (e.target as HTMLInputElement).checked }}
                ?disabled=${this.loading}
              />
              <span class="option-label">
                Emoji reactions on cards
                <small>Participants can react to published cards with emoji</small>
              </span>
            </label>
          </div>

          ${this.error ? html`<p class="error-msg">${this.error}</p>` : ''}

          <button class="create-btn" @click=${this.createSession} ?disabled=${!canCreate}>
            ${this.loading ? 'Creating…' : 'Create session →'}
          </button>
        </div>

        <p class="footer">
          No account required &middot; Share the URL to collaborate &middot;
          <a href="https://github.com/stevendejongnl/retrospekt" target="_blank" rel="noopener noreferrer">GitHub</a>
          &middot; v${__APP_VERSION__}
        </p>
      </div>
    `
  }
}
