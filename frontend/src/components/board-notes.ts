import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { Note } from '../types'
import { api } from '../api'
import { faIconStyles, iconNoteSticky } from '../icons'

@customElement('board-notes')
export class BoardNotes extends LitElement {
  @property({ type: Boolean }) open = false
  @property({ type: Array }) notes: Note[] = []
  @property({ type: String }) participantName = ''
  @property({ type: String }) sessionId = ''

  @state() private newNoteText = ''
  @state() private editingNoteId: string | null = null
  @state() private editText = ''

  static styles = [faIconStyles, css`
    :host {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 300;
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0);
      backdrop-filter: blur(0px);
      transition: background 0.25s, backdrop-filter 0.25s;
      pointer-events: none;
    }
    .backdrop.visible {
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(2px);
      pointer-events: all;
    }

    .sidebar {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 340px;
      background: var(--retro-bg-surface);
      box-shadow: -4px 0 32px rgba(0, 0, 0, 0.14);
      transform: translateX(100%);
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      pointer-events: all;
      overflow: hidden;
    }
    .sidebar.open {
      transform: translateX(0);
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px 14px;
      border-bottom: 1px solid var(--retro-border-subtle);
      flex-shrink: 0;
    }
    .sidebar-title {
      font-size: 15px;
      font-weight: 800;
      color: var(--retro-text-primary);
      letter-spacing: -0.3px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sidebar-title .icon {
      color: var(--retro-accent);
      font-size: 14px;
    }
    .close-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 1.5px solid var(--retro-border-default);
      background: none;
      cursor: pointer;
      font-size: 14px;
      color: var(--retro-text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s, border-color 0.12s;
    }
    .close-btn:hover {
      background: var(--retro-bg-subtle);
      color: var(--retro-text-primary);
    }

    .notes-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .note-item {
      border: 1.5px solid var(--retro-border-default);
      border-radius: 10px;
      padding: 10px 12px;
      position: relative;
    }

    .note-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .note-author {
      font-size: 11px;
      font-weight: 700;
      color: var(--retro-accent);
      letter-spacing: 0.1px;
    }
    .delete-note-btn {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 13px;
      color: var(--retro-text-disabled);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      flex-shrink: 0;
      transition: background 0.1s, color 0.1s;
    }
    .delete-note-btn:hover {
      background: var(--retro-bg-subtle);
      color: var(--retro-error);
    }

    .note-text {
      font-size: 13px;
      color: var(--retro-text-primary);
      line-height: 1.5;
      cursor: pointer;
      border-radius: 4px;
      padding: 2px 4px;
      margin: -2px -4px;
      transition: background 0.1s;
      word-break: break-word;
    }
    .note-text:hover {
      background: var(--retro-bg-subtle);
    }

    .note-edit-textarea {
      width: 100%;
      box-sizing: border-box;
      font-size: 13px;
      font-family: inherit;
      color: var(--retro-text-primary);
      background: var(--retro-bg-page);
      border: 1.5px solid var(--retro-accent);
      border-radius: 6px;
      padding: 6px 8px;
      resize: vertical;
      min-height: 60px;
      outline: none;
      line-height: 1.5;
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
      padding: 12px 12px 16px;
      border-top: 1px solid var(--retro-border-subtle);
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .add-note-textarea {
      width: 100%;
      box-sizing: border-box;
      font-size: 13px;
      font-family: inherit;
      color: var(--retro-text-primary);
      background: var(--retro-bg-page);
      border: 1.5px solid var(--retro-border-default);
      border-radius: 8px;
      padding: 8px 10px;
      resize: none;
      height: 60px;
      outline: none;
      line-height: 1.5;
      transition: border-color 0.12s;
    }
    .add-note-textarea:focus {
      border-color: var(--retro-accent);
    }
    .add-note-footer {
      display: flex;
      justify-content: flex-end;
    }
    .add-note-btn {
      padding: 6px 16px;
      background: var(--retro-accent);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.12s;
    }
    .add-note-btn:hover {
      background: var(--retro-accent-hover);
    }
    .add-note-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }
  `]

  private close(): void {
    this.dispatchEvent(new CustomEvent('close'))
  }

  private async addNote(): Promise<void> {
    const text = this.newNoteText.trim()
    if (!text) return
    this.newNoteText = ''
    await api.addNote(this.sessionId, text, this.participantName)
  }

  private onAddKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      void this.addNote()
    } else if (e.key === 'Escape') {
      this.newNoteText = ''
    }
  }

  private startEdit(note: Note): void {
    this.editingNoteId = note.id
    this.editText = note.text
  }

  private async saveEdit(noteId: string): Promise<void> {
    if (this.editingNoteId !== noteId) return
    const text = this.editText.trim()
    this.editingNoteId = null
    if (text) {
      await api.updateNote(this.sessionId, noteId, text, this.participantName)
    }
  }

  private cancelEdit(): void {
    this.editingNoteId = null
  }

  private onEditKeydown(e: KeyboardEvent, noteId: string): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      void this.saveEdit(noteId)
    } else if (e.key === 'Escape') {
      this.cancelEdit()
    }
  }

  private async deleteNote(noteId: string): Promise<void> {
    await api.deleteNote(this.sessionId, noteId, this.participantName)
  }

  render() {
    return html`
      <div class="backdrop ${this.open ? 'visible' : ''}" @click=${this.close}></div>
      <div class="sidebar ${this.open ? 'open' : ''}">
        <div class="sidebar-header">
          <span class="sidebar-title">
            <span class="icon">${iconNoteSticky()}</span>
            Board Notes
          </span>
          <button class="close-btn" @click=${this.close} aria-label="Close">×</button>
        </div>

        <div class="notes-list">
          ${this.notes.length === 0
            ? html`
                <div class="empty-state">
                  <span class="empty-icon">${iconNoteSticky()}</span>
                  <span class="empty-title">No notes yet</span>
                  <span class="empty-sub">Add shared notes visible to everyone.</span>
                </div>
              `
            : this.notes.map(note => html`
                <div class="note-item">
                  <div class="note-meta">
                    <span class="note-author">${note.author_name}</span>
                    <button
                      class="delete-note-btn"
                      @click=${() => this.deleteNote(note.id)}
                      aria-label="Delete note"
                      title="Delete"
                    >×</button>
                  </div>
                  ${this.editingNoteId === note.id
                    ? html`
                        <textarea
                          class="note-edit-textarea"
                          .value=${this.editText}
                          @input=${(e: Event) => { this.editText = (e.target as HTMLTextAreaElement).value }}
                          @keydown=${(e: KeyboardEvent) => this.onEditKeydown(e, note.id)}
                          @blur=${() => this.saveEdit(note.id)}
                        ></textarea>
                      `
                    : html`
                        <div
                          class="note-text"
                          @click=${() => this.startEdit(note)}
                          title="Click to edit"
                        >${note.text}</div>
                      `}
                </div>
              `)}
        </div>

        ${this.open ? html`
          <div class="add-note-form">
            <textarea
              class="add-note-textarea"
              placeholder="Add a shared note… (Ctrl+Enter to submit)"
              .value=${this.newNoteText}
              @input=${(e: Event) => { this.newNoteText = (e.target as HTMLTextAreaElement).value }}
              @keydown=${this.onAddKeydown}
            ></textarea>
            <div class="add-note-footer">
              <button
                class="add-note-btn"
                @click=${this.addNote}
                ?disabled=${!this.newNoteText.trim()}
              >Add</button>
            </div>
          </div>
        ` : ''}
      </div>
    `
  }
}
