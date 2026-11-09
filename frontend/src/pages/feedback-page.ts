import { LitElement, css, html } from 'lit'
import { baseStyles } from '../styles'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import { storage } from '../storage'
import '../components/rating-stars'

@customElement('feedback-page')
export class FeedbackPage extends LitElement {
  @state() private selectedRating = 0
  @state() private comment = ''
  @state() private submitting = false
  @state() private submitted = false

  private get participantName(): string {
    return storage.getHistory()[0]?.participantName ?? ''
  }

  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--retro-bg-page);
      }

      .page {
        padding: 32px 0;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .page-header {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 0 32px;
      }

      .back-link {
        color: var(--retro-accent-ink);
        text-decoration: none;
        font-size: 13px;
        white-space: nowrap;
      }

      .back-link:hover {
        text-decoration: underline;
      }

      .page-title {
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--retro-text-primary);
      }

      .card-wrap {
        display: flex;
        justify-content: center;
        margin-top: 24px;
        padding: 0 16px;
      }

      .card {
        width: 100%;
        max-width: 460px;
        padding: 28px;
        background: var(--retro-glass-bg-strong);
        border: 1px solid var(--retro-glass-border);
        border-radius: var(--retro-radius-lg);
        box-shadow: var(--retro-shadow-float);
      }

      .headline {
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--retro-text-primary);
      }

      .subtext {
        font-size: 13px;
        color: var(--retro-text-secondary);
        margin: 4px 0 20px;
      }

      rating-stars {
        margin-bottom: 18px;
      }

      textarea {
        display: block;
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--retro-border-default);
        border-radius: var(--retro-radius-md);
        background: var(--retro-bg-surface);
        color: var(--retro-text-primary);
        font-family: inherit;
        font-size: 14px;
        resize: none;
        outline: none;
        margin-bottom: 18px;
      }

      textarea::placeholder {
        color: var(--retro-text-muted);
      }

      textarea:focus {
        border-color: var(--retro-accent);
      }

      .submit-btn {
        background: var(--retro-accent);
        color: var(--retro-accent-contrast);
        border: 1px solid var(--retro-accent-border);
        border-radius: var(--retro-radius-sm);
        padding: 9px 18px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        white-space: nowrap;
      }

      .submit-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .thank-you {
        text-align: center;
        padding: 16px 0 8px;
        font-size: 15px;
        color: var(--retro-text-secondary);
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
    `,
  ]

  private async _submit(): Promise<void> {
    if (this.selectedRating < 1 || this.submitting) return
    this.submitting = true
    try {
      await api.submitFeedback(
        this.selectedRating,
        this.comment,
        undefined,
        this.participantName || undefined,
      )
      this.submitted = true
    } finally {
      this.submitting = false
    }
  }

  render() {
    return html`
      <div class="page">
        <header class="page-header">
          <a class="back-link" href="/">← Back</a>
          <h1 class="page-title">Feedback</h1>
        </header>
        <div class="card-wrap">
          <div class="card">
            ${this.submitted
              ? html`
                  <div class="thank-you">
                    <svg class="thanks-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="20 6 9 17 4 12" /></svg>
                    Thanks for your feedback!
                  </div>
                `
              : html`
                  <h2 class="headline">How's Retrospekt working for you?</h2>
                  <p class="subtext">Your feedback helps improve the app.</p>
                  <rating-stars
                    size="40"
                    .value=${this.selectedRating}
                    @rating-change=${(e: CustomEvent<number>) => { this.selectedRating = e.detail }}
                  ></rating-stars>
                  <textarea
                    rows="4"
                    placeholder="Anything you'd like to share? (optional)"
                    .value=${this.comment}
                    @input=${(e: Event) => { this.comment = (e.target as HTMLTextAreaElement).value }}
                  ></textarea>
                  <button
                    class="submit-btn"
                    ?disabled=${this.selectedRating < 1 || this.submitting}
                    @click=${this._submit}
                  >Send feedback</button>
                `}
          </div>
        </div>
      </div>
    `
  }
}
