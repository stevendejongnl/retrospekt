import { LitElement, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import '../components/background-blobs'
import { CHANGELOG } from '../generated/changelog'
import type { ChangelogEntry, ChangelogKind } from '../generated/changelog'

const KIND_LABEL: Record<ChangelogKind, string> = {
  Features: 'Features',
  Fixes: 'Bug Fixes',
  Refactor: 'Refactor',
  Docs: 'Docs',
  Other: 'Other',
}

@customElement('changelog-page')
export class ChangelogPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--retro-bg-page);
      position: relative;
      overflow: hidden;
    }

    .page {
      position: relative;
      z-index: 1;
      max-width: 820px;
      margin: 0 auto;
      padding: 32px 24px 80px;
    }

    .topbar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 40px;
    }

    .back-btn {
      background: var(--retro-glass-bg-light);
      backdrop-filter: blur(var(--retro-glass-blur-light)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-light)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: 999px;
      padding: 6px 14px;
      font-size: 13px;
      color: var(--retro-accent);
      cursor: pointer;
      font-family: inherit;
      font-weight: 600;
      transition: opacity 0.12s;
    }

    .back-btn:hover { opacity: 0.8; }

    h1 {
      font-size: 26px;
      font-weight: 800;
      color: var(--retro-text-primary);
      margin: 0;
      letter-spacing: -0.5px;
    }

    h1 em {
      font-style: normal;
      color: var(--retro-accent);
    }

    .layout {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 32px;
      align-items: start;
    }

    @media (max-width: 600px) {
      .layout {
        grid-template-columns: 1fr;
      }
      .sidebar { display: none; }
    }

    .sidebar {
      position: sticky;
      top: 24px;
      background: var(--retro-glass-bg-light);
      backdrop-filter: blur(var(--retro-glass-blur-light)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-light)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: var(--retro-glass-shadow);
    }

    .sidebar-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: var(--retro-text-muted);
      margin: 0 0 10px;
    }

    .sidebar-link {
      display: block;
      font-size: 12px;
      color: var(--retro-text-secondary);
      text-decoration: none;
      padding: 3px 0;
      transition: color 0.1s;
    }

    .sidebar-link:hover { color: var(--retro-accent); }

    .timeline { display: flex; flex-direction: column; gap: 24px; }

    .version-card {
      background: var(--retro-glass-bg-medium);
      backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: 14px;
      padding: 20px 22px;
      box-shadow: var(--retro-glass-shadow);
    }

    .version-header {
      display: flex;
      align-items: baseline;
      gap: 10px;
      margin-bottom: 14px;
    }

    .version-tag {
      font-size: 15px;
      font-weight: 800;
      color: var(--retro-text-primary);
      letter-spacing: -0.3px;
    }

    .version-date {
      font-size: 12px;
      color: var(--retro-text-muted);
    }

    .latest-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      background: var(--retro-accent);
      color: white;
      border-radius: 5px;
      padding: 2px 7px;
    }

    .group-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: var(--retro-accent);
      margin: 10px 0 6px;
    }

    .group-label:first-of-type { margin-top: 0; }

    .item-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .item {
      font-size: 13px;
      color: var(--retro-text-secondary);
      display: flex;
      gap: 6px;
      line-height: 1.45;
    }

    .item::before {
      content: '·';
      color: var(--retro-accent);
      font-weight: 700;
      flex-shrink: 0;
    }

    .item-scope {
      font-weight: 600;
      color: var(--retro-text-primary);
    }
  `

  private _renderEntry(entry: ChangelogEntry, idx: number) {
    return html`
      <div class="version-card" id="v${entry.version}">
        <div class="version-header">
          <span class="version-tag">v${entry.version}</span>
          <span class="version-date">${entry.date}</span>
          ${idx === 0 ? html`<span class="latest-badge">Latest</span>` : ''}
        </div>
        ${entry.groups.map((group) => html`
          <p class="group-label">${KIND_LABEL[group.kind]}</p>
          <ul class="item-list">
            ${group.items.map((item) => html`
              <li class="item">
                ${item.scope ? html`<span class="item-scope">${item.scope}:</span>` : ''}
                ${item.text}
              </li>
            `)}
          </ul>
        `)}
      </div>
    `
  }

  render() {
    return html`
      <background-blobs></background-blobs>
      <div class="page">
        <div class="topbar">
          <button class="back-btn" @click=${() => window.history.back()}>← Back</button>
          <h1>Retro<em>spekt</em> Changelog</h1>
        </div>
        <div class="layout">
          <nav class="sidebar">
            <p class="sidebar-label">Jump to</p>
            ${CHANGELOG.slice(0, 12).map((entry) => html`
              <a class="sidebar-link" href="#v${entry.version}">v${entry.version}</a>
            `)}
          </nav>
          <div class="timeline">
            ${CHANGELOG.map((entry, idx) => this._renderEntry(entry, idx))}
          </div>
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
