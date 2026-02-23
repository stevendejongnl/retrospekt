import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { Card, SessionPhase } from '../types'
import './retro-card'

@customElement('retro-column')
export class RetroColumn extends LitElement {
  @property({ type: String }) title = ''
  @property({ type: Array }) cards: Card[] = []
  @property({ type: String }) participantName = ''
  @property({ type: String }) phase: SessionPhase = 'collecting'
  @property({ type: String }) accent = '#e85d04'

  @state() private newCardText = ''
  @state() private isAdding = false

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 280px;
    }
    .column {
      background: #f4f4f2;
      border-radius: 14px;
      padding: 16px;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .column-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .column-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: #1a1a1a;
      letter-spacing: 0.1px;
    }
    .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .count-badge {
      font-size: 11px;
      font-weight: 600;
      color: white;
      border-radius: 10px;
      padding: 1px 7px;
      min-width: 20px;
      text-align: center;
    }
    .cards-list {
      flex: 1;
      overflow-y: auto;
      min-height: 100px;
    }
    .add-area {
      margin-top: 12px;
    }
    .add-btn {
      width: 100%;
      background: none;
      border: 1.5px dashed #ccc;
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      color: #999;
      font-size: 13px;
      font-family: inherit;
      transition: all 0.12s;
    }
    .add-btn:hover {
      border-color: var(--col-accent);
      color: var(--col-accent);
    }
    .add-form {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1.5px solid #ddd;
      border-radius: 8px;
      font-size: 13px;
      font-family: inherit;
      resize: vertical;
      min-height: 76px;
      box-sizing: border-box;
      line-height: 1.5;
      transition: border-color 0.12s;
    }
    textarea:focus {
      outline: none;
      border-color: var(--col-accent);
    }
    .form-row {
      display: flex;
      gap: 6px;
    }
    .btn-submit {
      background: var(--col-accent);
      color: white;
      border: none;
      border-radius: 7px;
      padding: 7px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-cancel {
      background: none;
      border: 1.5px solid #ddd;
      border-radius: 7px;
      padding: 7px 14px;
      font-size: 13px;
      cursor: pointer;
      color: #666;
      font-family: inherit;
    }
    .hint {
      font-size: 11px;
      color: #bbb;
      text-align: right;
    }
  `

  private async submitCard(): Promise<void> {
    const text = this.newCardText.trim()
    if (!text || !this.participantName) return

    this.dispatchEvent(
      new CustomEvent('add-card', {
        detail: { column: this.title, text, authorName: this.participantName },
        bubbles: true,
        composed: true,
      }),
    )

    this.newCardText = ''
    this.isAdding = false
  }

  private onTextKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void this.submitCard()
    }
    if (e.key === 'Escape') {
      this.newCardText = ''
      this.isAdding = false
    }
  }

  private get visibleCards(): Card[] {
    if (this.phase === 'collecting') {
      // During collection, each participant only sees their own cards
      return this.cards.filter((c) => c.author_name === this.participantName)
    }
    // During discussing/closed: published cards are visible to all;
    // unpublished cards are only visible to their author
    return this.cards.filter((c) => c.published || c.author_name === this.participantName)
  }

  render() {
    const canAdd = this.phase === 'collecting' && !!this.participantName
    const accentStyle = `--col-accent: ${this.accent};`
    const visible = this.visibleCards

    return html`
      <div class="column" style=${accentStyle}>
        <div class="column-header">
          <span class="column-title">
            <span class="dot" style="background:${this.accent}"></span>
            ${this.title}
          </span>
          <span class="count-badge" style="background:${this.accent}">${visible.length}</span>
        </div>

        <div class="cards-list">
          ${visible.map(
            (card) => html`
              <retro-card
                .card=${card}
                .participantName=${this.participantName}
                ?canVote=${this.phase === 'discussing' &&
                card.published &&
                card.author_name !== this.participantName}
                ?canDelete=${card.author_name === this.participantName &&
                this.phase === 'collecting'}
                ?canPublish=${this.phase === 'discussing' &&
                !card.published &&
                card.author_name === this.participantName}
                style="--card-accent:${this.accent}"
              ></retro-card>
            `,
          )}
        </div>

        ${canAdd
          ? html`
              <div class="add-area">
                ${this.isAdding
                  ? html`
                      <div class="add-form">
                        <textarea
                          .value=${this.newCardText}
                          placeholder="What's on your mind? (⌘↵ to add)"
                          @input=${(e: Event) => {
                            this.newCardText = (e.target as HTMLTextAreaElement).value
                          }}
                          @keydown=${this.onTextKeydown}
                          autofocus
                        ></textarea>
                        <div class="form-row">
                          <button
                            class="btn-submit"
                            @click=${this.submitCard}
                            ?disabled=${!this.newCardText.trim()}
                          >
                            Add card
                          </button>
                          <button
                            class="btn-cancel"
                            @click=${() => {
                              this.isAdding = false
                              this.newCardText = ''
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    `
                  : html`
                      <button class="add-btn" @click=${() => (this.isAdding = true)}>
                        + Add a card
                      </button>
                    `}
              </div>
            `
          : ''}
      </div>
    `
  }
}
