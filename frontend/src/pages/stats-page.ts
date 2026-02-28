import * as d3 from 'd3'
import { LitElement, PropertyValues, css, html, nothing } from 'lit'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import { faIconStyles } from '../icons'
import type { AdminStats, PublicStats } from '../types'

type AdminPhase = 'locked' | 'loading' | 'unlocked' | 'error'

const ADMIN_TOKEN_KEY = 'retro_admin_token'
const PHASE_COLORS: Record<string, string> = {
  collecting: '#6366f1',
  discussing: '#059669',
  closed: '#6b7280',
}

@customElement('stats-page')
export class StatsPage extends LitElement {
  @state() private stats: PublicStats | null = null
  @state() private adminStats: AdminStats | null = null
  @state() private adminPhase: AdminPhase = 'locked'
  @state() private password = ''
  @state() private loadingPublic = true
  @state() private loadError = ''
  @state() private adminToken = ''

  connectedCallback(): void {
    super.connectedCallback()
    const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY)
    if (saved) {
      this.adminToken = saved
      this.adminPhase = 'loading'
    }
    this._loadPublicStats()
  }

  private async _loadPublicStats(): Promise<void> {
    this.loadingPublic = true
    this.loadError = ''
    try {
      this.stats = await api.getPublicStats()
    } catch {
      this.loadError = 'Failed to load statistics.'
    } finally {
      this.loadingPublic = false
    }
    // If a saved token exists, kick off admin stats fetch once public stats are done
    if (this.adminToken && this.adminPhase === 'loading') {
      await this._loadAdminStats()
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

  protected override updated(changedProps: PropertyValues): void {
    super.updated(changedProps)
    if (changedProps.has('stats') && this.stats) {
      this._renderDonutChart()
      this._renderBarChart()
    }
    if (changedProps.has('adminStats') && this.adminStats) {
      this._renderAdminCharts()
    }
  }

  // ---------------------------------------------------------------------------
  // D3 charts — select elements via shadowRoot to pierce shadow DOM
  // ---------------------------------------------------------------------------

  private _renderDonutChart(): void {
    if (!this.stats || !this.shadowRoot) return
    const el = this.shadowRoot.querySelector<SVGSVGElement>('#donut-chart')
    if (!el) return

    const data = this.stats.sessions_by_phase
    const svg = d3.select(el)
    svg.selectAll('*').remove()

    if (data.length === 0) return

    const width = 200
    const height = 200
    const radius = Math.min(width, height) / 2 - 10

    type PieInput = { phase: string; count: number }
    const pieGen = d3.pie<PieInput>().value((d) => d.count)
    const arcGen = d3
      .arc<d3.PieArcDatum<PieInput>>()
      .innerRadius(radius * 0.5)
      .outerRadius(radius)

    const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`)

    g.selectAll('path')
      .data(pieGen(data))
      .enter()
      .append('path')
      .attr('d', arcGen)
      .attr('fill', (d) => PHASE_COLORS[d.data.phase] ?? '#9ca3af')
      .attr('stroke', 'var(--retro-bg-surface)')
      .attr('stroke-width', 2)

    // Legend
    const legend = svg
      .append('g')
      .attr('transform', `translate(4,${height - data.length * 16 - 4})`)

    data.forEach((d, i) => {
      const row = legend.append('g').attr('transform', `translate(0, ${i * 16})`)
      row
        .append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .attr('rx', 2)
        .attr('fill', PHASE_COLORS[d.phase] ?? '#9ca3af')
      row
        .append('text')
        .attr('x', 14)
        .attr('y', 9)
        .attr('font-size', '10px')
        .attr('fill', 'var(--retro-text-muted)')
        .text(`${d.phase} (${d.count})`)
    })
  }

  private _renderBarChart(): void {
    if (!this.stats || !this.shadowRoot) return
    const el = this.shadowRoot.querySelector<SVGSVGElement>('#bar-chart')
    if (!el) return

    const data = this.stats.sessions_per_day
    const svg = d3.select(el)
    svg.selectAll('*').remove()

    if (data.length === 0) return

    const margin = { top: 10, right: 10, bottom: 24, left: 28 }
    const svgW = el.getBoundingClientRect().width || 360
    const svgH = 160
    const width = svgW - margin.left - margin.right
    const height = svgH - margin.top - margin.bottom

    const g = svg
      .attr('height', svgH)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleBand().domain(data.map((d) => d.date)).range([0, width]).padding(0.1)

    const maxCount = d3.max(data, (d) => d.count) ?? 1
    const y = d3.scaleLinear().domain([0, maxCount]).nice().range([height, 0])

    const accent =
      getComputedStyle(this).getPropertyValue('--retro-accent').trim() || '#6366f1'

    g.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', (d) => x(d.date) ?? 0)
      .attr('y', (d) => y(d.count))
      .attr('width', x.bandwidth())
      .attr('height', (d) => height - y(d.count))
      .attr('fill', accent)
      .attr('rx', 2)

    // Y axis (minimal)
    g.append('g')
      .call(d3.axisLeft(y).ticks(3).tickSize(-width))
      .attr('color', 'var(--retro-border-default)')
      .select('.domain')
      .remove()
  }

  private _renderAdminCharts(): void {
    if (!this.adminStats || !this.shadowRoot) return
    this._renderReactionChart()
  }

  private _renderReactionChart(): void {
    if (!this.adminStats || !this.shadowRoot) return
    const el = this.shadowRoot.querySelector<SVGSVGElement>('#reaction-chart')
    if (!el) return

    const data = this.adminStats.reaction_breakdown
    const svg = d3.select(el)
    svg.selectAll('*').remove()

    if (data.length === 0) return

    const margin = { top: 4, right: 20, bottom: 4, left: 36 }
    const width = 260 - margin.left - margin.right
    const rowH = 28
    const height = data.length * rowH

    svg.attr('height', height + margin.top + margin.bottom)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) ?? 1])
      .range([0, width])

    const y = d3.scaleBand().domain(data.map((d) => d.emoji)).range([0, height]).padding(0.15)

    const accent =
      getComputedStyle(this).getPropertyValue('--retro-accent').trim() || '#6366f1'

    g.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('y', (d) => y(d.emoji) ?? 0)
      .attr('x', 0)
      .attr('height', y.bandwidth())
      .attr('width', (d) => x(d.count))
      .attr('fill', accent)
      .attr('rx', 2)

    g.selectAll<SVGTextElement, { emoji: string; count: number }>('text.emoji-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'emoji-label')
      .attr('x', -4)
      .attr('y', (d) => (y(d.emoji) ?? 0) + y.bandwidth() / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', '14px')
      .text((d) => d.emoji)
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  private _renderStatCard(label: string, value: string | number) {
    return html`
      <div class="stat-card">
        <span class="stat-value">${value}</span>
        <span class="stat-label">${label}</span>
      </div>
    `
  }

  private _renderAdminLockSection() {
    if (this.adminPhase === 'unlocked') return nothing

    return html`
      <section class="admin-unlock">
        <h2 class="section-title">Admin</h2>
        ${this.adminPhase === 'loading'
          ? html`<p class="muted">Loading…</p>`
          : html`
              <p class="muted">Enter your admin password to unlock deeper analytics.</p>
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
    `
  }

  private _renderAdminStats() {
    if (this.adminPhase !== 'unlocked' || !this.adminStats) return nothing

    const { engagement_funnel: f, reaction_breakdown, cards_per_column } = this.adminStats

    return html`
      <section class="admin-section">
        <h2 class="section-title">Admin Analytics</h2>

        <div class="admin-charts">
          <div class="chart-block">
            <h3 class="chart-title">Reaction Breakdown</h3>
            <svg id="reaction-chart" width="280" height="40" class="chart-svg"></svg>
          </div>

          <div class="chart-block">
            <h3 class="chart-title">Cards per Column</h3>
            <ul class="column-list">
              ${cards_per_column.map(
                (c) => html`<li class="column-item"><span>${c.column}</span><strong>${c.count}</strong></li>`,
              )}
            </ul>
          </div>
        </div>

        <div class="chart-block funnel-block">
          <h3 class="chart-title">Engagement Funnel</h3>
          <div class="funnel">
            ${(
              [
                ['Created', f.created],
                ['Has cards', f.has_cards],
                ['Has votes', f.has_votes],
                ['Closed', f.closed],
              ] as [string, number][]
            ).map(
              ([label, count]) => html`
                <div class="funnel-step">
                  <span class="funnel-label">${label}</span>
                  <span class="funnel-count">${count}</span>
                </div>
              `,
            )}
          </div>
        </div>

        <div class="reaction-raw">
          ${reaction_breakdown.map(
            (r) => html`<span class="reaction-chip">${r.emoji} ${r.count}</span>`,
          )}
        </div>
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
          <h1 class="page-title">Retrospekt Stats</h1>
        </header>

        ${this.loadingPublic
          ? html`<div class="loading">Loading statistics…</div>`
          : this.loadError
            ? html`<div class="error">${this.loadError}</div>`
            : html`
                <section class="stat-cards">
                  ${this._renderStatCard('Total Sessions', this.stats!.total_sessions)}
                  ${this._renderStatCard('Active Sessions', this.stats!.active_sessions)}
                  ${this._renderStatCard('Total Cards', this.stats!.total_cards)}
                  ${this._renderStatCard('Total Votes', this.stats!.total_votes)}
                </section>

                <section class="charts-row">
                  <div class="chart-block">
                    <h3 class="chart-title">Sessions by Phase</h3>
                    <svg id="donut-chart" width="200" height="200" class="chart-svg"></svg>
                  </div>
                  <div class="chart-block">
                    <h3 class="chart-title">Sessions per Day (last 30 days)</h3>
                    <svg id="bar-chart" width="100%" height="160" class="chart-svg bar-chart-svg"></svg>
                  </div>
                </section>

                ${this._renderAdminLockSection()} ${this._renderAdminStats()}
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
      }

      .page {
        max-width: 900px;
        margin: 0 auto;
        padding: 32px 24px 64px;
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

      .loading,
      .error {
        text-align: center;
        padding: 64px 24px;
        color: var(--retro-text-muted);
        font-size: 15px;
      }
      .error {
        color: var(--retro-danger, #ef4444);
      }

      /* --- Stat cards --- */
      .stat-cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 16px;
        margin-bottom: 32px;
      }

      .stat-card {
        background: var(--retro-bg-surface);
        border: 1.5px solid var(--retro-border-default);
        border-radius: 12px;
        padding: 20px 16px;
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

      /* --- Charts --- */
      .charts-row {
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 24px;
        margin-bottom: 32px;
        align-items: start;
      }

      @media (max-width: 640px) {
        .charts-row {
          grid-template-columns: 1fr;
        }
      }

      .chart-block {
        background: var(--retro-bg-surface);
        border: 1.5px solid var(--retro-border-default);
        border-radius: 12px;
        padding: 16px;
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

      .bar-chart-svg {
        width: 100%;
      }

      /* --- Admin unlock --- */
      .section-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--retro-text-primary);
        margin: 0 0 12px;
      }

      .admin-unlock {
        background: var(--retro-bg-surface);
        border: 1.5px solid var(--retro-border-default);
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 24px;
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
        font-weight: 700;
        cursor: pointer;
        transition: opacity 0.12s;
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

      /* --- Admin section --- */
      .admin-section {
        background: var(--retro-bg-surface);
        border: 1.5px solid var(--retro-border-default);
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 24px;
      }

      .admin-charts {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        margin-bottom: 24px;
      }

      @media (max-width: 640px) {
        .admin-charts {
          grid-template-columns: 1fr;
        }
      }

      .funnel-block {
        margin-bottom: 16px;
      }

      .funnel {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .funnel-step {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: var(--retro-bg-page);
        border-radius: 8px;
        font-size: 14px;
      }

      .funnel-label {
        color: var(--retro-text-muted);
      }

      .funnel-count {
        font-weight: 700;
        color: var(--retro-accent);
      }

      .column-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .column-item {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        padding: 4px 0;
        border-bottom: 1px solid var(--retro-border-default);
        color: var(--retro-text-muted);
      }

      .column-item strong {
        color: var(--retro-text-primary);
      }

      .reaction-raw {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
      }

      .reaction-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: var(--retro-bg-page);
        border: 1px solid var(--retro-border-default);
        border-radius: 20px;
        font-size: 13px;
        color: var(--retro-text-primary);
      }
    `,
  ]
}
