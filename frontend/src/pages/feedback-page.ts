import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import { storage } from '../storage'
import { faIconStyles } from '../icons'
import '../components/background-blobs'

declare const __APP_VERSION__: string

const EMOJI_SCALE = ['😞', '😕', '😐', '🙂', '😍'] as const

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
        border-radius: 16px;
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

      .emoji-row {
        display: flex;
        justify-content: center;
        gap: 8px;
      }

      .emoji-btn {
        background: none;
        border: 2px solid transparent;
        border-radius: 10px;
        font-size: 28px;
        cursor: pointer;
        padding: 6px 8px;
        line-height: 1;
        transition: transform 0.1s, border-color 0.1s;
      }

      .emoji-btn:hover {
        transform: scale(1.15);
      }

      .emoji-btn.selected {
        border-color: var(--retro-accent);
        background: color-mix(in srgb, var(--retro-accent) 10%, transparent);
      }

      textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--retro-border-default);
        border-radius: 8px;
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
        border-radius: 8px;
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

      .thank-you .big {
        font-size: 36px;
        display: block;
        margin-bottom: 8px;
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
      <background-blobs></background-blobs>
      <div class="content">
        <a class="brand" href="/">🥓 Retro<em>spekt</em></a>
        <div class="card">
          ${this.submitted
            ? html`
                <div class="thank-you">
                  <span class="big">🎉</span>
                  Thanks for your feedback!
                </div>
              `
            : html`
                <p class="headline">How's Retrospekt working for you?</p>
                <div class="emoji-row">
                  ${EMOJI_SCALE.map(
                    (emoji, i) => html`
                      <button
                        class="emoji-btn ${this.selectedRating === i + 1 ? 'selected' : ''}"
                        @click=${() => { this.selectedRating = i + 1 }}
                      >${emoji}</button>
                    `,
                  )}
                </div>
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
