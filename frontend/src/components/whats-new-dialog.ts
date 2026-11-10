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
      border: 1px solid var(--retro-glass-border);
      border-radius: var(--retro-radius-lg);
      padding: 14px;
      box-shadow: var(--retro-shadow-notification);
    }

    .version-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      font-family: var(--retro-font-mono);
      background: var(--retro-accent);
      color: var(--retro-accent-contrast);
      border-radius: 999px;
      padding: 2px 8px;
    }

    p {
      margin: 0;
    }

    .headline {
      font-size: 14px;
      font-weight: 700;
      color: var(--retro-text-primary);
      margin: 8px 0 2px;
      letter-spacing: -0.01em;
    }

    .highlight-body {
      font-size: 12px;
      line-height: 1.5;
      color: var(--retro-text-secondary);
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 12px;
    }

    .view-changelog {
      font-size: 12px;
      font-weight: 600;
      color: var(--retro-accent-ink);
      text-decoration: underline;
      background: none;
      border: none;
      cursor: pointer;
      font-family: inherit;
      padding: 0;
      text-align: left;
    }

    .got-it-btn {
      background: var(--retro-accent);
      border: 1px solid var(--retro-accent-border);
      border-radius: var(--retro-radius-sm);
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 600;
      color: var(--retro-accent-contrast);
      cursor: pointer;
      font-family: inherit;
      flex-shrink: 0;
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
        <span class="version-badge">v${entry.version}</span>
        <p class="headline">${entry.highlight?.title ?? `What's new in v${entry.version}`}</p>
        ${entry.highlight?.body ? html`<p class="highlight-body">${entry.highlight.body}</p>` : ''}

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
