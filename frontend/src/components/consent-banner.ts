import { LitElement, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'

import { storage } from '../storage'

/**
 * Card asking for analytics consent (Matomo). Nothing is tracked until the
 * visitor accepts — main.ts only calls tagManager.init() after a
 * "consent-granted" event, or immediately on boot if consent was already
 * stored as "granted" in a previous visit.
 *
 * Positioning and removal belong to <notification-dock>: this answers with
 * "consent-closed" and the dock drops the card.
 */
@customElement('consent-banner')
export class ConsentBanner extends LitElement {
  static styles = css`
    /* Non-blocking: neither the host nor .bar captures pointer events —
       only the actual controls (button, a) opt back in — so this can never
       eat a click meant for something behind or beside it. The dock owns
       where this sits; the card only sizes itself to the dock's width. */
    :host {
      display: block;
      pointer-events: none;
    }
    .bar {
      background: var(--retro-glass-bg-strong);
      border: 1px solid var(--retro-glass-border);
      box-shadow: var(--retro-shadow-notification);
      border-radius: var(--retro-radius-lg);
      padding: 14px;
    }
    p {
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
      color: var(--retro-text-secondary);
    }
    a {
      pointer-events: auto;
      color: var(--retro-accent-ink);
      text-underline-offset: 2px;
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 10px;
    }
    button {
      pointer-events: auto;
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      padding: 5px 12px;
      border-radius: var(--retro-radius-sm);
      cursor: pointer;
      border: 1px solid var(--retro-border-default);
      background: var(--retro-bg-subtle);
      color: var(--retro-text-primary);
    }
    .accept {
      background: var(--retro-accent);
      border-color: var(--retro-accent-border);
      color: var(--retro-accent-contrast);
      font-weight: 600;
    }
  `

  private close(): void {
    this.dispatchEvent(new CustomEvent('consent-closed', { bubbles: true, composed: true }))
  }

  private accept(): void {
    storage.setAnalyticsConsent('granted')
    this.dispatchEvent(new CustomEvent('consent-granted', { bubbles: true, composed: true }))
    this.close()
  }

  private decline(): void {
    storage.setAnalyticsConsent('denied')
    this.close()
  }

  render() {
    return html`
      <div class="bar">
        <p>
          This site uses privacy-friendly analytics. Nothing is tracked until you accept.${' '}
          <a href="/privacy" @click=${(e: Event) => { e.preventDefault(); window.router.navigate('/privacy') }}>Learn more</a>
        </p>
        <div class="actions">
          <button @click=${this.decline}>Decline</button>
          <button class="accept" @click=${this.accept}>Accept</button>
        </div>
      </div>
    `
  }
}
