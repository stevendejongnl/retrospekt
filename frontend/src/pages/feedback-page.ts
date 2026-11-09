import { LitElement, css, html } from 'lit'
import { baseStyles } from '../styles'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import { storage } from '../storage'
import { faIconStyles } from '../icons'
import '../components/rating-stars'
import { bacon } from '../theme'

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
    faIconStyles,
    css`
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: var(--retro-bg-page);
        padding: 24px;
        position: relative;
        overflow: hidden;
      }

      .content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        width: 100%;
        max-width: 420px;
      }

      .brand {
        font-size: 20px;
        font-weight: 700;
        color: var(--retro-text-primary);
        margin-bottom: 32px;
        text-decoration: none;
      }

      .brand em {
        font-style: normal;
        color: var(--retro-accent);
      }

      .card {
        background: var(--retro-bg-surface);
        border: 1px solid var(--retro-border-default);
        border-radius: var(--retro-radius-lg);
        padding: 28px 28px 24px;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .headline {
        font-size: 17px;
        font-weight: 700;
        color: var(--retro-text-primary);
        margin: 0;
        text-align: center;
      }

      textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--retro-border-default);
        border-radius: var(--retro-radius-sm);
        padding: 10px 12px;
        font-size: 13px;
        font-family: inherit;
        resize: vertical;
        min-height: 72px;
        background: var(--retro-bg-page);
        color: var(--retro-text-primary);
      }

      textarea:focus {
        outline: none;
        border-color: var(--retro-accent);
      }

      .submit-btn {
        background: var(--retro-accent);
        color: #fff;
        border: none;
        border-radius: var(--retro-radius-sm);
        padding: 10px 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: opacity 0.15s;
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

      .back-link {
        margin-top: 20px;
        font-size: 13px;
        color: var(--retro-text-muted);
        text-decoration: none;
      }

      .back-link:hover {
        color: var(--retro-accent);
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
      <div class="content">
        <a class="brand" href="/">${bacon()} Retro<em>spekt</em></a>
        <div class="card">
          ${this.submitted
            ? html`
                <div class="thank-you">
                  <svg class="thanks-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="20 6 9 17 4 12" /></svg>
                  Thanks for your feedback!
                </div>
              `
            : html`
                <p class="headline">How's Retrospekt working for you?</p>
                <rating-stars
                  size="40"
                  .value=${this.selectedRating}
                  @rating-change=${(e: CustomEvent<number>) => { this.selectedRating = e.detail }}
                ></rating-stars>
                <textarea
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
        <a class="back-link" href="/">← Back to home</a>
      </div>
    `
  }
}
