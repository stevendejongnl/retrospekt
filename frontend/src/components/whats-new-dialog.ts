import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { ChangelogEntry } from '../generated/changelog'

@customElement('whats-new-dialog')
export class WhatsNewDialog extends LitElement {
  @property({ type: Boolean }) open = false
  @property({ type: Object }) entry: ChangelogEntry | null = null

  static styles = css`
    :host { display: block; }

    .overlay {
      position: fixed;
      inset: 0;
      background: var(--retro-overlay-bg);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 160;
      padding: 24px;
    }

    .card {
      background: var(--retro-glass-bg-strong);
      backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: 20px;
      max-width: 480px;
      width: 100%;
      overflow: hidden;
      box-shadow: var(--retro-glass-shadow);
    }

    .hero {
      background: linear-gradient(135deg, oklch(0.72 0.16 50), oklch(0.58 0.17 38));
      padding: 24px 28px 20px;
      color: white;
    }

    .version-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      background: rgba(255,255,255,0.22);
      border-radius: 6px;
      padding: 2px 7px;
      margin-bottom: 10px;
    }

    .headline {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 8px;
      letter-spacing: -0.4px;
      line-height: 1.25;
    }

    .highlight-body {
      font-size: 13px;
      opacity: 0.9;
      margin: 0;
      line-height: 1.5;
    }

    .body {
      padding: 20px 28px 0;
    }

    .section-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: var(--retro-text-muted);
      margin: 0 0 10px;
    }

    .release-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .release-item {
      font-size: 13px;
      color: var(--retro-text-secondary);
      display: flex;
      gap: 8px;
      align-items: flex-start;
      line-height: 1.4;
    }

    .release-item::before {
      content: '·';
      color: var(--retro-accent);
      font-weight: 700;
      flex-shrink: 0;
    }

    .scope {
      font-weight: 600;
      color: var(--retro-text-primary);
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 28px 22px;
    }

    .view-changelog {
      font-size: 12px;
      color: var(--retro-text-muted);
      text-decoration: underline;
      text-underline-offset: 2px;
      background: none;
      border: none;
      cursor: pointer;
      font-family: inherit;
      padding: 0;
    }

    .view-changelog:hover { color: var(--retro-text-secondary); }

    .actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .later-btn {
      background: none;
      border: 1px solid var(--retro-border-default);
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 13px;
      color: var(--retro-text-muted);
      cursor: pointer;
      font-family: inherit;
      transition: border-color 0.12s, color 0.12s;
    }

    .later-btn:hover {
      border-color: var(--retro-text-muted);
      color: var(--retro-text-secondary);
    }

    .got-it-btn {
      background: linear-gradient(135deg, oklch(0.72 0.16 50), oklch(0.66 0.17 42));
      border: 1px solid rgba(217,116,38,0.5);
      border-radius: 8px;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 600;
      color: white;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 0.12s;
      box-shadow: 0 4px 12px rgba(217,116,38,0.3);
    }

    .got-it-btn:hover { opacity: 0.9; }
  `

  private _later(): void {
    this.dispatchEvent(new CustomEvent('whats-new-dismissed', { bubbles: true, composed: true }))
  }

  private _gotIt(): void {
    this.dispatchEvent(new CustomEvent('whats-new-acknowledged', { bubbles: true, composed: true }))
  }

  private _viewChangelog(): void {
    window.router?.navigate('/changelog')
    this._gotIt()
  }

  render() {
    if (!this.open || !this.entry) return nothing
    const { entry } = this

    const allItems = entry.groups.flatMap((g) => g.items)

    return html`
      <div class="overlay" @click=${this._later}>
        <div class="card" @click=${(e: Event) => e.stopPropagation()}>
          <div class="hero">
            <div class="version-badge">v${entry.version}</div>
            <p class="headline">${entry.highlight?.title ?? `What's new in v${entry.version}`}</p>
            ${entry.highlight?.body ? html`<p class="highlight-body">${entry.highlight.body}</p>` : ''}
          </div>

          ${allItems.length > 0 ? html`
            <div class="body">
              <p class="section-label">Also in this release</p>
              <ul class="release-list">
                ${allItems.map((item) => html`
                  <li class="release-item">
                    ${item.scope ? html`<span class="scope">${item.scope}:</span>` : ''}
                    ${item.text}
                  </li>
                `)}
              </ul>
            </div>
          ` : ''}

          <div class="footer">
            <button class="view-changelog" @click=${this._viewChangelog}>View full changelog →</button>
            <div class="actions">
              <button class="later-btn" @click=${this._later}>Later</button>
              <button class="got-it-btn" @click=${this._gotIt}>Got it</button>
            </div>
          </div>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'whats-new-dialog': WhatsNewDialog
  }
}
