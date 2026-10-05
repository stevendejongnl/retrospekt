import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { ChangelogEntry } from '../generated/changelog'

@customElement('whats-new-dialog')
export class WhatsNewDialog extends LitElement {
  @property({ type: Boolean }) open = false
  @property({ type: Object }) entry: ChangelogEntry | null = null

  static styles = css`
    /* Non-blocking card: <notification-dock> owns where this sits, so the
       host never positions itself and never captures pointer events — only
       the controls inside the card do. */
    :host {
      display: block;
      pointer-events: none;
    }

    .card {
      pointer-events: auto;
      background: var(--retro-glass-bg-strong);
      backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: var(--retro-glass-shadow);
    }

    .hero {
      background: linear-gradient(135deg, var(--retro-accent), var(--retro-accent-hover));
      padding: 12px 14px 10px;
      color: white;
    }

    .version-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.22);
      border-radius: 5px;
      padding: 1px 6px;
      margin-bottom: 6px;
    }

    .headline {
      font-size: 14px;
      font-weight: 800;
      margin: 0 0 4px;
      letter-spacing: -0.3px;
      line-height: 1.25;
    }

    .highlight-body {
      font-size: 12px;
      opacity: 0.9;
      margin: 0;
      line-height: 1.45;
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 14px 12px;
    }

    .view-changelog {
      font-size: 11px;
      color: var(--retro-text-muted);
      text-decoration: underline;
      text-underline-offset: 2px;
      background: none;
      border: none;
      cursor: pointer;
      font-family: inherit;
      padding: 0;
      text-align: left;
    }

    .view-changelog:hover {
      color: var(--retro-text-secondary);
    }

    .got-it-btn {
      background: var(--retro-accent);
      border: none;
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      color: white;
      cursor: pointer;
      font-family: inherit;
      flex-shrink: 0;
      transition: background 0.12s;
      box-shadow: 0 4px 12px rgba(217, 116, 38, 0.3);
    }

    .got-it-btn:hover {
      background: var(--retro-accent-hover);
    }
  `

  private _gotIt(): void {
    this.dispatchEvent(new CustomEvent('whats-new-acknowledged', { bubbles: true, composed: true }))
  }

  private _viewChangelog(): void {
    window.router.navigate('/changelog')
    this._gotIt()
  }

  render() {
    if (!this.open || !this.entry) return nothing
    const { entry } = this

    return html`
      <div class="card">
        <div class="hero">
          <div class="version-badge">v${entry.version}</div>
          <p class="headline">${entry.highlight?.title ?? `What's new in v${entry.version}`}</p>
          ${entry.highlight?.body ? html`<p class="highlight-body">${entry.highlight.body}</p>` : ''}
        </div>

        <div class="footer">
          <button class="view-changelog" @click=${this._viewChangelog}>View full changelog →</button>
          <button class="got-it-btn" @click=${this._gotIt}>Got it</button>
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
