import * as d3 from 'd3'
import { LitElement, PropertyValues, css, html, nothing } from 'lit'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import '../components/background-blobs'
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

  protected override updated(changedProps: PropertyValues): void {
    super.updated(changedProps)
    if (changedProps.has('adminStats') && this.adminStats) {
      if (this.adminStats.sentry) {
        this._renderSentryBarChart('#sentry-backend-error-chart', this.adminStats.sentry.error_rate_7d, 'danger')
        this._renderSentryBarChart('#sentry-backend-p95-chart', this.adminStats.sentry.p95_latency_7d, 'accent')
      }
      if (this.adminStats.sentry_frontend) {
        this._renderSentryBarChart('#sentry-frontend-error-chart', this.adminStats.sentry_frontend.error_rate_7d, 'danger')
        this._renderSentryBarChart('#sentry-frontend-p95-chart', this.adminStats.sentry_frontend.p95_latency_7d, 'accent')
      }
    }
  }

  private _renderSentryBarChart(id: string, data: SentryDataPoint[], colorVar: 'danger' | 'accent'): void {
    const el = this.shadowRoot!.querySelector<SVGSVGElement>(id)
    if (!el) return

    const svg = d3.select(el)
    svg.selectAll('*').remove()

    const filtered = data.filter((d) => d.value !== null)
    if (filtered.length === 0) return

    const margin = { top: 6, right: 10, bottom: 20, left: 36 }
    const svgW = 280
    const svgH = 100
    const width = svgW - margin.left - margin.right
    const height = svgH - margin.top - margin.bottom

    svg.attr('width', svgW).attr('height', svgH)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleBand().domain(data.map((d) => d.date)).range([0, width]).padding(0.15)
    const maxVal = d3.max(filtered, (d) => d.value as number) ?? 1
    const y = d3.scaleLinear().domain([0, maxVal]).nice().range([height, 0])

    const color =
      colorVar === 'danger'
        ? getComputedStyle(this).getPropertyValue('--retro-danger').trim() || '#ef4444'
        : getComputedStyle(this).getPropertyValue('--retro-accent').trim()

    g.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', (d) => x(d.date) as number)
      .attr('y', (d) => (d.value !== null ? y(d.value) : height))
      .attr('width', x.bandwidth())
      .attr('height', (d) => (d.value !== null ? height - y(d.value) : 0))
      .attr('fill', color)
      .attr('rx', 2)

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickValues([data[0]?.date, data[data.length - 1]?.date].filter(Boolean)))
      .attr('color', 'var(--retro-text-muted)')
      .attr('font-size', '9px')
      .select('.domain')
      .remove()

    g.append('g')
      .call(d3.axisLeft(y).ticks(3).tickSize(-width))
      .attr('color', 'var(--retro-border-default)')
      .attr('font-size', '9px')
      .select('.domain')
      .remove()
  }

  private _renderSentryHealth(label: string, health: SentryHealth | null | undefined, idPrefix: string) {
    if (!health) return nothing

    return html`
      <div class="sentry-block chart-block">
        <h3 class="chart-title">Sentry Health — ${label}</h3>

        ${health.error
          ? html`<p class="sentry-error-banner">${health.error}</p>`
          : html`
              <div class="stat-grid sentry-stat-grid">
                <div class="stat-card">
                  <span class="stat-value">${health.unresolved_count}</span>
                  <span class="stat-label">Unresolved Issues</span>
                </div>
              </div>

              ${health.top_issues.length > 0
                ? html`
                    <h4 class="chart-title" style="margin-top: 12px;">Top Issues</h4>
                    <ul class="sentry-issue-list">
                      ${health.top_issues.map(
                        (issue) => html`
                          <li class="sentry-issue-item">
                            <span class="sentry-issue-title">${issue.title}</span>
                            <span class="sentry-issue-meta">${issue.count} events</span>
                          </li>
                        `,
                      )}
                    </ul>
                  `
                : nothing}

              <div class="sentry-charts-row">
                <div>
                  <h4 class="chart-title" style="margin-top: 12px;">Error Rate (7d)</h4>
                  <svg id="${idPrefix}-error-chart" width="280" height="100" class="chart-svg"></svg>
                </div>
                <div>
                  <h4 class="chart-title" style="margin-top: 12px;">p95 Latency (7d, ms)</h4>
                  <svg id="${idPrefix}-p95-chart" width="280" height="100" class="chart-svg"></svg>
                </div>
              </div>
            `}
      </div>
    `
  }

  render() {
    return html`
      <background-blobs></background-blobs>
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
                  <p class="muted">Enter your admin password to continue.</p>
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
            ${this._renderSentryHealth('Backend', this.adminStats?.sentry, 'sentry-backend')}
            ${this._renderSentryHealth('Frontend', this.adminStats?.sentry_frontend, 'sentry-frontend')}
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
        max-width: 900px;
        margin: 0 auto;
        padding: 32px 24px 64px;
        position: relative;
        z-index: 1;
      }

      .page-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 32px;
      }

      .back-link {
        color: var(--retro-accent);
        text-decoration: none;
        font-size: 14px;
        white-space: nowrap;
      }
      .back-link:hover {
        text-decoration: underline;
      }

      .page-title {
        font-size: 24px;
        font-weight: 800;
        margin: 0;
        color: var(--retro-text-primary);
      }

      .section-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--retro-text-primary);
        margin: 0 0 12px;
      }

      .admin-unlock {
        background: var(--retro-glass-bg-medium);
        backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
        -webkit-backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
        border: 1px solid var(--retro-glass-border);
        border-radius: 14px;
        padding: 20px 24px;
        margin-bottom: 24px;
        box-shadow: var(--retro-glass-shadow);
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
        padding: 8px 12px;
        border: 1.5px solid var(--retro-border-default);
        border-radius: 8px;
        background: var(--retro-bg-page);
        color: var(--retro-text-primary);
        font-size: 14px;
        outline: none;
      }
      .password-input:focus {
        border-color: var(--retro-accent);
      }

      .unlock-btn {
        padding: 8px 20px;
        background: var(--retro-accent);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.12s;
        box-shadow: 0 4px 12px rgba(217, 116, 38, 0.25);
      }
      .unlock-btn:hover:not(:disabled) {
        opacity: 0.85;
      }
      .unlock-btn:disabled {
        opacity: 0.4;
        cursor: default;
      }

      .error-msg {
        margin: 8px 0 0;
        font-size: 13px;
        color: var(--retro-danger, #ef4444);
      }

      .admin-section {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .chart-block {
        background: var(--retro-glass-bg-medium);
        backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
        -webkit-backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
        border: 1px solid var(--retro-glass-border);
        border-radius: 14px;
        padding: 18px;
        box-shadow: var(--retro-glass-shadow);
      }

      .chart-title {
        font-size: 13px;
        font-weight: 700;
        color: var(--retro-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: 0 0 12px;
      }

      .chart-svg {
        display: block;
      }

      .stat-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 12px;
      }

      .sentry-block {
        margin-top: 0;
      }

      .sentry-stat-grid {
        grid-template-columns: auto;
        display: inline-grid;
        margin-bottom: 12px;
      }

      .stat-card {
        background: var(--retro-glass-bg-medium);
        border: 1px solid var(--retro-glass-border);
        border-radius: 14px;
        padding: 18px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }

      .stat-value {
        font-size: 32px;
        font-weight: 800;
        color: var(--retro-accent);
        line-height: 1;
      }

      .stat-label {
        font-size: 12px;
        color: var(--retro-text-muted);
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .sentry-issue-list {
        list-style: none;
        margin: 0 0 12px;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .sentry-issue-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        padding: 4px 8px;
        background: var(--retro-bg-page);
        border-radius: 6px;
      }

      .sentry-issue-title {
        color: var(--retro-text-primary);
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .sentry-issue-meta {
        color: var(--retro-text-muted);
        white-space: nowrap;
        font-size: 11px;
      }

      .sentry-charts-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-top: 4px;
      }

      @media (max-width: 640px) {
        .sentry-charts-row {
          grid-template-columns: 1fr;
        }
      }

      .sentry-error-banner {
        font-size: 13px;
        color: var(--retro-danger, #ef4444);
        background: color-mix(in srgb, var(--retro-danger, #ef4444) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--retro-danger, #ef4444) 30%, transparent);
        border-radius: 8px;
        padding: 8px 12px;
        margin: 0;
      }
    `,
  ]
}

declare global {
  interface HTMLElementTagNameMap {
    'admin-page': AdminPage
  }
}
