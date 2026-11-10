import { LitElement, css, html, nothing, svg } from 'lit'
import { baseStyles } from '../styles'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import '../components/feedback-panel'
import { faIconStyles } from '../icons'
import type { AdminStats, SentryDataPoint, SentryHealth } from '../types'

type AdminPhase = 'locked' | 'loading' | 'unlocked' | 'error'

const ADMIN_TOKEN_KEY = 'retro_admin_token'

@customElement('admin-page')
export class AdminPage extends LitElement {
  @state() private adminStats: AdminStats | null = null
  @state() private adminPhase: AdminPhase = 'locked'
  @state() private password = ''
  @state() private adminToken = ''

  connectedCallback(): void {
    super.connectedCallback()
    const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY)
    if (saved) {
      this.adminToken = saved
      this.adminPhase = 'loading'
      this._loadAdminStats()
    }
  }

  private async _loadAdminStats(): Promise<void> {
    try {
      this.adminStats = await api.getAdminStats(this.adminToken)
      this.adminPhase = 'unlocked'
    } catch (e) {
      if (e instanceof Error && e.message.includes('401')) {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY)
        this.adminToken = ''
        this.adminPhase = 'locked'
      } else {
        this.adminPhase = 'error'
      }
    }
  }

  private async _handleAuth(): Promise<void> {
    this.adminPhase = 'loading'
    try {
      const result = await api.adminAuth(this.password)
      sessionStorage.setItem(ADMIN_TOKEN_KEY, result.token)
      this.adminToken = result.token
      await this._loadAdminStats()
    } catch {
      this.adminPhase = 'error'
    }
  }

  private async _handleIgnoreFeedback(e: CustomEvent<{ id: string }>): Promise<void> {
    if (!this.adminStats) return
    const id = e.detail.id
    await api.patchFeedback(id, 'ignored', this.adminToken)
    this.adminStats = {
      ...this.adminStats,
      feedback: {
        ...this.adminStats.feedback,
        recent: this.adminStats.feedback.recent.map((entry) =>
          entry.id === id ? { ...entry, status: 'ignored' as const } : entry,
        ),
      },
    }
  }

  private _mean(points: SentryDataPoint[]): number | null {
    const values = points.map((p) => p.value).filter((v): v is number => v !== null)
    return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length
  }

  private _sparkline(points: SentryDataPoint[]) {
    const values = points.map((p) => p.value ?? 0)
    if (values.length < 2) return nothing
    const max = Math.max(...values) || 1
    const coords = values.map((v, i) => `${(i / (values.length - 1)) * 120},${34 - (v / max) * 30}`).join(' ')
    return html`
      <svg class="sparkline" width="120" height="34" viewBox="0 0 120 34" aria-hidden="true">
        ${svg`<polyline points=${coords} fill="none" stroke="var(--retro-timer-ok)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`}
      </svg>
    `
  }

  private _renderSentryHealth(label: string, health: SentryHealth | null | undefined, idPrefix: string) {
    if (!health) return nothing
    const rate = this._mean(health.error_rate_7d)
    const latency = this._mean(health.p95_latency_7d)

    return html`
      <section class="panel sentry-block" id=${idPrefix}>
        <div class="eyebrow">${label} health</div>

        ${health.error
          ? html`<p class="sentry-error-banner">${health.error}</p>`
          : html`
              <div class="metrics">
                <div>
                  <div class="metric-value">${rate === null ? '–' : `${rate.toFixed(1)}%`}</div>
                  <div class="eyebrow">Error rate 7d</div>
                  <div class="sparkline-slot">${this._sparkline(health.error_rate_7d)}</div>
                </div>
                <div>
                  <div class="metric-value">${latency === null ? '–' : `${Math.round(latency)} ms`}</div>
                  <div class="eyebrow">p95 latency 7d</div>
                </div>
              </div>

              <div class="eyebrow issues-title">Unresolved issues</div>
              ${health.top_issues.length > 0
                ? html`
                    <ul class="sentry-issue-list">
                      ${health.top_issues.map(
                        (issue) => html`
                          <li class="sentry-issue-item">
                            <span class="sentry-issue-title">${issue.title}</span>
                            <span class="sentry-issue-meta">${issue.count}×</span>
                          </li>
                        `,
                      )}
                    </ul>
                  `
                : html`<p class="muted">No unresolved issues.</p>`}
            `}
      </section>
    `
  }

  render() {
    return html`
      <div class="page">
        <header class="page-header">
          <a
            href="/"
            class="back-link"
            @click=${(e: Event) => {
              e.preventDefault()
              window.router.navigate('/')
            }}
          >
            ← Back
          </a>
          <h1 class="page-title">Admin</h1>
        </header>

        ${this.adminPhase !== 'unlocked' ? html`
          <section class="admin-unlock">
            ${this.adminPhase === 'loading'
              ? html`<p class="muted">Loading…</p>`
              : html`
                  <h3 class="unlock-title">Unlock admin</h3>
                  <p class="unlock-copy">Enter your admin password to see service health and feedback comments.</p>
                  <div class="unlock-form">
                    <input
                      type="password"
                      class="password-input"
                      placeholder="Admin password"
                      .value=${this.password}
                      @input=${(e: Event) => {
                        this.password = (e.target as HTMLInputElement).value
                      }}
                      @keydown=${(e: KeyboardEvent) => {
                        if (e.key === 'Enter') this._handleAuth()
                      }}
                    />
                    <button
                      class="unlock-btn"
                      ?disabled=${!this.password}
                      @click=${this._handleAuth}
                    >
                      Unlock
                    </button>
                  </div>
                  ${this.adminPhase === 'error'
                    ? html`<p class="error-msg">Invalid password. Please try again.</p>`
                    : nothing}
                `}
          </section>
        ` : html`
          <section class="admin-section">
            <div class="health-row">
              ${this._renderSentryHealth('Backend', this.adminStats?.sentry, 'sentry-backend')}
              ${this._renderSentryHealth('Frontend', this.adminStats?.sentry_frontend, 'sentry-frontend')}
            </div>
            ${this.adminStats
              ? html`<feedback-panel
                  .feedback=${this.adminStats.feedback}
                  .adminToken=${this.adminToken}
                  @ignore-feedback=${this._handleIgnoreFeedback}
                ></feedback-panel>`
              : nothing}
          </section>
        `}
      </div>
    `
  }

  static styles = [
    baseStyles,
    faIconStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--retro-bg-page);
        color: var(--retro-text-primary);
        font-family: inherit;
        position: relative;
        overflow: hidden;
      }

      .page {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px 80px 64px;
        position: relative;
        z-index: 1;
      }

      .page-header {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 16px;
      }

      .back-link {
        color: var(--retro-accent-ink);
        text-decoration: none;
        font-size: 13px;
        white-space: nowrap;
      }
      .back-link:hover {
        text-decoration: underline;
      }

      .page-title {
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.02em;
        margin: 0;
        color: var(--retro-text-primary);
      }


      .admin-unlock {
        background: var(--retro-glass-bg-medium);
        backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
        -webkit-backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
        border: 1px solid var(--retro-glass-border);
        border-radius: var(--retro-radius-md);
        padding: 22px;
        margin-bottom: 24px;
        max-width: 520px;
        box-shadow: var(--retro-glass-shadow);
      }

      .unlock-title {
        font-size: 15px;
        font-weight: 700;
        letter-spacing: -0.01em;
        margin: 0 0 4px;
        color: var(--retro-text-primary);
      }

      .unlock-copy {
        font-size: 12px;
        margin: 0 0 14px;
        color: var(--retro-text-secondary);
      }

      @media (max-width: 720px) {
        .page {
          padding: 24px 16px 48px;
        }
      }

      .muted {
        color: var(--retro-text-muted);
        font-size: 14px;
        margin: 0 0 16px;
      }

      .unlock-form {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .password-input {
        flex: 1;
        min-width: 180px;
        padding: 10px 12px;
        border: 1px solid var(--retro-border-default);
        border-radius: var(--retro-radius-md);
        background: var(--retro-bg-surface);
        color: var(--retro-text-primary);
        font-family: inherit;
        font-size: 14px;
        outline: none;
      }
      .password-input::placeholder {
        color: var(--retro-text-muted);
      }
      .password-input:focus {
        border-color: var(--retro-accent);
      }

      .unlock-btn {
        padding: 9px 18px;
        background: var(--retro-accent);
        color: var(--retro-accent-contrast);
        border: 1px solid var(--retro-accent-border);
        border-radius: var(--retro-radius-sm);
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.12s;
      }
      .unlock-btn:hover:not(:disabled) {
        opacity: 0.85;
      }
      .unlock-btn:disabled {
        cursor: default;
      }

      .error-msg {
        margin: 8px 0 0;
        font-size: 13px;
        color: var(--retro-danger, #ef4444);
      }
















      @media (max-width: 640px) {
        .sentry-charts-row {
          grid-template-columns: 1fr;
        }
      }


      .admin-section {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .health-row {
        display: flex;
        gap: 12px;
      }
      .panel {
        flex: 1;
        padding: 18px;
        background: var(--retro-bg-surface);
        border: 1px solid var(--retro-border-default);
        border-radius: var(--retro-radius-md);
        box-shadow: var(--retro-glass-shadow);
        min-width: 0;
      }
      .eyebrow {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--retro-text-muted);
      }
      .panel > .eyebrow:first-child {
        margin-bottom: 12px;
      }
      .metrics {
        display: flex;
        gap: 22px;
        margin-bottom: 14px;
      }
      .metric-value {
        font-size: 24px;
        font-weight: 800;
        color: var(--retro-text-primary);
      }
      .sparkline-slot {
        margin-top: 6px;
      }
      .issues-title {
        margin-bottom: 6px;
      }
      .sentry-issue-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .sentry-issue-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: var(--retro-radius-sm);
        background: var(--retro-bg-subtle);
        border: 1px solid var(--retro-border-default);
        font-size: 12px;
      }
      .sentry-issue-title {
        flex: 1;
        color: var(--retro-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sentry-issue-meta {
        color: var(--retro-text-muted);
      }
      .sentry-error-banner {
        font-size: 12px;
        color: var(--retro-error-ink);
      }
    `,
  ]
}

declare global {
  interface HTMLElementTagNameMap {
    'admin-page': AdminPage
  }
}
