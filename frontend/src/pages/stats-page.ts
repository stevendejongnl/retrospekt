import * as d3 from 'd3'
import { LitElement, PropertyValues, css, html, nothing } from 'lit'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import '../components/background-blobs'
import { faIconStyles } from '../icons'
import type { LifetimeBucket, PublicStats, RatingCount } from '../types'

const PHASE_COLORS: Record<string, string> = {
  collecting: '#6366f1',
  discussing: '#059669',
  closed: '#6b7280',
}

@customElement('stats-page')
export class StatsPage extends LitElement {
  @state() private stats: PublicStats | null = null
  @state() private loadingPublic = true
  @state() private loadError = ''

  connectedCallback(): void {
    super.connectedCallback()
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
  }

  protected override updated(changedProps: PropertyValues): void {
    super.updated(changedProps)
    if (changedProps.has('stats') && this.stats) {
      this._renderDonutChart()
      this._renderBarChart()
      this._renderReactionChart()
      this._renderLifetimeChart()
      this._renderFeedbackChart()
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

  private _renderFeedbackChart(): void {
    const data = this.stats?.feedback_by_rating ?? []
    const el = this.shadowRoot!.querySelector<SVGSVGElement>('#feedback-rating-chart')
    if (!el || data.length === 0) return

    const svg = d3.select(el)
    svg.selectAll('*').remove()

    const margin = { top: 4, right: 20, bottom: 4, left: 36 }
    const width = 220 - margin.left - margin.right
    const rowH = 26
    const height = 5 * rowH

    svg.attr('height', height + margin.top + margin.bottom)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const maxCount = d3.max(data, (d: RatingCount) => d.count) ?? 1
    const x = d3.scaleLinear().domain([0, maxCount]).range([0, width])
    const labels = ['1★', '2★', '3★', '4★', '5★']
    const y = d3.scaleBand().domain(labels).range([0, height]).padding(0.15)

    const accent = getComputedStyle(this).getPropertyValue('--retro-accent').trim()

    const ratingMap = Object.fromEntries(data.map((d: RatingCount) => [d.rating, d.count]))

    g.selectAll('rect')
      .data(labels)
      .enter()
      .append('rect')
      .attr('y', (label) => y(label) as number)
      .attr('x', 0)
      .attr('height', y.bandwidth())
      .attr('width', (label) => x(ratingMap[Number(label[0])] ?? 0))
      .attr('fill', accent)
      .attr('rx', 2)

    g.selectAll<SVGTextElement, string>('text.rating-label')
      .data(labels)
      .enter()
      .append('text')
      .attr('class', 'rating-label')
      .attr('x', -4)
      .attr('y', (label) => (y(label) as number) + y.bandwidth() / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', '11px')
      .attr('fill', 'var(--retro-text-muted)')
      .text((label) => label)
  }

  private _renderReactionChart(): void {
    const data = this.stats!.reaction_breakdown
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
    const data = this.stats!.session_lifetime.lifetime_distribution
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

  private _renderLifetimeStats() {
    const lt = this.stats!.session_lifetime
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

  private _renderFeedbackRatings() {
    const avgStars = this.stats!.feedback_avg_rating !== null
      ? '⭐'.repeat(Math.round(this.stats!.feedback_avg_rating))
      : '–'

    return html`
      <div class="feedback-block chart-block">
        <h3 class="chart-title">User Feedback</h3>

        <div class="stat-grid">
          ${this._renderStatCard('Submissions', this.stats!.feedback_total)}
          ${this._renderStatCard('Avg Rating', this.stats!.feedback_avg_rating !== null ? this.stats!.feedback_avg_rating.toFixed(1) : '–')}
        </div>

        ${this.stats!.feedback_total > 0 ? html`
          <h4 class="chart-title" style="margin-top: 12px;">Rating Distribution</h4>
          <svg id="feedback-rating-chart" width="240" height="40" class="chart-svg"></svg>
        ` : html`<p class="muted" style="margin-top: 8px;">No feedback submitted yet.</p>`}

        <p class="feedback-avg-stars" style="margin-top: 8px; font-size: 20px;">${avgStars}</p>
      </div>
    `
  }

  private _renderAnalytics() {
    if (!this.stats) return nothing
    const { engagement_funnel: f, reaction_breakdown, cards_per_column } = this.stats

    return html`
      <section class="admin-section">
        <h2 class="section-title">Analytics</h2>

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
        ${this._renderFeedbackRatings()}
      </section>
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

                ${this._renderAnalytics()}
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
        background: var(--retro-glass-bg-medium);
        backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
        -webkit-backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
        border: 1px solid var(--retro-glass-border);
        border-radius: 14px;
        padding: 18px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        box-shadow: var(--retro-glass-shadow);
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

      .bar-chart-svg {
        width: 100%;
      }

      .section-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--retro-text-primary);
        margin: 0 0 12px;
      }

      .muted {
        color: var(--retro-text-muted);
        font-size: 14px;
        margin: 0 0 16px;
      }

      /* --- Admin section --- */
      .admin-section {
        background: var(--retro-glass-bg-medium);
        backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
        -webkit-backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
        border: 1px solid var(--retro-glass-border);
        border-radius: 14px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: var(--retro-glass-shadow);
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

      /* --- Feedback --- */
      .feedback-block {
        margin-top: 16px;
      }

      .feedback-avg-stars {
        margin: 0;
        color: var(--retro-accent);
      }
    `,
  ]
}
