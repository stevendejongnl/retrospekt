import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'

import type { Card } from '../types'

@customElement('retro-card')
export class RetroCard extends LitElement {
  @property({ type: Object }) card!: Card
  @property({ type: String }) participantName = ''
  @property({ type: Boolean }) canVote = false
  @property({ type: Boolean }) canDelete = false
  @property({ type: Boolean }) canPublish = false

  static styles = css`
    :host {
      display: block;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
      border-left: 3px solid var(--card-accent, #e85d04);
    }
    .card.draft {
      border-left-style: dashed;
      background: #fafafa;
    }
    .card-text {
      font-size: 14px;
      line-height: 1.55;
      color: #1a1a1a;
      margin-bottom: 10px;
      word-break: break-word;
    }
    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .card-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .card-author {
      font-size: 11px;
      color: #aaa;
      font-weight: 500;
      letter-spacing: 0.2px;
    }
    .draft-badge {
      font-size: 10px;
      font-weight: 700;
      color: #bbb;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid #e8e8e8;
      border-radius: 4px;
      padding: 1px 5px;
    }
    .card-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .vote-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: 1px solid #e8e8e8;
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 12px;
      cursor: pointer;
      color: #666;
      transition: all 0.12s ease;
      font-family: inherit;
    }
    .vote-btn:hover:not(:disabled) {
      border-color: var(--card-accent, #e85d04);
      color: var(--card-accent, #e85d04);
      background: color-mix(in srgb, var(--card-accent, #e85d04) 8%, transparent);
    }
    .vote-btn.voted {
      background: var(--card-accent, #e85d04);
      border-color: var(--card-accent, #e85d04);
      color: white;
    }
    .vote-btn:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .publish-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--card-accent, #e85d04);
      border: none;
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      color: white;
      font-family: inherit;
      transition: opacity 0.12s ease;
    }
    .publish-btn:hover {
      opacity: 0.85;
    }
    .delete-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #d0d0d0;
      font-size: 16px;
      line-height: 1;
      padding: 2px 4px;
      border-radius: 4px;
      transition: color 0.12s;
    }
    .delete-btn:hover {
      color: #ef4444;
    }
  `

  private get hasVoted(): boolean {
    return this.card.votes.some((v) => v.participant_name === this.participantName)
  }

  private onVoteClick(): void {
    const type = this.hasVoted ? 'unvote' : 'vote'
    this.dispatchEvent(
      new CustomEvent(type, {
        detail: { cardId: this.card.id },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private onDeleteClick(): void {
    this.dispatchEvent(
      new CustomEvent('delete-card', {
        detail: { cardId: this.card.id },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private onPublishClick(): void {
    this.dispatchEvent(
      new CustomEvent('publish-card', {
        detail: { cardId: this.card.id },
        bubbles: true,
        composed: true,
      }),
    )
  }

  render() {
    const { card, canVote, canDelete, canPublish } = this
    return html`
      <div class="card ${canPublish ? 'draft' : ''}">
        <p class="card-text">${card.text}</p>
        <div class="card-footer">
          <div class="card-meta">
            <span class="card-author">${card.author_name}</span>
            ${canPublish ? html`<span class="draft-badge">draft</span>` : ''}
          </div>
          <div class="card-actions">
            ${canPublish
              ? html`
                  <button class="publish-btn" @click=${this.onPublishClick} title="Publish card">
                    Publish
                  </button>
                `
              : html`
                  <button
                    class="vote-btn ${this.hasVoted ? 'voted' : ''}"
                    ?disabled=${!canVote}
                    @click=${this.onVoteClick}
                    title="${this.hasVoted ? 'Remove vote' : 'Vote'}"
                  >
                    👍 ${card.votes.length}
                  </button>
                `}
            ${canDelete
              ? html`<button class="delete-btn" @click=${this.onDeleteClick} title="Delete card">
                  ×
                </button>`
              : ''}
          </div>
        </div>
      </div>
    `
  }
}
