import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import { api } from '../api'
import { storage } from '../storage'

const EMOJI_SCALE = ['😞', '😕', '😐', '🙂', '😍'] as const

// Exported for unit tests
export function isValidRating(rating: number): boolean {
  return rating >= 1 && rating <= 5
}

@customElement('feedback-dialog')
export class FeedbackDialog extends LitElement {
  @property({ type: Boolean }) open = false
  @property({ type: String }) sessionId = ''

  @state() private selectedRating = 0
  @state() private comment = ''
  @state() private submitting = false
  @state() private submitted = false

  static styles = css`
    :host {
      display: block;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: var(--retro-overlay-bg);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 150;
      padding: 24px;
    }

    .card {
      background: var(--retro-bg-surface);
      border-radius: 20px;
      padding: 36px 32px 28px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 16px 64px var(--retro-card-shadow);
    }

    .headline {
      font-size: 18px;
      font-weight: 800;
      color: var(--retro-text-primary);
      margin: 0 0 6px;
      letter-spacing: -0.4px;
    }

    .subtext {
      font-size: 13px;
      color: var(--retro-text-muted);
      margin: 0 0 24px;
    }

    .emoji-row {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .emoji-btn {
      background: none;
      border: 2px solid transparent;
      border-radius: 50%;
      width: 52px;
      height: 52px;
      font-size: 28px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.12s, border-color 0.12s, background 0.12s;
      padding: 0;
    }

    .emoji-btn:hover {
      transform: scale(1.2);
      background: var(--retro-accent-tint);
    }

    .emoji-btn.selected {
      border-color: var(--retro-accent);
      background: var(--retro-accent-tint);
      transform: scale(1.15);
    }

    textarea {
      width: 100%;
      padding: 12px 14px;
      border: 1.5px solid var(--retro-border-default);
      border-radius: 10px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      min-height: 80px;
      box-sizing: border-box;
      background: var(--retro-bg-subtle);
      color: var(--retro-text-primary);
      transition: border-color 0.12s;
      margin-bottom: 20px;
    }

    textarea:focus {
      outline: none;
      border-color: var(--retro-accent);
      background: var(--retro-bg-surface);
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
      padding: 11px 24px;
      background: var(--retro-accent);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s, opacity 0.12s;
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
      font-size: 13px;
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
      padding: 16px 0;
    }

    .thank-you .emoji {
      font-size: 40px;
      display: block;
      margin-bottom: 12px;
    }

    .thank-you p {
      font-size: 16px;
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
      await api.submitFeedback(this.selectedRating, this.comment, this.sessionId || undefined)
      storage.setFeedbackGiven(__APP_VERSION__)
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
      <div class="overlay" @click=${this._dismiss}>
        <div class="card" @click=${(e: Event) => e.stopPropagation()}>
          ${this.submitted
            ? html`
                <div class="thank-you">
                  <span class="emoji">🙏</span>
                  <p>Thanks for your feedback!</p>
                </div>
              `
            : html`
                <p class="headline">How's Retrospekt working for you?</p>
                <p class="subtext">Your feedback helps improve the app.</p>

                <div class="emoji-row">
                  ${EMOJI_SCALE.map(
                    (emoji, i) => html`
                      <button
                        class="emoji-btn ${this.selectedRating === i + 1 ? 'selected' : ''}"
                        aria-label="Rate ${i + 1} out of 5"
                        aria-pressed=${this.selectedRating === i + 1}
                        @click=${() => { this.selectedRating = i + 1 }}
                      >${emoji}</button>
                    `,
                  )}
                </div>

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
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedback-dialog': FeedbackDialog
  }
}
