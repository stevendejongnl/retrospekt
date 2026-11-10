import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { SessionHistoryEntry } from '../storage'
import type { SessionPhase } from '../types'
import { storage } from '../storage'
import { designIcon } from '../icons'
import { baseStyles } from '../styles'

const PHASE_ICON = { collecting: 'pencil', discussing: 'comment', closed: 'lock' } as const
const PHASE_LABEL = { collecting: 'Collecting', discussing: 'Discussing', closed: 'Closed' } as const

@customElement('session-history')
export class SessionHistory extends LitElement {
  @property({ type: Boolean }) open = false
  /** Which edge it slides in from: the side of the button that opens it. */
  @property({ type: String, reflect: true }) side: 'left' | 'right' = 'right'

  @state() private history: SessionHistoryEntry[] = []

  static styles = [baseStyles, css`
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
    :host([side='left']) .sidebar {
      right: auto;
      left: 0;
      border-left: none;
      border-right: 1px solid var(--retro-glass-border);
      transform: translateX(-100%);
    }
    .sidebar.open,
    :host([side='left']) .sidebar.open {
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

    .session-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .session-item {
      border: 1px solid var(--retro-border-default);
      background: var(--retro-bg-subtle);
      border-radius: var(--retro-radius-md);
      padding: 10px 12px;
      cursor: pointer;
    }
    .session-item:hover {
      border-color: var(--retro-accent-border);
    }

    .item-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .item-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--retro-text-primary);
      flex: 1;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .remove-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      color: var(--retro-text-muted);
      font-family: inherit;
      padding: 0;
      flex-shrink: 0;
    }
    .remove-btn:hover {
      color: var(--retro-error);
    }

    .item-badges {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin: 6px 0;
    }
    .phase-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--retro-border-default);
      font-size: 12px;
      font-weight: 600;
    }
    .phase-collecting {
      background: var(--retro-phase-collecting-bg);
      color: var(--retro-phase-collecting-text);
    }
    .phase-discussing {
      background: var(--retro-phase-discussing-bg);
      color: var(--retro-phase-discussing-text);
    }
    .phase-closed {
      background: var(--retro-phase-closed-bg);
      color: var(--retro-phase-closed-text);
    }
    .facilitator-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: var(--retro-radius-md);
      font-size: 11px;
      font-weight: 500;
      background: var(--retro-accent-tint);
      color: var(--retro-accent-ink);
      border: 1px solid color-mix(in srgb, var(--retro-accent) 35%, transparent);
    }

    .item-meta {
      font-size: 11px;
      color: var(--retro-text-muted);
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
      color: var(--retro-text-muted);
    }
    .empty-icon {
      color: var(--retro-text-disabled);
    }
    .empty-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--retro-text-secondary);
    }
    .empty-sub {
      font-size: 12px;
      line-height: 1.5;
    }

    .sidebar-footer {
      padding: 12px;
      border-top: 1px solid var(--retro-border-default);
      flex-shrink: 0;
    }
    .clear-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 500;
      color: var(--retro-text-secondary);
      font-family: inherit;
      text-decoration: underline;
      text-underline-offset: 3px;
      text-decoration-color: var(--retro-border-default);
    }
    .clear-btn:hover {
      color: var(--retro-error);
    }
  `]

  updated(changedProps: Map<string, unknown>): void {
    if (changedProps.has('open') && this.open) {
      this.history = storage.getHistory()
    }
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close'))
  }

  private navigateTo(id: string): void {
    this.close()
    window.router.navigate(`/session/${id}`)
  }

  private removeEntry(e: Event, id: string): void {
    e.stopPropagation()
    storage.removeFromHistory(id)
    this.history = storage.getHistory()
  }

  private clearAll(): void {
    storage.clearHistory()
    this.history = []
  }

  private formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  render() {
    return html`
      <div class="backdrop ${this.open ? 'visible' : ''}" @click=${this.close}></div>
      <div class="sidebar ${this.open ? 'open' : ''}">
        <div class="sidebar-header">
          <span class="sidebar-title">
            <span class="icon">${designIcon('history', 16)}</span>
            Your sessions
          </span>
          <button class="close-btn" @click=${this.close} aria-label="Close">×</button>
        </div>

        <div class="session-list">
          ${this.history.length === 0
            ? html`
                <div class="empty-state">
                  <span class="empty-icon">${designIcon('history', 16)}</span>
                  <span class="empty-title">No sessions yet</span>
                  <span class="empty-sub">Sessions you create or join will appear here.</span>
                </div>
              `
            : this.history.map(
                (entry) => html`
                  <div class="session-item" @click=${() => this.navigateTo(entry.id)}>
                    <div class="item-top">
                      <span class="item-name">${entry.name}</span>
                      <button
                        class="remove-btn"
                        @click=${(e: Event) => this.removeEntry(e, entry.id)}
                        aria-label="Remove from history"
                        title="Remove"
                      >×</button>
                    </div>
                    <div class="item-badges">
                      <span class="phase-badge phase-${entry.phase}">${designIcon(PHASE_ICON[entry.phase as SessionPhase], 13)} ${PHASE_LABEL[entry.phase as SessionPhase]}</span>
                      ${entry.isFacilitator ? html`<span class="facilitator-badge">Facilitator</span>` : ''}
                    </div>
                    <div class="item-meta">
                      ${entry.participantName} · ${this.formatDate(entry.created_at)}
                    </div>
                  </div>
                `,
              )}
        </div>

        ${this.history.length > 0
          ? html`
              <div class="sidebar-footer">
                <button class="clear-btn" @click=${this.clearAll}>Clear history</button>
              </div>
            `
          : ''}
      </div>
    `
  }
}
