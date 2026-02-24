import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { Card, SessionPhase } from '../types'
import './retro-card'

const isMac = navigator.platform.startsWith('Mac') || navigator.userAgent.includes('Mac')
const modKey = isMac ? '⌘' : 'Ctrl'

@customElement('retro-column')
export class RetroColumn extends LitElement {
  @property({ type: String }) title = ''
  @property({ type: Array }) cards: Card[] = []
  @property({ type: String }) participantName = ''
  @property({ type: String }) phase: SessionPhase = 'collecting'
  @property({ type: String }) accent = '#e85d04'
  @property({ type: Boolean }) isFacilitator = false
  @property({ type: Object }) participantColorMap: Record<string, string> = {}

  @state() private newCardText = ''
  @state() private isAdding = false
  @state() private editingTitle = false
  @state() private editTitleValue = ''

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 280px;
    }
    .column {
      background: var(--retro-bg-subtle);
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
      color: var(--retro-text-primary);
      letter-spacing: 0.1px;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 6px;
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
    .publish-all-btn {
      background: none;
      border: 1.5px solid var(--col-accent);
      border-radius: 8px;
      padding: 2px 9px;
      font-size: 11px;
      font-weight: 600;
      color: var(--col-accent);
      cursor: pointer;
      font-family: inherit;
      transition: all 0.12s;
      white-space: nowrap;
    }
    .publish-all-btn:hover {
      background: var(--col-accent);
      color: white;
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
      border: 1.5px dashed var(--retro-border-strong);
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      color: var(--retro-text-muted);
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
      border: 1.5px solid var(--retro-border-default);
      border-radius: 8px;
      font-size: 13px;
      font-family: inherit;
      resize: vertical;
      min-height: 76px;
      box-sizing: border-box;
      line-height: 1.5;
      transition: border-color 0.12s;
      color: var(--retro-text-primary);
      background: var(--retro-bg-surface);
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
      border: 1.5px solid var(--retro-border-default);
      border-radius: 7px;
      padding: 7px 14px;
      font-size: 13px;
      cursor: pointer;
      color: var(--retro-text-secondary);
      font-family: inherit;
    }
    .hint {
      font-size: 11px;
      color: var(--retro-text-disabled);
      text-align: right;
    }
    .title-input {
      font-size: 14px;
      font-weight: 700;
      color: var(--retro-text-primary);
      border: 1.5px solid var(--col-accent);
      border-radius: 6px;
      padding: 1px 6px;
      background: var(--retro-bg-surface);
      font-family: inherit;
      width: 100%;
      min-width: 0;
    }
    .title-input:focus {
      outline: none;
    }
    .delete-col-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      color: var(--retro-text-disabled);
      padding: 0 2px;
      line-height: 1;
      transition: color 0.12s;
      flex-shrink: 0;
    }
    .delete-col-btn:hover {
      color: var(--retro-accent);
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

  private get hasUnpublishedCards(): boolean {
    return this.cards.some((c) => c.author_name === this.participantName && !c.published)
  }

  private onPublishAllClick(): void {
    this.dispatchEvent(
      new CustomEvent('publish-all-cards', {
        detail: { column: this.title },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private startEditTitle(): void {
    this.editTitleValue = this.title
    this.editingTitle = true
  }

  private commitTitleEdit(): void {
    const newName = this.editTitleValue.trim()
    this.editingTitle = false
    if (!newName || newName === this.title) return
    this.dispatchEvent(
      new CustomEvent('rename-column', {
        detail: { oldName: this.title, newName },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private onTitleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.commitTitleEdit()
    if (e.key === 'Escape') this.editingTitle = false
  }

  private onRemoveColumn(): void {
    this.dispatchEvent(
      new CustomEvent('remove-column', {
        detail: { column: this.title },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private get visibleCards(): Card[] {
    if (this.phase === 'collecting') {
      // During collection, each participant only sees their own cards
      return this.cards.filter((c) => c.author_name === this.participantName)
    }
    // During discussing/closed: published cards are visible to all;
    // unpublished cards are only visible to their author
    const visible = this.cards.filter((c) => c.published || c.author_name === this.participantName)
    if (this.phase === 'closed') {
      return [...visible].sort((a, b) => b.votes.length - a.votes.length)
    }
    return visible
  }

  render() {
    const canAdd = this.phase === 'collecting' && !!this.participantName
    const accentStyle = `--col-accent: ${this.accent};`
    const visible = this.visibleCards

    return html`
      <div class="column" style=${accentStyle}>
        <div class="column-header">
          <span class="column-title" style="flex:1;min-width:0;">
            ${this.isFacilitator && this.phase === 'collecting'
              ? this.editingTitle
                ? html`<input
                    class="title-input"
                    .value=${this.editTitleValue}
                    @input=${(e: Event) => {
                      this.editTitleValue = (e.target as HTMLInputElement).value
                    }}
                    @blur=${this.commitTitleEdit}
                    @keydown=${this.onTitleKeydown}
                    @click=${(e: Event) => e.stopPropagation()}
                  />`
                : html`<span style="cursor:pointer" @click=${this.startEditTitle}>${this.title}</span>`
              : this.title}
          </span>
          <div class="header-right">
            ${this.phase === 'discussing' && this.hasUnpublishedCards
              ? html`<button class="publish-all-btn" @click=${this.onPublishAllClick}>Publish all</button>`
              : ''}
            ${this.isFacilitator && this.phase === 'collecting'
              ? html`<button class="delete-col-btn" @click=${this.onRemoveColumn} title="Remove column">×</button>`
              : ''}
            <span class="count-badge" style="background:${this.accent}">${visible.length}</span>
          </div>
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
                style="--card-accent:${this.participantColorMap[card.author_name] ?? '#6b7280'}"
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
                          placeholder=${`What's on your mind? (${modKey}↵ to add)`}
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
