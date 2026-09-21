import { LitElement, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'

import { storage } from '../storage'

/**
 * Bottom banner asking for analytics consent (Matomo). Nothing is tracked
 * until the visitor accepts — main.ts only calls tagManager.init() after
 * a "consent-granted" event, or immediately on boot if consent was already
 * stored as "granted" in a previous visit.
 */
@customElement('consent-banner')
export class ConsentBanner extends LitElement {
  static styles = css`
    /* Non-blocking, like every other overlay in this app (board-notes,
       feedback-dialog, retro-help, ...): the host and .bar itself never
       capture pointer events — only the actual controls (button, a) opt
       back in — so this can never eat a click meant for something behind
       or beside it, no matter what else is on screen. */
    :host {
      position: fixed;
      /* Left, not right: board-notes and other panels dock to the right
         edge (right: 0), so the right side of the viewport isn't free. */
      left: 12px;
      bottom: 12px;
      z-index: 300;
      pointer-events: none;
    }
    .bar {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 260px;
      background: var(--retro-glass-bg-strong);
      backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      box-shadow: var(--retro-glass-shadow);
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 12px;
      color: var(--retro-text-secondary);
    }
    .bar a {
      pointer-events: auto;
      color: var(--retro-accent);
    }
    .actions {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
    }
    button {
      pointer-events: auto;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid var(--retro-glass-border);
      background: none;
      color: var(--retro-text-secondary);
    }
    .accept {
      background: var(--retro-accent);
      border-color: var(--retro-accent);
      color: white;
    }
  `

  private accept(): void {
    storage.setAnalyticsConsent('granted')
    this.dispatchEvent(new CustomEvent('consent-granted', { bubbles: true, composed: true }))
    this.remove()
  }

  private decline(): void {
    storage.setAnalyticsConsent('denied')
    this.remove()
  }

  render() {
    return html`
      <div class="bar">
        <span>
          This site uses privacy-friendly analytics. Nothing is tracked until you accept.
          <a href="/privacy" @click=${(e: Event) => { e.preventDefault(); window.router.navigate('/privacy') }}>Learn more</a>
        </span>
        <div class="actions">
          <button @click=${this.decline}>Decline</button>
          <button class="accept" @click=${this.accept}>Accept</button>
        </div>
      </div>
    `
  }
}
