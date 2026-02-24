import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import { storage } from '../storage'

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

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(160deg, #faf9f7 0%, #fff3e8 100%);
      padding: 24px;
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
      color: #111;
      letter-spacing: -2px;
      line-height: 1;
      margin-bottom: 10px;
    }
    h1 em {
      font-style: normal;
      color: #e85d04;
    }
    .tagline {
      font-size: 16px;
      color: #888;
      margin-bottom: 36px;
    }
    .card {
      background: white;
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 4px 32px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04);
    }
    .field {
      margin-bottom: 16px;
      text-align: left;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #555;
      margin-bottom: 6px;
      letter-spacing: 0.2px;
    }
    input {
      width: 100%;
      padding: 12px 16px;
      border: 1.5px solid #e8e8e8;
      border-radius: 10px;
      font-size: 15px;
      font-family: inherit;
      color: #111;
      box-sizing: border-box;
      transition: border-color 0.12s;
      background: #fafafa;
    }
    input:focus {
      outline: none;
      border-color: #e85d04;
      background: white;
    }
    input::placeholder {
      color: #bbb;
    }
    input:disabled {
      opacity: 0.6;
    }
    .create-btn {
      width: 100%;
      margin-top: 8px;
      padding: 14px;
      background: #e85d04;
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
      background: #c44e00;
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
      color: #ef4444;
      text-align: center;
    }
    .footer {
      margin-top: 28px;
      font-size: 13px;
      color: #ccc;
    }
    .footer a {
      color: #e85d04;
      text-decoration: none;
    }
    .template-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .template-btn {
      padding: 10px 12px;
      border: 1.5px solid #e8e8e8;
      border-radius: 10px;
      cursor: pointer;
      background: #fafafa;
      text-align: left;
      font-family: inherit;
      transition: border-color 0.12s, background 0.12s;
    }
    .template-btn:hover {
      border-color: #e85d04;
      background: #fff8f3;
    }
    .template-btn.selected {
      border-color: #e85d04;
      background: #fff3e8;
    }
    .template-btn .t-label {
      font-size: 12px;
      font-weight: 700;
      color: #333;
      margin-bottom: 3px;
    }
    .template-btn .t-cols {
      font-size: 11px;
      color: #999;
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

  render() {
    const canCreate = !!this.sessionName.trim() && !this.loading

    return html`
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
                    @click=${() => { this.selectedTemplate = i }}
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
