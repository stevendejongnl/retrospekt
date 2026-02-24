import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'

import type { Card } from '../types'
import { faIconStyles, iconThumbsUp } from '../icons'

const REACTION_EMOJI = ['❤️', '😂', '😮', '🎉', '🤔', '👀']

@customElement('retro-card')
export class RetroCard extends LitElement {
  @property({ type: Object }) card!: Card
  @property({ type: String }) participantName = ''
  @property({ type: Boolean }) canVote = false
  @property({ type: Boolean }) canDelete = false
  @property({ type: Boolean }) canPublish = false
  @property({ type: Boolean }) canReact = false
  @property({ type: Boolean }) canAssign = false
  @property({ type: Boolean }) reactionsEnabled = true
  @property({ type: Array }) participantNames: string[] = []

  static styles = [faIconStyles, css`
    :host {
      display: block;
    }
    .card {
      background: var(--retro-bg-surface);
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 8px;
      box-shadow: 0 1px 3px var(--retro-card-shadow), 0 1px 2px var(--retro-card-shadow);
      border-left: 3px solid var(--card-accent, #e85d04);
    }
    .card.draft {
      border-left-style: dashed;
      background: var(--retro-bg-subtle);
    }
    .card-text {
      font-size: 14px;
      line-height: 1.55;
      color: var(--retro-text-primary);
      margin-bottom: 10px;
      word-break: break-word;
    }
    .reactions-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 8px;
    }
    .reaction-btn {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: 12px;
      padding: 2px 7px;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.12s ease;
      line-height: 1.4;
    }
    .reaction-btn:hover:not(:disabled) {
      border-color: var(--card-accent, #e85d04);
      background: color-mix(in srgb, var(--card-accent, #e85d04) 8%, transparent);
    }
    .reaction-btn.reacted {
      background: color-mix(in srgb, var(--card-accent, #e85d04) 15%, transparent);
      border-color: var(--card-accent, #e85d04);
    }
    .reaction-btn:disabled {
      cursor: default;
    }
    .reaction-count {
      font-size: 11px;
      font-weight: 600;
      color: var(--retro-text-secondary);
    }
    .assignee-row {
      margin-bottom: 8px;
    }
    .assignee-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: color-mix(in srgb, var(--retro-accent) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--retro-accent) 30%, transparent);
      border-radius: 12px;
      padding: 2px 8px 2px 8px;
      font-size: 11px;
      color: var(--retro-text-secondary);
      font-weight: 500;
    }
    .unassign-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--retro-text-disabled);
      font-size: 14px;
      line-height: 1;
      padding: 0 1px;
      transition: color 0.12s;
    }
    .unassign-btn:hover {
      color: var(--retro-error);
    }
    .assign-select {
      font-size: 11px;
      padding: 2px 6px;
      border: 1px solid var(--retro-border-default);
      border-radius: 6px;
      background: var(--retro-bg-surface);
      color: var(--retro-text-secondary);
      font-family: inherit;
      cursor: pointer;
    }
    .assign-select:focus {
      outline: none;
      border-color: var(--retro-accent);
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
      color: var(--retro-text-disabled);
      font-weight: 500;
      letter-spacing: 0.2px;
    }
    .draft-badge {
      font-size: 10px;
      font-weight: 700;
      color: var(--retro-text-disabled);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid var(--retro-border-default);
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
      border: 1px solid var(--retro-border-default);
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 12px;
      cursor: pointer;
      color: var(--retro-text-secondary);
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
      color: var(--retro-border-strong);
      font-size: 16px;
      line-height: 1;
      padding: 2px 4px;
      border-radius: 4px;
      transition: color 0.12s;
    }
    .delete-btn:hover {
      color: var(--retro-error);
    }
  `]

  private get hasVoted(): boolean {
    return this.card.votes.some((v) => v.participant_name === this.participantName)
  }

  private get reactionGroups(): { emoji: string; count: number; myReaction: boolean }[] {
    return REACTION_EMOJI.map((emoji) => ({
      emoji,
      count: (this.card.reactions ?? []).filter((r) => r.emoji === emoji).length,
      myReaction: (this.card.reactions ?? []).some(
        (r) => r.emoji === emoji && r.participant_name === this.participantName,
      ),
    })).filter((g) => this.canReact || g.count > 0)
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

  private onReactClick(emoji: string, myReaction: boolean): void {
    const type = myReaction ? 'unreact' : 'react'
    this.dispatchEvent(
      new CustomEvent(type, {
        detail: { cardId: this.card.id, emoji },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private onAssignChange(e: Event): void {
    const assignee = (e.target as HTMLSelectElement).value
    if (!assignee) return
    this.dispatchEvent(
      new CustomEvent('assign-card', {
        detail: { cardId: this.card.id, assignee },
        bubbles: true,
        composed: true,
      }),
    )
    ;(e.target as HTMLSelectElement).value = ''
  }

  private onUnassignClick(): void {
    this.dispatchEvent(
      new CustomEvent('unassign-card', {
        detail: { cardId: this.card.id },
        bubbles: true,
        composed: true,
      }),
    )
  }

  render() {
    const { card, canVote, canDelete, canPublish } = this
    const groups = this.reactionGroups
    return html`
      <div class="card ${canPublish ? 'draft' : ''}">
        <p class="card-text">${card.text}</p>

        ${this.reactionsEnabled && groups.length > 0
          ? html`
              <div class="reactions-row">
                ${groups.map(
                  (g) => html`
                    <button
                      class="reaction-btn ${g.myReaction ? 'reacted' : ''}"
                      style="${this.canReact && g.count === 0 ? 'opacity:0.35' : ''}"
                      ?disabled=${!this.canReact}
                      @click=${() => { if (this.canReact) this.onReactClick(g.emoji, g.myReaction) }}
                      title="${g.emoji}"
                    >
                      ${g.emoji}${g.count > 0
                        ? html`<span class="reaction-count">${g.count}</span>`
                        : ''}
                    </button>
                  `,
                )}
              </div>
            `
          : ''}

        ${this.canAssign || card.assignee
          ? html`
              <div class="assignee-row">
                ${card.assignee
                  ? html`
                      <span class="assignee-chip">
                        Assigned: ${card.assignee}
                        ${this.canAssign
                          ? html`<button class="unassign-btn" @click=${this.onUnassignClick} title="Remove assignee">×</button>`
                          : ''}
                      </span>
                    `
                  : html`
                      <select class="assign-select" @change=${this.onAssignChange}>
                        <option value="">Assign to…</option>
                        ${this.participantNames.map(
                          (name) => html`<option value="${name}">${name}</option>`,
                        )}
                      </select>
                    `}
              </div>
            `
          : ''}

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
                    ${iconThumbsUp()} ${card.votes.length}
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
