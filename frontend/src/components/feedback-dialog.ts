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
      backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: var(--retro-radius-md);
      padding: 14px 14px 12px;
      box-shadow: var(--retro-glass-shadow);
    }

    .headline {
      font-size: 14px;
      font-weight: 800;
      color: var(--retro-text-primary);
      margin: 0 0 2px;
      letter-spacing: -0.3px;
    }

    .subtext {
      font-size: 12px;
      color: var(--retro-text-muted);
      margin: 0 0 12px;
    }

    textarea {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--retro-border-default);
      border-radius: var(--retro-radius-sm);
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      min-height: 52px;
      box-sizing: border-box;
      background: var(--retro-glass-bg-light);
      color: var(--retro-text-primary);
      transition: border-color 0.12s;
      margin-bottom: 10px;
    }

    textarea:focus {
      outline: none;
      border-color: var(--retro-accent);
      background: var(--retro-glass-bg-strong);
    }

    textarea::placeholder {
      color: var(--retro-text-disabled);
    }

    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .submit-btn {
      padding: 7px 14px;
      background: var(--retro-accent);
      color: white;
      border: none;
      border-radius: var(--retro-radius-sm);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s;
      box-shadow: 0 4px 12px rgba(217, 116, 38, 0.3);
    }

    .submit-btn:hover:not(:disabled) {
      background: var(--retro-accent-hover);
    }

    .submit-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .skip-btn {
      background: none;
      border: none;
      font-size: 12px;
      color: var(--retro-text-muted);
      cursor: pointer;
      font-family: inherit;
      padding: 0;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .skip-btn:hover {
      color: var(--retro-text-secondary);
    }

    .thank-you {
      text-align: center;
      padding: 8px 0;
    }

    .thanks-check {
      display: block;
      margin: 0 auto 6px;
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
      font-weight: 700;
      color: var(--retro-text-primary);
      margin: 0;
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
                  placeholder="Anything you'd like to add? (optional)"
                  maxlength="500"
                  .value=${this.comment}
                  @input=${(e: Event) => { this.comment = (e.target as HTMLTextAreaElement).value }}
                ></textarea>

                <div class="actions">
                  <button
                    class="submit-btn"
                    ?disabled=${!isValidRating(this.selectedRating) || this.submitting}
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
