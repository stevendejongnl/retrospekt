import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import { api } from '../api'
import './rating-stars'

// Exported for unit tests
export function isValidRating(rating: number): boolean {
  return rating >= 1 && rating <= 5
}

@customElement('feedback-dialog')
export class FeedbackDialog extends LitElement {
  @property({ type: Boolean }) open = false
  @property({ type: String }) sessionId = ''
  @property({ type: String }) participantName = ''

  @state() private selectedRating = 0
  @state() private comment = ''
  @state() private submitting = false
  @state() private submitted = false

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

    p {
      margin: 0;
    }

    .headline {
      font-size: 14px;
      font-weight: 700;
      color: var(--retro-text-primary);
      letter-spacing: -0.01em;
    }

    .subtext {
      font-size: 12px;
      color: var(--retro-text-secondary);
      margin: 2px 0 10px;
    }

    rating-stars {
      margin-bottom: 10px;
    }

    textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border: 1px solid var(--retro-input-border);
      border-radius: var(--retro-radius-md);
      font-size: 12px;
      font-family: inherit;
      resize: none;
      background: var(--retro-input-bg);
      color: var(--retro-text-primary);
      margin-bottom: 10px;
    }

    textarea:focus {
      outline: none;
      border-color: color-mix(in srgb, var(--retro-accent) 55%, transparent);
    }

    textarea::placeholder {
      color: var(--retro-text-muted);
    }

    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .submit-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 5px 12px;
      background: var(--retro-accent);
      color: var(--retro-accent-contrast);
      border: 1px solid var(--retro-accent-border);
      border-radius: var(--retro-radius-sm);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }

    .submit-btn:hover:not([aria-disabled='true']) {
      background: var(--retro-accent-hover);
    }

    .submit-btn[aria-disabled='true'] {
      opacity: 0.55;
      cursor: default;
    }

    .skip-btn {
      background: none;
      border: none;
      font-size: 12px;
      font-weight: 500;
      color: var(--retro-text-secondary);
      cursor: pointer;
      font-family: inherit;
      padding: 5px 12px;
      text-decoration: underline;
      text-underline-offset: 3px;
      text-decoration-color: var(--retro-border-default);
    }

    .thank-you {
      text-align: center;
      padding: 14px 0;
    }

    .thanks-check {
      display: block;
      margin: 0 auto;
      width: 30px;
      height: 30px;
      stroke: var(--retro-accent-ink);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .thank-you p {
      font-size: 14px;
      font-weight: 600;
      color: var(--retro-text-primary);
      margin: 6px 0 0;
    }
  `

  private _dismiss(): void {
    this.dispatchEvent(new CustomEvent('feedback-dismissed', { bubbles: true, composed: true }))
  }

  private async _submit(): Promise<void> {
    if (!isValidRating(this.selectedRating) || this.submitting) return
    this.submitting = true
    try {
      await api.submitFeedback(this.selectedRating, this.comment, this.sessionId || undefined, this.participantName || undefined)
      this.submitted = true
      this.dispatchEvent(new CustomEvent('feedback-submitted', { bubbles: true, composed: true }))
      setTimeout(() => this._dismiss(), 2000)
    } finally {
      this.submitting = false
    }
  }

  render() {
    if (!this.open) return nothing

    return html`
        <div class="card">
          ${this.submitted
            ? html`
                <div class="thank-you">
                  <svg class="thanks-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="20 6 9 17 4 12" /></svg>
                  <p>Thanks for your feedback!</p>
                </div>
              `
            : html`
                <p class="headline">How's Retrospekt working for you?</p>
                <p class="subtext">Your feedback helps improve the app.</p>

                <rating-stars
                  .value=${this.selectedRating}
                  @rating-change=${(e: CustomEvent<number>) => { this.selectedRating = e.detail }}
                ></rating-stars>

                <textarea
                  rows="2"
                  aria-label="Comment"
                  placeholder="Anything you'd like to add? (optional)"
                  maxlength="500"
                  .value=${this.comment}
                  @input=${(e: Event) => { this.comment = (e.target as HTMLTextAreaElement).value }}
                ></textarea>

                <div class="actions">
                  <button
                    class="submit-btn"
                    aria-disabled=${!isValidRating(this.selectedRating) || this.submitting ? 'true' : 'false'}
                    @click=${this._submit}
                  >
                    ${this.submitting ? 'Sending…' : 'Send feedback'}
                  </button>
                  <button class="skip-btn" @click=${this._dismiss}>Not now</button>
                </div>
              `}
        </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedback-dialog': FeedbackDialog
  }
}
