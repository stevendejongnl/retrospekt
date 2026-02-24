import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import { storage } from '../storage'
import { getEffectiveTheme, toggleTheme } from '../theme'

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

  private _themeListener!: EventListener

  connectedCallback(): void {
    super.connectedCallback()
    this._themeListener = () => {
      this.isDark = getEffectiveTheme() === 'dark'
    }
    window.addEventListener('retro-theme-change', this._themeListener)
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    window.removeEventListener('retro-theme-change', this._themeListener)
  }

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(160deg, var(--retro-bg-page) 0%, var(--retro-accent-tint) 100%);
      padding: 24px;
      position: relative;
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
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s, border-color 0.12s;
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
  `

  private async createSession(): Promise<void> {
    const name = this.sessionName.trim()
    const yourName = this.yourName.trim() || 'Facilitator'
    if (!name) return

    this.loading = true
    this.error = ''

    try {
      const columns = COLUMN_TEMPLATES[this.selectedTemplate].columns
      const session = await api.createSession(name, yourName, columns)
      storage.setFacilitatorToken(session.id, session.facilitator_token)
      storage.setName(session.id, yourName)
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

  render() {
    const canCreate = !!this.sessionName.trim() && !this.loading

    return html`
      <button class="theme-toggle" @click=${this.onThemeToggle}>${this.isDark ? '☀️' : '🌙'}</button>
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

          ${this.error ? html`<p class="error-msg">${this.error}</p>` : ''}

          <button class="create-btn" @click=${this.createSession} ?disabled=${!canCreate}>
            ${this.loading ? 'Creating…' : 'Create session →'}
          </button>
        </div>

        <p class="footer">No account required &middot; Share the URL to collaborate</p>
      </div>
    `
  }
}
