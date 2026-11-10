import { LitElement, css, html, nothing } from 'lit'
import { baseStyles } from '../styles'
import { customElement } from 'lit/decorators.js'
import { CHANGELOG } from '../generated/changelog'
import type { ChangelogEntry, ChangelogKind } from '../generated/changelog'

const KIND_CLASS: Record<ChangelogKind, string> = {
  Features: 'features',
  Fixes: 'fixes',
  Refactor: 'refactor',
  Docs: 'docs',
  Other: 'docs',
}

@customElement('changelog-page')
export class ChangelogPage extends LitElement {
  static styles = [baseStyles, css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--retro-bg-page);
    }

    .page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 32px 80px;
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 32px;
    }

    @media (max-width: 800px) {
      .page {
        grid-template-columns: 1fr;
        padding: 24px 16px;
      }
      .sidebar-panel { display: none; }
    }

    .sidebar {
      position: sticky;
      top: 24px;
      align-self: start;
    }

    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--retro-accent);
      font-size: 13px;
      font-family: inherit;
      margin-bottom: 20px;
      padding: 0;
    }
    .back-btn:hover { text-decoration: underline; }

    .sidebar-panel {
      padding: 18px;
      background: var(--retro-bg-surface);
      border: 1px solid var(--retro-border-default);
      border-radius: var(--retro-radius-md);
      box-shadow: var(--retro-glass-shadow);
    }

    .sidebar-label {
      margin-bottom: 10px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--retro-text-muted);
    }

    .sidebar-links {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .sidebar-link {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 5px 8px;
      border-radius: var(--retro-radius-sm);
      font-size: 13px;
      color: var(--retro-text-secondary);
      text-decoration: none;
      cursor: pointer;
    }
    .sidebar-link.active {
      background: color-mix(in srgb, var(--retro-accent) 10%, transparent);
      color: var(--retro-accent);
      font-weight: 600;
    }
    .sidebar-link:hover { color: var(--retro-accent); }

    .sidebar-date {
      font-size: 10px;
      font-family: var(--retro-font-mono);
      opacity: 0.7;
    }

    .intro {
      margin-bottom: 28px;
    }
    h1 {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.025em;
      margin-bottom: 8px;
      color: var(--retro-text-primary);
    }
    .intro p {
      font-size: 14px;
      color: var(--retro-text-secondary);
    }

    .timeline {
      padding: 24px 28px;
      background: var(--retro-bg-surface);
      border: 1px solid var(--retro-border-default);
      border-radius: var(--retro-radius-lg);
      box-shadow: var(--retro-glass-shadow);
    }

    .version-card {
      position: relative;
      padding-left: 28px;
      padding-bottom: 28px;
    }

    .timeline-dot {
      position: absolute;
      left: 0;
      top: 4px;
      width: 14px;
      height: 14px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--retro-text-primary) 15%, transparent);
      border: 3px solid var(--retro-timeline-ring);
      z-index: 1;
    }
    .timeline-dot.first {
      background: var(--retro-accent);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--retro-accent) 18%, transparent);
    }

    .timeline-line {
      position: absolute;
      left: 6px;
      top: 16px;
      bottom: 0;
      width: 2px;
      background: color-mix(in srgb, var(--retro-text-primary) 6%, transparent);
    }

    .version-header {
      display: flex;
      align-items: baseline;
      gap: 10px;
      margin-bottom: 4px;
    }
    .version-tag {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--retro-text-primary);
    }
    .version-date {
      font-size: 12px;
      font-family: var(--retro-font-mono);
      color: var(--retro-text-muted);
    }
    .latest-badge {
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--retro-accent);
      color: var(--retro-accent-contrast);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    .groups {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 12px;
    }
    .group-label-row {
      margin-bottom: 6px;
    }
    .group-label {
      display: inline-flex;
      align-items: center;
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--kind-color);
      background: var(--kind-bg);
      border: 1px solid var(--kind-border);
    }
    .group-label.features { --kind-color: oklch(0.62 0.16 150); --kind-bg: rgba(34, 197, 94, 0.1); --kind-border: rgba(34, 197, 94, 0.3); }
    .group-label.fixes { --kind-color: oklch(0.7 0.16 50); --kind-bg: color-mix(in srgb, var(--retro-accent) 10%, transparent); --kind-border: color-mix(in srgb, var(--retro-accent) 30%, transparent); }
    .group-label.refactor { --kind-color: oklch(0.62 0.18 280); --kind-bg: rgba(168, 85, 247, 0.1); --kind-border: rgba(168, 85, 247, 0.3); }
    .group-label.docs { --kind-color: oklch(0.6 0.005 60); --kind-bg: rgba(120, 120, 120, 0.1); --kind-border: rgba(120, 120, 120, 0.3); }

    .item-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .item {
      display: flex;
      align-items: baseline;
      gap: 8px;
      font-size: 13px;
      line-height: 1.5;
      color: var(--retro-text-secondary);
    }
    .item-bullet {
      color: var(--retro-accent);
      font-size: 8px;
      line-height: 1;
      margin-top: 6px;
    }
    .item-scope {
      font-family: var(--retro-font-mono);
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 4px;
      background: color-mix(in srgb, var(--retro-text-primary) 5%, transparent);
      color: var(--retro-text-secondary);
    }

    .older {
      margin-top: 20px;
      text-align: center;
      font-size: 11px;
      font-family: var(--retro-font-mono);
      color: var(--retro-text-muted);
    }
    .older span { color: var(--retro-accent); }

    /* Phones: nothing under 11 px */
    @media (max-width: 640px) {
      .sidebar-date,
      .latest-badge,
      .group-label {
        font-size: 11px;
      }
    }
  `]

  connectedCallback(): void {
    super.connectedCallback()
    // Defer to after first render — shadowRoot content doesn't exist yet at connectedCallback time
    requestAnimationFrame(() => this._scrollToHash())
  }

  private _scrollToHash(): void {
    const hash = window.location.hash
    if (!hash) return
    const id = hash.slice(1)
    const target = this.shadowRoot?.getElementById(id)
    target?.scrollIntoView({ behavior: 'auto', block: 'start' })
  }

  private _renderEntry(entry: ChangelogEntry, idx: number) {
    return html`
      <div class="version-card" id="v${entry.version}">
        <div class="timeline-dot ${idx === 0 ? 'first' : ''}"></div>
        <div class="timeline-line"></div>
        <div class="version-header">
          <h3 class="version-tag">v${entry.version}</h3>
          ${idx === 0 ? html`<span class="latest-badge">Latest</span>` : nothing}
          <span class="version-date">${entry.date}</span>
        </div>
        <div class="groups">
          ${entry.groups.map((group) => html`
            <div>
              <div class="group-label-row"><span class="group-label ${KIND_CLASS[group.kind]}">${group.kind}</span></div>
              <ul class="item-list">
                ${group.items.map((item) => html`
                  <li class="item">
                    <span class="item-bullet">●</span>
                    <span>${item.scope ? html`<span class="item-scope">${item.scope}</span> ` : nothing}${item.text}</span>
                  </li>
                `)}
              </ul>
            </div>
          `)}
        </div>
      </div>
    `
  }

  render() {
    return html`
      <div class="page">
        <div class="sidebar">
          <button class="back-btn" @click=${() => window.history.back()}>← Back</button>
          <nav class="sidebar-panel">
            <div class="sidebar-label">Jump to</div>
            <div class="sidebar-links">
              ${CHANGELOG.slice(0, 8).map((entry, i) => html`
                <a class="sidebar-link ${i === 0 ? 'active' : ''}" href="#v${entry.version}">
                  <span>v${entry.version}</span>
                  <span class="sidebar-date">${entry.date.slice(5)}</span>
                </a>
              `)}
            </div>
          </nav>
        </div>
        <div class="main">
          <div class="intro">
            <h1>Changelog</h1>
            <p>Every release of Retrospekt, in reverse chronological order.</p>
          </div>
          <div class="timeline">
            ${CHANGELOG.map((entry, idx) => this._renderEntry(entry, idx))}
          </div>
          <p class="older">
            For older releases, see <span>github.com/stevendejongnl/retrospekt</span>
          </p>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'changelog-page': ChangelogPage
  }
}
