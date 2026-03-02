import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { Card } from '../types'
import type { JiraConfig } from '../storage'
import { storage } from '../storage'
import { faIconStyles, iconThumbsUp } from '../icons'

// Module-level fallback for Firefox, which clears dataTransfer between events
let _draggedCardId: string | null = null
let _draggedCardColumn: string | null = null

export function getDraggedCardInfo(): { id: string | null; column: string | null } {
  return { id: _draggedCardId, column: _draggedCardColumn }
}

export function buildJiraProjectUrl(config: JiraConfig): string {
  const base = config.baseUrl.replace(/\/$/, '')
  return `${base}/browse/${config.projectKey}`
}

export function formatJiraDescription(card: Card, sessionName: string): string {
  return `Retrospective: ${sessionName}\nColumn: ${card.column}\n\n${card.text}`
}

const REACTION_EMOJI = ['❤️', '😂', '😮', '🎉', '🤔', '👀', '🥓']

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
  @property({ type: String }) sessionName = ''

  @property({ type: Boolean }) canEdit = false
  @property({ type: Boolean }) canGroup = false

  @state() private menuOpen = false
  @state() private isDragOver = false
  @state() private jiraDialogOpen = false
  @state() private summaryCopied = false
  @state() private descCopied = false
  @state() private editing = false
  @state() private editText = ''

  private readonly _outsideClickHandler = (e: MouseEvent): void => {
    if (!e.composedPath().includes(this)) {
      this.menuOpen = false
    }
  }

  connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('click', this._outsideClickHandler)
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    document.removeEventListener('click', this._outsideClickHandler)
  }

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
    .card.drag-over {
      outline: 2px dashed var(--retro-accent);
      outline-offset: 2px;
    }
    .card-text {
      font-size: 14px;
      line-height: 1.55;
      color: var(--retro-text-primary);
      margin-bottom: 10px;
      word-break: break-word;
    }
    .card-text.editable {
      cursor: pointer;
    }
    .card-text.editable:hover {
      text-decoration: underline dotted var(--retro-text-muted);
    }
    .card-edit-input {
      width: 100%;
      box-sizing: border-box;
      font-size: 14px;
      line-height: 1.55;
      font-family: inherit;
      color: var(--retro-text-primary);
      background: var(--retro-bg-surface);
      border: 1.5px solid var(--card-accent, #e85d04);
      border-radius: 6px;
      padding: 4px 8px;
      margin-bottom: 10px;
      resize: none;
      outline: none;
      overflow: hidden;
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
    .menu-wrapper {
      position: relative;
    }
    .menu-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--retro-border-strong);
      font-size: 16px;
      line-height: 1;
      padding: 2px 4px;
      border-radius: 4px;
      transition: color 0.12s;
      font-family: inherit;
    }
    .menu-btn:hover {
      color: var(--retro-text-secondary);
    }
    .card-menu {
      position: absolute;
      right: 0;
      bottom: calc(100% + 4px);
      background: var(--retro-bg-surface);
      border: 1px solid var(--retro-border-default);
      border-radius: 8px;
      box-shadow: 0 4px 16px var(--retro-card-shadow);
      min-width: 150px;
      z-index: 50;
      overflow: hidden;
    }
    .jira-export-btn {
      display: block;
      width: 100%;
      padding: 9px 14px;
      font-size: 13px;
      font-family: inherit;
      text-align: left;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--retro-text-primary);
      transition: background 0.1s;
    }
    .jira-export-btn:hover {
      background: var(--retro-bg-subtle);
    }
    .jira-dialog-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
    }
    .jira-dialog {
      background: var(--retro-bg-surface);
      border: 1px solid var(--retro-border-default);
      border-radius: 12px;
      padding: 20px 24px;
      width: min(420px, 90vw);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    }
    .jira-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .jira-dialog-header span {
      font-size: 15px;
      font-weight: 600;
      color: var(--retro-text-primary);
    }
    .jira-dialog-close {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      color: var(--retro-text-disabled);
      padding: 2px 6px;
      border-radius: 4px;
      transition: color 0.12s;
    }
    .jira-dialog-close:hover {
      color: var(--retro-text-primary);
    }
    .jira-field-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--retro-text-disabled);
      margin-bottom: 6px;
    }
    .jira-field-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 14px;
    }
    .jira-summary-text {
      flex: 1;
      font-size: 14px;
      color: var(--retro-text-primary);
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: 6px;
      padding: 6px 10px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .jira-desc {
      width: 100%;
      box-sizing: border-box;
      font-size: 13px;
      font-family: inherit;
      color: var(--retro-text-primary);
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: 6px;
      padding: 8px 10px;
      resize: none;
      height: 100px;
      margin-bottom: 8px;
    }
    .jira-copy-btn {
      font-size: 12px;
      font-family: inherit;
      padding: 4px 10px;
      border: 1px solid var(--retro-border-default);
      border-radius: 6px;
      background: var(--retro-bg-surface);
      color: var(--retro-text-secondary);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.12s;
    }
    .jira-copy-btn:hover {
      border-color: var(--retro-accent);
      color: var(--retro-accent);
    }
    .jira-dialog-footer {
      margin-top: 16px;
      display: flex;
      justify-content: flex-end;
    }
    .jira-open-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 13px;
      font-family: inherit;
      font-weight: 600;
      padding: 7px 14px;
      background: var(--retro-accent);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      transition: opacity 0.12s;
    }
    .jira-open-btn:hover {
      opacity: 0.85;
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

  private onTextClick(): void {
    if (!this.canEdit) return
    this.editText = this.card.text
    this.editing = true
    void this.updateComplete.then(() => {
      (this.shadowRoot?.querySelector('.card-edit-input') as HTMLElement | null)?.focus()
    })
  }

  private onEditKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      this._saveEdit()
    } else if (e.key === 'Escape') {
      this.editing = false
    }
  }

  private _saveEdit(): void {
    const text = this.editText.trim()
    if (text && text !== this.card.text) {
      this.dispatchEvent(
        new CustomEvent('edit-card', {
          detail: { cardId: this.card.id, text },
          bubbles: true,
          composed: true,
        }),
      )
    }
    this.editing = false
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
      ; (e.target as HTMLSelectElement).value = ''
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

  private _onDragStart(e: DragEvent): void {
    _draggedCardId = this.card.id
    _draggedCardColumn = this.card.column
    e.dataTransfer?.setData('text/plain', this.card.id)
  }

  private _onDragOver(e: DragEvent): void {
    const sourceId = e.dataTransfer?.getData('text/plain') || _draggedCardId
    if (sourceId && sourceId !== this.card.id && _draggedCardColumn === this.card.column) {
      e.preventDefault()
      this.isDragOver = true
    }
  }

  private _onDragLeave(): void {
    this.isDragOver = false
  }

  private _onDrop(e: DragEvent): void {
    e.preventDefault()
    this.isDragOver = false
    const sourceId = e.dataTransfer?.getData('text/plain') ?? _draggedCardId
    if (sourceId && sourceId !== this.card.id && _draggedCardColumn === this.card.column) {
      this.dispatchEvent(new CustomEvent('group-cards', {
        bubbles: true,
        composed: true,
        detail: { cardId: sourceId, targetCardId: this.card.id },
      }))
    }
    _draggedCardId = null
    _draggedCardColumn = null
  }

  private onJiraExport(): void {
    this.menuOpen = false
    this.jiraDialogOpen = true
  }

  private async onCopySummary(): Promise<void> {
    await navigator.clipboard.writeText(this.card.text)
    this.summaryCopied = true
    setTimeout(() => { this.summaryCopied = false; this.requestUpdate() }, 1500)
  }

  private async onCopyDesc(): Promise<void> {
    await navigator.clipboard.writeText(formatJiraDescription(this.card, this.sessionName))
    this.descCopied = true
    setTimeout(() => { this.descCopied = false; this.requestUpdate() }, 1500)
  }

  private _renderJiraDialog(jiraConfig: ReturnType<typeof storage.getJiraConfig>) {
    /* istanbul ignore next */
    if (!jiraConfig) return ''
    const description = formatJiraDescription(this.card, this.sessionName)
    return html`
      <div class="jira-dialog-overlay" @click=${() => { this.jiraDialogOpen = false }}>
        <div class="jira-dialog" @click=${(e: Event) => e.stopPropagation()}>
          <div class="jira-dialog-header">
            <span>Export to Jira</span>
            <button class="jira-dialog-close" @click=${() => { this.jiraDialogOpen = false }}>×</button>
          </div>

          <p class="jira-field-label">Summary</p>
          <div class="jira-field-row">
            <span class="jira-summary-text">${this.card.text}</span>
            <button class="jira-copy-btn jira-copy-summary" @click=${this.onCopySummary}>
              ${this.summaryCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <p class="jira-field-label">Description</p>
          <textarea class="jira-desc" readonly>${description}</textarea>
          <div style="display:flex;justify-content:flex-end">
            <button class="jira-copy-btn jira-copy-desc" @click=${this.onCopyDesc}>
              ${this.descCopied ? 'Copied!' : 'Copy description'}
            </button>
          </div>

          <div class="jira-dialog-footer">
            <a class="jira-open-btn" href=${buildJiraProjectUrl(jiraConfig)} target="_blank" rel="noopener">
              Open Jira ↗
            </a>
          </div>
        </div>
      </div>
    `
  }

  render() {
    const { card, canVote, canDelete, canPublish } = this
    const groups = this.reactionGroups
    const jiraConfig = storage.getJiraConfig()
    const showMenu = !canPublish && !!jiraConfig
    return html`
      <div
        class="card ${canPublish ? 'draft' : ''} ${this.isDragOver ? 'drag-over' : ''}"
        draggable=${this.canGroup ? 'true' : 'false'}
        @dragstart=${this._onDragStart}
        @dragover=${this._onDragOver}
        @dragleave=${this._onDragLeave}
        @drop=${this._onDrop}
      >
        ${this.editing
          ? html`<textarea
              class="card-edit-input"
              .value=${this.editText}
              rows="3"
              @input=${(e: Event) => { this.editText = (e.target as HTMLTextAreaElement).value }}
              @keydown=${this.onEditKeydown}
              @blur=${() => { if (this.editing) this._saveEdit() }}
            ></textarea>`
          : html`<p
              class="card-text ${this.canEdit ? 'editable' : ''}"
              @click=${this.onTextClick}
            >${card.text}</p>`}

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
            ${showMenu
        ? html`
                  <div class="menu-wrapper">
                    <button
                      class="menu-btn"
                      title="More actions"
                      @click=${(e: Event) => {
            e.stopPropagation()
            this.menuOpen = !this.menuOpen
          }}
                    >⋮</button>
                    ${this.menuOpen
            ? html`
                          <div class="card-menu">
                            <button class="jira-export-btn" @click=${this.onJiraExport}>
                              Export to Jira
                            </button>
                          </div>
                        `
            : ''}
                  </div>
                `
        : ''}
          </div>
        </div>
      </div>
      ${this.jiraDialogOpen ? this._renderJiraDialog(jiraConfig) : ''}
    `
  }
}
