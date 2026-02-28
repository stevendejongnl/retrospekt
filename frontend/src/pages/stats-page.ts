import * as d3 from 'd3'
import { LitElement, PropertyValues, css, html, nothing } from 'lit'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import { faIconStyles } from '../icons'
import type { AdminStats, LifetimeBucket, PublicStats, SentryDataPoint } from '../types'

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
    const data = this.stats!.sessions_by_phase
    const el = this.shadowRoot!.querySelector<SVGSVGElement>('#donut-chart')!
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
    const data = this.stats!.sessions_per_day
    const el = this.shadowRoot!.querySelector<SVGSVGElement>('#bar-chart')!
    const svg = d3.select(el)
    svg.selectAll('*').remove()

    if (data.length === 0) return

    const margin = { top: 10, right: 10, bottom: 24, left: 28 }
    const svgW = Math.max(el.getBoundingClientRect().width, 360)
    const svgH = 160
    const width = svgW - margin.left - margin.right
    const height = svgH - margin.top - margin.bottom

    const g = svg
      .attr('height', svgH)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleBand().domain(data.map((d) => d.date)).range([0, width]).padding(0.1)

    const maxCount = d3.max(data, (d) => d.count) as number
    const y = d3.scaleLinear().domain([0, maxCount]).nice().range([height, 0])

    const accent = getComputedStyle(this).getPropertyValue('--retro-accent').trim()

    g.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', (d) => x(d.date) as number)
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
    this._renderReactionChart()
    this._renderLifetimeChart()
    if (this.adminStats?.sentry) {
      this._renderSentryBarChart('#sentry-error-chart', this.adminStats.sentry.error_rate_7d, 'danger')
      this._renderSentryBarChart('#sentry-p95-chart', this.adminStats.sentry.p95_latency_7d, 'accent')
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

  private _renderReactionChart(): void {
    const data = this.adminStats!.reaction_breakdown
    const el = this.shadowRoot!.querySelector<SVGSVGElement>('#reaction-chart')!
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
      .domain([0, d3.max(data, (d) => d.count) as number])
      .range([0, width])

    const y = d3.scaleBand().domain(data.map((d) => d.emoji)).range([0, height]).padding(0.15)

    const accent = getComputedStyle(this).getPropertyValue('--retro-accent').trim()

    g.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('y', (d) => y(d.emoji) as number)
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
      .attr('y', (d) => (y(d.emoji) as number) + y.bandwidth() / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', '14px')
      .text((d) => d.emoji)
  }

  private _renderLifetimeChart(): void {
    const data = this.adminStats!.session_lifetime.lifetime_distribution
    const el = this.shadowRoot!.querySelector<SVGSVGElement>('#lifetime-chart')
    if (!el) return

    const svg = d3.select(el)
    svg.selectAll('*').remove()

    const margin = { top: 4, right: 20, bottom: 4, left: 52 }
    const width = 260 - margin.left - margin.right
    const rowH = 28
    const height = data.length * rowH

    svg.attr('height', height + margin.top + margin.bottom)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const maxCount = d3.max(data, (d) => d.count) ?? 1
    const x = d3.scaleLinear().domain([0, maxCount]).range([0, width])
    const y = d3
      .scaleBand()
      .domain(data.map((d: LifetimeBucket) => d.label))
      .range([0, height])
      .padding(0.15)

    const accent = getComputedStyle(this).getPropertyValue('--retro-accent').trim()

    g.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('y', (d: LifetimeBucket) => y(d.label) as number)
      .attr('x', 0)
      .attr('height', y.bandwidth())
      .attr('width', (d: LifetimeBucket) => x(d.count))
      .attr('fill', accent)
      .attr('rx', 2)

    g.selectAll<SVGTextElement, LifetimeBucket>('text.bucket-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'bucket-label')
      .attr('x', -4)
      .attr('y', (d: LifetimeBucket) => (y(d.label) as number) + y.bandwidth() / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', '11px')
      .attr('fill', 'var(--retro-text-muted)')
      .text((d: LifetimeBucket) => d.label)
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

  private _renderLifetimeStats() {
    if (!this.adminStats) return nothing
    const lt = this.adminStats.session_lifetime
    const fmtHours = (h: number | null) => (h === null ? '–' : String(h))

    return html`
      <div class="lifetime-block chart-block">
        <h3 class="chart-title">Session Lifetime</h3>

        <div class="stat-grid">
          ${this._renderStatCard('Expiring in 7d', lt.expiry_countdown.expiring_within_7_days)}
          ${this._renderStatCard('Expiring in 30d', lt.expiry_countdown.expiring_within_30_days)}
          ${this._renderStatCard('Avg time to close (h)', fmtHours(lt.avg_time_to_close_hours))}
        </div>

        <div class="avg-duration-row">
          <span class="avg-duration-item">Open sessions: ${fmtHours(lt.avg_duration.open_avg_hours)} h</span>
          <span class="avg-duration-item">Closed sessions: ${fmtHours(lt.avg_duration.closed_avg_hours)} h</span>
        </div>

        <h4 class="chart-title" style="margin-top: 12px;">Lifetime Distribution</h4>
        <svg id="lifetime-chart" width="280" height="40" class="chart-svg"></svg>
      </div>
    `
  }

  private _renderSentryHealth() {
    if (!this.adminStats?.sentry) return nothing
    const s = this.adminStats.sentry

    return html`
      <div class="sentry-block chart-block">
        <h3 class="chart-title">Sentry Health</h3>

        ${s.error
          ? html`<p class="sentry-error-banner">${s.error}</p>`
          : html`
              <div class="stat-grid sentry-stat-grid">
                ${this._renderStatCard('Unresolved Issues', s.unresolved_count)}
              </div>

              ${s.top_issues.length > 0
                ? html`
                    <h4 class="chart-title" style="margin-top: 12px;">Top Issues</h4>
                    <ul class="sentry-issue-list">
                      ${s.top_issues.map(
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
                  <svg id="sentry-error-chart" width="280" height="100" class="chart-svg"></svg>
                </div>
                <div>
                  <h4 class="chart-title" style="margin-top: 12px;">p95 Latency (7d, ms)</h4>
                  <svg id="sentry-p95-chart" width="280" height="100" class="chart-svg"></svg>
                </div>
              </div>
            `}
      </div>
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

        ${this._renderLifetimeStats()}
        ${this._renderSentryHealth()}
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

      /* --- Session lifetime --- */
      .lifetime-block {
        margin-top: 16px;
      }

      .stat-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 12px;
      }

      @media (max-width: 640px) {
        .stat-grid {
          grid-template-columns: 1fr 1fr;
        }
      }

      .avg-duration-row {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }

      .avg-duration-item {
        font-size: 13px;
        color: var(--retro-text-muted);
      }

      /* --- Sentry Health --- */
      .sentry-block {
        margin-top: 16px;
      }

      .sentry-stat-grid {
        grid-template-columns: auto;
        display: inline-grid;
        margin-bottom: 12px;
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
