import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import { storage } from '../storage'
import { getEffectiveTheme, toggleTheme, getBrand, clearBrand } from '../theme'
import { faIconStyles, iconSun, iconMoon, iconClockRotateLeft, iconRotateLeft } from '../icons'
import '../components/session-history'
import '../components/background-blobs'

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
  @state() private openFacilitator = false
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
      background: var(--retro-bg-page);
      padding: 24px;
      position: relative;
      overflow: hidden;
    }
    .history-toggle {
      position: absolute;
      top: 16px;
      left: 16px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--retro-glass-bg-medium);
      backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s, border-color 0.12s;
      z-index: 2;
      color: var(--retro-text-secondary);
    }
    .history-toggle:hover {
      border-color: var(--retro-accent);
      color: var(--retro-accent);
    }
    .theme-toggle {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--retro-glass-bg-medium);
      backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      color: var(--retro-text-secondary);
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s, border-color 0.12s;
      z-index: 2;
    }
    .brand-reset {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--retro-glass-bg-medium);
      backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      color: var(--retro-text-secondary);
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s, border-color 0.12s;
      z-index: 2;
    }
    .brand-reset:hover {
      border-color: var(--retro-accent);
    }
    .theme-toggle:hover {
      border-color: var(--retro-accent);
    }
    .hero {
      width: 100%;
      max-width: 460px;
      text-align: center;
      position: relative;
      z-index: 1;
    }
    .logo {
      font-size: 72px;
      line-height: 1;
      margin-bottom: 12px;
      filter: drop-shadow(0 8px 24px rgba(217, 116, 38, 0.35));
    }
    h1 {
      font-size: 44px;
      font-weight: 800;
      color: var(--retro-text-primary);
      letter-spacing: -0.025em;
      line-height: 1;
      margin-bottom: 10px;
    }
    h1 em {
      font-style: normal;
      color: var(--retro-accent);
    }
    .tagline {
      font-size: 15px;
      color: var(--retro-text-secondary);
      margin-bottom: 28px;
    }
    .card {
      background: var(--retro-glass-bg-strong);
      backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: 18px;
      padding: 24px;
      box-shadow: var(--retro-glass-shadow);
    }
    .field {
      margin-bottom: 16px;
      text-align: left;
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--retro-text-primary);
      margin-bottom: 6px;
      letter-spacing: 0.2px;
    }
    input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--retro-border-default);
      border-radius: 10px;
      font-size: 14px;
      font-family: inherit;
      color: var(--retro-text-primary);
      box-sizing: border-box;
      transition: border-color 0.12s, box-shadow 0.12s;
      background: rgba(255, 255, 255, 0.5);
    }
    input:focus {
      outline: none;
      border-color: var(--retro-accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--retro-accent) 12%, transparent);
      background: rgba(255, 255, 255, 0.7);
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
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s, transform 0.1s;
      letter-spacing: 0.1px;
      box-shadow: 0 4px 16px rgba(217, 116, 38, 0.35);
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
      margin-top: 20px;
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
      border: 1px solid var(--retro-border-default);
      border-radius: 10px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.55);
      text-align: left;
      font-family: inherit;
      transition: border-color 0.12s, background 0.12s, box-shadow 0.12s;
    }
    .template-btn:hover {
      border-color: var(--retro-accent);
      background: color-mix(in srgb, var(--retro-accent) 8%, rgba(255,255,255,0.7));
    }
    .template-btn.selected {
      border-color: var(--retro-accent);
      background: color-mix(in srgb, var(--retro-accent) 8%, rgba(255,255,255,0.7));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--retro-accent) 12%, transparent);
    }
    .template-btn .t-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--retro-text-primary);
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
      padding: 10px 12px;
      border: 1px solid var(--retro-border-default);
      border-radius: 10px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.55);
      transition: border-color 0.12s, background 0.12s;
      user-select: none;
    }
    .option-row:hover {
      border-color: var(--retro-accent);
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
      font-weight: 600;
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
      background: var(--retro-glass-bg-strong);
      backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      border: 1.5px solid var(--retro-error);
      border-radius: 10px;
      padding: 10px 16px;
      font-size: 13px;
      color: var(--retro-text-primary);
      white-space: nowrap;
      box-shadow: var(--retro-glass-shadow);
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
      const session = await api.createSession(name, yourName, columns, this.reactionsEnabled, this.openFacilitator)
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
      <background-blobs></background-blobs>
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
                aria-label="Emoji reactions on cards"
                .checked=${this.reactionsEnabled}
                @change=${(e: Event) => { this.reactionsEnabled = (e.target as HTMLInputElement).checked }}
                ?disabled=${this.loading}
              />
              <span class="option-label">
                Emoji reactions on cards
                <small>Participants can react to published cards with emoji</small>
              </span>
            </label>
            <label class="option-row" style="margin-top:8px">
              <input
                type="checkbox"
                aria-label="Open facilitator mode"
                .checked=${this.openFacilitator}
                @change=${(e: Event) => { this.openFacilitator = (e.target as HTMLInputElement).checked }}
                ?disabled=${this.loading}
              />
              <span class="option-label">
                Open facilitator mode
                <small>All participants can control the session (phase, timer, columns)</small>
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
