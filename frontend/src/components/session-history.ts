import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { SessionHistoryEntry } from '../storage'
import { storage } from '../storage'
import { faIconStyles, iconClockRotateLeft } from '../icons'

@customElement('session-history')
export class SessionHistory extends LitElement {
  @property({ type: Boolean }) open = false

  @state() private history: SessionHistoryEntry[] = []

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
      left: 0;
      bottom: 0;
      width: 320px;
      background: var(--retro-bg-surface);
      box-shadow: 4px 0 32px rgba(0, 0, 0, 0.14);
      transform: translateX(-100%);
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
      border-color: var(--retro-border-default);
      color: var(--retro-text-primary);
    }

    .session-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .session-item {
      border: 1.5px solid var(--retro-border-default);
      border-radius: 12px;
      padding: 12px 14px;
      cursor: pointer;
      transition: border-color 0.12s, background 0.12s;
      position: relative;
    }
    .session-item:hover {
      border-color: var(--retro-accent);
      background: var(--retro-accent-tint);
    }

    .item-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .item-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--retro-text-primary);
      letter-spacing: -0.2px;
      line-height: 1.3;
      flex: 1;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .remove-btn {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 12px;
      color: var(--retro-text-disabled);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.1s, color 0.1s;
      padding: 0;
      margin-top: 1px;
    }
    .remove-btn:hover {
      background: var(--retro-bg-subtle);
      color: var(--retro-error);
    }

    .item-badges {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 7px;
    }
    .phase-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 20px;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .phase-collecting {
      background: var(--retro-bg-subtle);
      color: var(--retro-text-secondary);
      border: 1px solid var(--retro-border-default);
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
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 20px;
      letter-spacing: 0.3px;
      background: var(--retro-accent-tint);
      color: var(--retro-accent);
      border: 1px solid color-mix(in srgb, var(--retro-accent) 30%, transparent);
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
      color: var(--retro-text-disabled);
    }
    .empty-icon {
      font-size: 32px;
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
    }

    .sidebar-footer {
      padding: 10px 20px 14px;
      border-top: 1px solid var(--retro-border-subtle);
      flex-shrink: 0;
    }
    .clear-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      color: var(--retro-text-disabled);
      font-family: inherit;
      padding: 0;
      transition: color 0.12s;
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
            <span class="icon">${iconClockRotateLeft()}</span>
            Your sessions
          </span>
          <button class="close-btn" @click=${this.close} aria-label="Close">×</button>
        </div>

        <div class="session-list">
          ${this.history.length === 0
            ? html`
                <div class="empty-state">
                  <span class="empty-icon">${iconClockRotateLeft()}</span>
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
                      <span class="phase-badge phase-${entry.phase}">${entry.phase}</span>
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
