import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { Note } from '../types'
import { api } from '../api'
import { faIconStyles, designIcon } from '../icons'
import { baseStyles } from '../styles'

const CHECKLIST_LINE = /^- \[([ xX])\] (.*)$/

export function parseChecklistLine(line: string): { checked: boolean; label: string } | null {
  const match = CHECKLIST_LINE.exec(line)
  if (!match) return null
  return { checked: match[1].toLowerCase() === 'x', label: match[2] }
}

export function toggleChecklistLine(text: string, lineIndex: number): string {
  const lines = text.split('\n')
  const parsed = parseChecklistLine(lines[lineIndex] ?? '')
  if (!parsed) return text
  lines[lineIndex] = `- [${parsed.checked ? ' ' : 'x'}] ${parsed.label}`
  return lines.join('\n')
}

@customElement('board-notes')
export class BoardNotes extends LitElement {
  @property({ type: Boolean }) open = false
  @property({ type: Array }) notes: Note[] = []
  @property({ type: String }) participantName = ''
  @property({ type: String }) sessionId = ''

  @state() private newNoteTitle = ''
  @state() private newNoteText = ''
  @state() private editingNoteId: string | null = null
  @state() private editTitle = ''
  @state() private editText = ''

  static styles = [baseStyles, faIconStyles, css`
    :host {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 300;
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: transparent;
      transition: background 0.25s;
      pointer-events: none;
    }
    .backdrop.visible {
      background: var(--retro-scrim-bg);
      pointer-events: all;
    }

    .sidebar {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 340px;
      background: var(--retro-glass-bg-strong);
      border-left: 1px solid var(--retro-glass-border);
      box-shadow: none;
      transform: translateX(100%);
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s;
      display: flex;
      flex-direction: column;
      pointer-events: all;
      overflow: hidden;
    }
    .sidebar.open {
      transform: translateX(0);
      box-shadow: var(--retro-shadow-float);
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--retro-border-default);
      flex-shrink: 0;
    }
    .sidebar-title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: var(--retro-text-primary);
    }
    .sidebar-title .icon {
      color: var(--retro-accent-ink);
      display: inline-flex;
    }
    .close-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 20px;
      color: var(--retro-text-secondary);
      font-family: inherit;
      padding: 0;
    }

    .notes-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .note-item {
      border: 1px solid var(--retro-border-default);
      background: var(--retro-bg-subtle);
      border-radius: var(--retro-radius-md);
      padding: 10px 12px;
      position: relative;
    }
    .note-item.editing {
      border-color: color-mix(in srgb, var(--retro-accent) 50%, transparent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--retro-accent) 12%, transparent);
    }

    .note-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .note-author {
      font-size: 11px;
      font-weight: 600;
      color: var(--retro-text-muted);
    }
    .delete-note-btn {
      border: none;
      background: none;
      cursor: pointer;
      font-size: 15px;
      font-family: inherit;
      color: var(--retro-text-muted);
      padding: 0;
    }
    .delete-note-btn:hover {
      color: var(--retro-error);
    }

    .note-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--retro-text-primary);
      margin-bottom: 4px;
      cursor: pointer;
    }

    .note-text {
      font-size: 13px;
      color: var(--retro-text-secondary);
      line-height: 1.5;
      cursor: pointer;
      word-break: break-word;
    }

    .checklist-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 2px 0;
      font-size: 13px;
      line-height: normal;
    }
    .checklist-row input[type='checkbox'] {
      margin: 0;
    }
    .checklist-row.checked .checklist-label {
      text-decoration: line-through;
    }

    .note-edit-title-input {
      display: block;
      width: 100%;
      font-size: 13px;
      font-weight: 700;
      font-family: inherit;
      color: var(--retro-text-primary);
      background: none;
      border: none;
      padding: 0;
      margin-bottom: 4px;
      outline: none;
    }
    .note-edit-title-input::placeholder {
      font-weight: 400;
      color: var(--retro-text-muted);
    }

    .note-edit-textarea,
    .add-note-textarea {
      width: 100%;
      font-size: 13px;
      font-family: inherit;
      color: var(--retro-text-primary);
      background: var(--retro-input-bg);
      border: 1px solid var(--retro-input-border);
      border-radius: var(--retro-radius-md);
      padding: 10px 12px;
      resize: none;
      outline: none;
    }
    .note-edit-textarea {
      margin-bottom: 8px;
    }
    .add-note-textarea::placeholder,
    .add-note-title-input::placeholder {
      color: var(--retro-text-muted);
    }
    .note-edit-textarea:focus,
    .add-note-textarea:focus,
    .add-note-title-input:focus {
      border-color: color-mix(in srgb, var(--retro-accent) 55%, transparent);
    }

    .note-edit-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }
    .note-save-btn,
    .note-cancel-btn,
    .add-note-btn {
      padding: 5px 12px;
      border-radius: var(--retro-radius-sm);
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
    }
    .note-save-btn,
    .add-note-btn {
      background: var(--retro-accent);
      border: 1px solid var(--retro-accent);
      color: var(--retro-accent-contrast);
      font-weight: 600;
    }
    .note-save-btn:hover,
    .add-note-btn:hover {
      background: var(--retro-accent-hover);
    }
    .note-cancel-btn {
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      color: var(--retro-text-primary);
      font-weight: 500;
    }
    .note-cancel-btn:hover {
      border-color: var(--retro-accent);
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      text-align: center;
      gap: 10px;
    }
    .empty-icon {
      font-size: 28px;
      color: var(--retro-border-default);
    }
    .empty-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--retro-text-muted);
    }
    .empty-sub {
      font-size: 12px;
      line-height: 1.5;
      color: var(--retro-text-disabled);
    }

    .add-note-form {
      padding: 12px;
      border-top: 1px solid var(--retro-border-default);
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .add-note-title-input {
      display: block;
      width: 100%;
      font-size: 13px;
      font-family: inherit;
      color: var(--retro-text-primary);
      background: var(--retro-input-bg);
      border: 1px solid var(--retro-input-border);
      border-radius: var(--retro-radius-md);
      padding: 7px 10px;
      outline: none;
    }
    .add-note-footer {
      display: flex;
      justify-content: flex-end;
    }
    .add-note-btn[aria-disabled='true'] {
      cursor: default;
    }
  `]

  private close(): void {
    this.dispatchEvent(new CustomEvent('close'))
  }

  private async addNote(): Promise<void> {
    const text = this.newNoteText.trim()
    if (!text) return
    const title = this.newNoteTitle.trim()
    this.newNoteTitle = ''
    this.newNoteText = ''
    await api.addNote(this.sessionId, text, this.participantName, title || undefined)
  }

  private onAddKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      void this.addNote()
    } else if (e.key === 'Escape') {
      this.newNoteTitle = ''
      this.newNoteText = ''
    }
  }

  private startEdit(note: Note): void {
    this.editingNoteId = note.id
    this.editTitle = note.title ?? ''
    this.editText = note.text
  }

  private async saveEdit(noteId: string): Promise<void> {
    if (this.editingNoteId !== noteId) return
    const text = this.editText.trim()
    const title = this.editTitle.trim()
    this.editingNoteId = null
    if (text) {
      await api.updateNote(this.sessionId, noteId, text, this.participantName, title || undefined)
    }
  }

  private cancelEdit(): void {
    this.editingNoteId = null
  }

  private onEditKeydown(e: KeyboardEvent, noteId: string): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void this.saveEdit(noteId)
    } else if (e.key === 'Escape') {
      this.cancelEdit()
    }
  }

  private async deleteNote(noteId: string): Promise<void> {
    await api.deleteNote(this.sessionId, noteId, this.participantName)
  }

  private async toggleChecklistItem(note: Note, lineIndex: number): Promise<void> {
    const text = toggleChecklistLine(note.text, lineIndex)
    await api.updateNote(this.sessionId, note.id, text, this.participantName, note.title ?? undefined)
  }

  private renderNoteBody(note: Note) {
    const lines = note.text.split('\n')
    if (!lines.some(line => parseChecklistLine(line))) {
      return html`<div class="note-text" @click=${() => this.startEdit(note)} title="Click to edit">${note.text}</div>`
    }
    return html`
      <div class="note-text" title="Click a line to edit">
        ${lines.map((line, i) => {
          const item = parseChecklistLine(line)
          if (!item) return html`<div @click=${() => this.startEdit(note)}>${line}</div>`
          return html`
            <div class="checklist-row ${item.checked ? 'checked' : ''}">
              <input
                type="checkbox"
                .checked=${item.checked}
                @click=${(e: Event) => e.stopPropagation()}
                @change=${() => this.toggleChecklistItem(note, i)}
              />
              <span class="checklist-label" @click=${() => this.startEdit(note)}>${item.label}</span>
            </div>
          `
        })}
      </div>
    `
  }

  render() {
    return html`
      <div class="backdrop ${this.open ? 'visible' : ''}" @click=${this.close}></div>
      <div class="sidebar ${this.open ? 'open' : ''}">
        <div class="sidebar-header">
          <span class="sidebar-title">
            <span class="icon">${designIcon('note', 16)}</span>
            Board notes
          </span>
          <button class="close-btn" @click=${this.close} aria-label="Close">×</button>
        </div>

        <div class="notes-list">
          ${this.notes.length === 0
            ? html`
                <div class="empty-state">
                  <span class="empty-icon">${designIcon('note', 16)}</span>
                  <span class="empty-title">No notes yet</span>
                  <span class="empty-sub">Add shared notes visible to everyone.</span>
                </div>
              `
            : this.notes.map(note => html`
                <div class="note-item ${this.editingNoteId === note.id ? 'editing' : ''}">
                  <div class="note-meta">
                    <span class="note-author">${note.author_name}</span>
                    ${this.editingNoteId === note.id ? '' : html`<button
                      class="delete-note-btn"
                      @click=${() => this.deleteNote(note.id)}
                      aria-label="Delete note"
                      title="Delete"
                    >×</button>`}
                  </div>
                  ${this.editingNoteId === note.id
                    ? html`
                        <input
                          class="note-edit-title-input"
                          placeholder="Title (optional)"
                          .value=${this.editTitle}
                          @input=${(e: Event) => { this.editTitle = (e.target as HTMLInputElement).value }}
                          @keydown=${(e: KeyboardEvent) => this.onEditKeydown(e, note.id)}
                          @blur=${() => this.cancelEdit()}
                        />
                        <textarea
                          class="note-edit-textarea"
                          rows="3"
                          aria-label="Edit note text"
                          .value=${this.editText}
                          @input=${(e: Event) => { this.editText = (e.target as HTMLTextAreaElement).value }}
                          @keydown=${(e: KeyboardEvent) => this.onEditKeydown(e, note.id)}
                          @blur=${() => this.cancelEdit()}
                        ></textarea>
                        <div class="note-edit-actions">
                          <button class="note-cancel-btn" @mousedown=${(e: Event) => e.preventDefault()} @click=${() => this.cancelEdit()}>Cancel</button>
                          <button class="note-save-btn" @mousedown=${(e: Event) => e.preventDefault()} @click=${() => this.saveEdit(note.id)}>Save</button>
                        </div>
                      `
                    : html`
                        ${note.title
                          ? html`<div class="note-title" @click=${() => this.startEdit(note)}>${note.title}</div>`
                          : ''}
                        ${this.renderNoteBody(note)}
                      `}
                </div>
              `)}
        </div>

        ${this.open ? html`
          <div class="add-note-form">
            <input
              class="add-note-title-input"
              placeholder="Title (optional)"
              .value=${this.newNoteTitle}
              @input=${(e: Event) => { this.newNoteTitle = (e.target as HTMLInputElement).value }}
              @keydown=${this.onAddKeydown}
            />
            <textarea
              class="add-note-textarea"
              rows="3"
              aria-label="Note text"
              placeholder="Add a shared note… (Ctrl+Enter to submit)"
              .value=${this.newNoteText}
              @input=${(e: Event) => { this.newNoteText = (e.target as HTMLTextAreaElement).value }}
              @keydown=${this.onAddKeydown}
            ></textarea>
            <div class="add-note-footer">
              <button
                class="add-note-btn"
                @click=${this.addNote}
                aria-disabled=${this.newNoteText.trim() ? 'false' : 'true'}
              >Add</button>
            </div>
          </div>
        ` : ''}
      </div>
    `
  }
}
