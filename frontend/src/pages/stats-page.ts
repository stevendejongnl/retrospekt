import { LitElement, css, html, nothing, svg } from 'lit'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import { baseStyles } from '../styles'
import type { PublicStats } from '../types'

const PHASE_SWATCH: Record<string, string> = {
  collecting: 'var(--retro-col-3)',
  discussing: 'var(--retro-col-1)',
  closed: 'var(--retro-text-muted)',
}

const REACTION_NAMES: Record<string, string> = {
  '❤️': 'Heart',
  '🎉': 'Party',
  '🥓': 'Bacon',
  '👀': 'Eyes',
  '🤔': 'Thinking',
}

const COLUMN_COLORS = ['var(--retro-col-1)', 'var(--retro-col-2)', 'var(--retro-col-3)']

const FUNNEL_STEPS: Array<{ key: 'created' | 'has_cards' | 'has_votes' | 'closed'; label: string }> = [
  { key: 'created', label: 'Created' },
  { key: 'has_cards', label: 'Added cards' },
  { key: 'has_votes', label: 'Voted' },
  { key: 'closed', label: 'Closed' },
]

const DONUT_RADIUS = 50
const DONUT_CENTRE = 70
const DONUT_HOLE = 28

/** The public numbers, drawn the way the design draws them: tiles, a donut, columns and horizontal bars. */
@customElement('stats-page')
export class StatsPage extends LitElement {
  @state() private stats: PublicStats | null = null
  @state() private loadingPublic = true
  @state() private loadError = ''

  connectedCallback(): void {
    super.connectedCallback()
    void this._loadPublicStats()
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

  private _tile(label: string, value: string | number) {
    return html`
      <div class="stat-card">
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    `
  }

  private _panel(title: string, body: unknown, note?: string, id?: string) {
    return html`
      <section class="panel" id=${id ?? nothing}>
        <div class="panel-head">
          <div class="eyebrow">${title}</div>
          ${note ? html`<p class="panel-note">${note}</p>` : nothing}
        </div>
        ${body}
      </section>
    `
  }

  private _hbar(label: string, value: number, max: number, color?: string) {
    const width = max > 0 ? (value / max) * 100 : 0
    return html`
      <div class="hbar">
        <span class="hbar-label">${label}</span>
        <span class="hbar-track"><span class="hbar-fill" style=${color ? `width:${width}%;background:${color}` : `width:${width}%`}></span></span>
        <span class="hbar-value">${value}</span>
      </div>
    `
  }

  private _donut(stats: PublicStats) {
    const total = stats.sessions_by_phase.reduce((sum, p) => sum + p.count, 0)
    let cumulative = 0
    const slices = stats.sessions_by_phase.map((p) => {
      const start = (cumulative / total) * Math.PI * 2 - Math.PI / 2
      cumulative += p.count
      const end = (cumulative / total) * Math.PI * 2 - Math.PI / 2
      const large = end - start > Math.PI ? 1 : 0
      const x1 = DONUT_CENTRE + DONUT_RADIUS * Math.cos(start)
      const y1 = DONUT_CENTRE + DONUT_RADIUS * Math.sin(start)
      const x2 = DONUT_CENTRE + DONUT_RADIUS * Math.cos(end)
      const y2 = DONUT_CENTRE + DONUT_RADIUS * Math.sin(end)
      const d = `M ${DONUT_CENTRE} ${DONUT_CENTRE} L ${x1} ${y1} A ${DONUT_RADIUS} ${DONUT_RADIUS} 0 ${large} 1 ${x2} ${y2} Z`
      return svg`<path d=${d} style="fill:${PHASE_SWATCH[p.phase] ?? 'var(--retro-text-muted)'}" />`
    })
    return html`
      <svg id="donut-chart" width="140" height="140" viewBox="0 0 140 140" class="donut">
        ${total > 0 ? slices : nothing}
        <circle cx=${DONUT_CENTRE} cy=${DONUT_CENTRE} r=${DONUT_HOLE} style="fill:var(--retro-bg-surface)" />
      </svg>
      <div class="legend">
        ${stats.sessions_by_phase.map((p) => html`
          <div class="legend-row">
            <span class="legend-swatch" style="background:${PHASE_SWATCH[p.phase] ?? 'var(--retro-text-muted)'}"></span>
            <span class="legend-label">${p.phase} (${p.count})</span>
          </div>
        `)}
      </div>
    `
  }

  private _columns(stats: PublicStats) {
    const days = stats.sessions_per_day
    const max = Math.max(1, ...days.map((d) => d.count))
    const ticks = [max, Math.round((max * 2) / 3), Math.round(max / 3), 0]
    return html`
      <div id="bar-chart" class="columns-chart">
        <div class="axis">${ticks.map((tick) => html`<span>${tick}</span>`)}</div>
        ${days.map((day) => html`
          <div class="column-slot" title="${day.date}: ${day.count}">
            <div class="column-bar" style="height:${(day.count / max) * 100}%"></div>
          </div>
        `)}
      </div>
    `
  }

  private _lifetime(stats: PublicStats) {
    const hours = stats.session_lifetime.avg_duration.open_avg_hours
    return html`
      <div class="lifetime-value">${hours === null ? '–' : `${(hours / 24).toFixed(1)} days`}</div>
      <p class="panel-note plain">Average time from creation to the last activity.</p>
    `
  }

  render() {
    return html`
      <div class="page">
        <header class="page-header">
          <div class="page-heading">
            <a
              href="/"
              class="back-link"
              @click=${(e: Event) => {
                e.preventDefault()
                window.router.navigate('/')
              }}
            >← Back</a>
            <h1 class="page-title">Retrospekt Stats</h1>
          </div>
          <a
            href="/admin"
            class="admin-link"
            @click=${(e: Event) => {
              e.preventDefault()
              window.router.navigate('/admin')
            }}
          >Admin →</a>
        </header>

        ${this.loadingPublic
          ? html`<div class="loading">Loading statistics…</div>`
          : this.loadError
            ? html`<div class="error">${this.loadError}</div>`
            : this._renderStats(this.stats!)}
      </div>
    `
  }

  private _renderStats(stats: PublicStats) {
    const reactionMax = Math.max(1, ...stats.reaction_breakdown.map((r) => r.count))
    const columnMax = Math.max(1, ...stats.cards_per_column.map((c) => c.count))
    const funnelMax = Math.max(1, stats.engagement_funnel.created)
    const ratings = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: stats.feedback_by_rating.find((r) => r.rating === rating)?.count ?? 0,
    }))
    const ratingMax = Math.max(1, ...ratings.map((r) => r.count))
    return html`
      <section class="tiles">
        ${this._tile('Sessions', stats.total_sessions)}
        ${this._tile('Cards', stats.total_cards)}
        ${this._tile('Votes', stats.total_votes)}
        ${this._tile('Reactions', stats.total_reactions)}
        ${this._tile('Feedback ★', stats.feedback_avg_rating === null ? '–' : stats.feedback_avg_rating.toFixed(1))}
      </section>

      <section class="grid grid-narrow-wide">
        ${this._panel('Sessions by phase', this._donut(stats))}
        ${this._panel('Sessions per day (last 30 days)', this._columns(stats))}
      </section>

      <section class="grid grid-thirds">
        ${this._panel('Reactions', html`
          <div class="hbars">
            ${stats.reaction_breakdown.map((r) =>
              this._hbar(REACTION_NAMES[r.emoji] ? `${r.emoji} ${REACTION_NAMES[r.emoji]}` : r.emoji, r.count, reactionMax))}
          </div>
        `, undefined, 'reaction-chart')}
        ${this._panel('Cards per column', html`
          <div class="hbars">
            ${stats.cards_per_column.map((c, i) => this._hbar(c.column, c.count, columnMax, COLUMN_COLORS[i % COLUMN_COLORS.length]))}
          </div>
        `)}
        ${this._panel('Engagement funnel', html`
          <div class="hbars">
            ${FUNNEL_STEPS.map((step) => this._hbar(step.label, stats.engagement_funnel[step.key], funnelMax))}
          </div>
        `)}
      </section>

      <section class="grid grid-narrow-wide">
        ${this._panel('Session lifetime', this._lifetime(stats))}
        ${this._panel('Feedback ratings', html`
          <div class="hbars tight">
            ${ratings.map((r) => this._hbar('★'.repeat(r.rating), r.count, ratingMax))}
          </div>
        `, 'Only counts and the average are public. Comments stay on the admin page.', 'feedback-rating-chart')}
      </section>
    `
  }

  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--retro-bg-page);
        color: var(--retro-text-primary);
        font-family: inherit;
      }
      .page {
        padding: 32px 80px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .page-heading {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .back-link {
        color: var(--retro-accent-ink);
        text-decoration: none;
        font-size: 13px;
      }
      .back-link:hover {
        text-decoration: underline;
      }
      .page-title {
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--retro-text-primary);
      }
      .admin-link {
        padding: 5px 12px;
        background: var(--retro-bg-subtle);
        border: 1px solid var(--retro-border-default);
        border-radius: var(--retro-radius-sm);
        color: var(--retro-text-primary);
        font-size: 12px;
        font-weight: 500;
        text-decoration: none;
        white-space: nowrap;
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

      .tiles {
        display: flex;
        gap: 12px;
      }
      .stat-card {
        flex: 1;
        padding: 16px 18px;
        background: var(--retro-bg-surface);
        border: 1px solid var(--retro-border-default);
        border-radius: var(--retro-radius-md);
        box-shadow: var(--retro-glass-shadow);
      }
      .stat-value {
        font-size: 30px;
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.02em;
        color: var(--retro-accent-ink);
      }
      .stat-label {
        margin-top: 6px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--retro-text-muted);
      }

      .grid {
        display: grid;
        gap: 12px;
      }
      .grid-narrow-wide {
        grid-template-columns: 1fr 2fr;
      }
      .grid-thirds {
        grid-template-columns: 1fr 1fr 1fr;
      }
      .panel {
        padding: 18px;
        background: var(--retro-bg-surface);
        border: 1px solid var(--retro-border-default);
        border-radius: var(--retro-radius-md);
        box-shadow: var(--retro-glass-shadow);
        min-width: 0;
      }
      .panel-head {
        margin-bottom: 12px;
      }
      .eyebrow {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--retro-text-muted);
      }
      .panel-note.plain {
        line-height: normal;
      }
      .panel-note {
        margin-top: 4px;
        font-size: 12px;
        line-height: 1.45;
        color: var(--retro-text-secondary);
      }

      .donut {
        display: block;
        margin: 0 auto;
      }
      .legend {
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .legend-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .legend-swatch {
        width: 10px;
        height: 10px;
        border-radius: 2px;
      }
      .legend-label {
        font-size: 11px;
        color: var(--retro-text-secondary);
      }

      .columns-chart {
        display: flex;
        align-items: stretch;
        gap: 6px;
        position: relative;
        height: 140px;
        padding-left: 24px;
      }
      .axis {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        font-family: var(--retro-font-mono);
        font-size: 9px;
        color: var(--retro-text-muted);
      }
      .column-slot {
        flex: 1;
        display: flex;
        align-items: flex-end;
      }
      .column-bar {
        width: 100%;
        background: var(--retro-accent);
        border-radius: 4px;
      }

      .hbars {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .hbars.tight {
        gap: 6px;
      }
      .hbar {
        display: grid;
        grid-template-columns: 110px 1fr 46px;
        align-items: center;
        gap: 10px;
        font-size: 12px;
      }
      .hbar-label {
        color: var(--retro-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hbar-track {
        height: 12px;
        border-radius: var(--retro-radius-sm);
        background: var(--retro-bg-subtle);
        border: 1px solid var(--retro-border-default);
        overflow: hidden;
      }
      .hbar-fill {
        display: block;
        height: 100%;
        background: var(--retro-accent);
        border-radius: var(--retro-radius-sm);
      }
      .hbar-value {
        color: var(--retro-text-primary);
        font-weight: 600;
        text-align: right;
      }

      .lifetime-value {
        font-size: 30px;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--retro-accent-ink);
      }

      /* Phones: two tiles per row, every chart and list card full width, nothing under 11 px */
      @media (max-width: 640px) {
        .tiles {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .stat-card:nth-child(odd):last-child {
          grid-column: 1 / -1;
        }
        .grid-narrow-wide,
        .grid-thirds {
          grid-template-columns: 1fr;
        }
        .eyebrow,
        .axis {
          font-size: 11px;
        }
      }
    `,
  ]
}

declare global {
  interface HTMLElementTagNameMap {
    'stats-page': StatsPage
  }
}
