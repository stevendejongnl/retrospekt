import { LitElement, css, html } from 'lit'
import type { TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { Card, Session, SessionPhase } from '../types'
import { buildParticipantColorMap } from '../types'
import { api } from '../api'
import { storage } from '../storage'
import {
  faIconStyles,
  iconPencil,
  iconCommentDots,
  iconLock,
  iconUsers,
  iconCircleCheck,
  iconGear,
  iconThumbsUp,
  iconLayerGroup,
  iconNoteSticky,
  iconFileArrowDown,
  iconClock,
  iconClockRotateLeft,
} from '../icons'
import './retro-column'
import './retro-timer'

const COLUMN_ACCENTS: Record<string, string> = {
  'Went Well': '#22c55e',
  'To Improve': '#f97316',
  'Action Items': '#3b82f6',
}

const PHASE_LABELS: Record<SessionPhase, () => TemplateResult> = {
  collecting: () => html`${iconPencil()} Collecting`,
  discussing: () => html`${iconCommentDots()} Discussing`,
  closed: () => html`${iconLock()} Closed`,
}

@customElement('retro-board')
export class RetroBoard extends LitElement {
  @property({ type: Object }) session!: Session
  @property({ type: String }) participantName = ''

  @state() private showHelp = false
  @state() private showParticipants = false
  @state() private showSettings = false
  @state() private settingName = ''
  @state() private settingReactions = true
  @state() private settingOpenFacilitator = false

  static styles = [faIconStyles, css`
    :host {
      display: block;
    }
    .facilitator-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 14px;
      background: var(--retro-glass-bg-medium);
      backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: 12px;
      margin-bottom: 16px;
      box-shadow: var(--retro-glass-shadow);
    }
    .bar-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--retro-facilitator-text);
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .phase-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
    }
    .badge-collecting {
      background: var(--retro-phase-collecting-bg);
      color: var(--retro-phase-collecting-text);
    }
    .badge-discussing {
      background: var(--retro-phase-discussing-bg);
      color: var(--retro-phase-discussing-text);
    }
    .badge-closed {
      background: var(--retro-phase-closed-bg);
      color: var(--retro-phase-closed-text);
    }
    .phase-btn {
      background: linear-gradient(135deg, oklch(0.72 0.16 50), oklch(0.66 0.17 42));
      color: white;
      border: 1px solid rgba(217, 116, 38, 0.4);
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 0.12s;
      box-shadow: 0 4px 12px rgba(217, 116, 38, 0.25);
    }
    .phase-btn:hover {
      opacity: 0.9;
    }
    .phase-btn.close-btn {
      background: rgba(28, 28, 30, 0.9);
      border-color: rgba(0, 0, 0, 0.2);
      box-shadow: none;
    }
    .phase-btn.close-btn:hover {
      opacity: 0.85;
    }
    .participant-count {
      margin-left: auto;
      font-size: 12px;
      color: var(--retro-facilitator-text);
    }
    .back-btn {
      background: none;
      border: 1px solid var(--retro-facilitator-border);
      border-radius: 8px;
      padding: 7px 14px;
      font-size: 13px;
      font-weight: 500;
      color: var(--retro-facilitator-text);
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s;
    }
    .back-btn:hover {
      background: var(--retro-bg-hover);
    }
    .help-btn {
      background: none;
      border: 1px solid var(--retro-facilitator-border);
      border-radius: 50%;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      color: var(--retro-facilitator-text);
      cursor: pointer;
      font-family: inherit;
      flex-shrink: 0;
      transition: background 0.12s;
    }
    .help-btn:hover {
      background: var(--retro-bg-hover);
    }
    .settings-btn {
      background: none;
      border: 1px solid var(--retro-facilitator-border);
      border-radius: 50%;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      color: var(--retro-facilitator-text);
      cursor: pointer;
      font-family: inherit;
      flex-shrink: 0;
      transition: background 0.12s;
    }
    .settings-btn:hover {
      background: var(--retro-bg-hover);
    }

    /* ── Help overlay ── */
    .help-overlay {
      position: fixed;
      inset: 0;
      background: var(--retro-overlay-bg);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 24px;
    }
    .help-card {
      background: var(--retro-glass-bg-strong);
      backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: 18px;
      padding: 28px 32px;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
      width: 100%;
      box-shadow: var(--retro-glass-shadow);
    }
    .help-card h3 {
      font-size: 18px;
      font-weight: 800;
      color: var(--retro-text-primary);
      margin: 0 0 6px;
      letter-spacing: -0.4px;
    }
    .help-card .subtitle {
      font-size: 13px;
      color: var(--retro-text-muted);
      margin-bottom: 24px;
    }
    .help-phase {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      padding: 14px 0;
      border-top: 1px solid var(--retro-border-subtle);
    }
    .help-phase-icon {
      font-size: 24px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .help-phase-body h4 {
      font-size: 14px;
      font-weight: 700;
      color: var(--retro-text-primary);
      margin: 0 0 4px;
    }
    .help-phase-body p {
      font-size: 13px;
      color: var(--retro-text-secondary);
      margin: 0;
      line-height: 1.5;
    }
    .help-close-btn {
      margin-top: 24px;
      width: 100%;
      padding: 11px;
      background: var(--retro-accent);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s;
    }
    .help-close-btn:hover {
      background: var(--retro-accent-hover);
    }
    .help-features {
      margin-top: 20px;
      border-top: 1px solid var(--retro-border-subtle);
      padding-top: 16px;
    }
    .help-features-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--retro-text-muted);
      margin: 0 0 10px;
    }
    .help-feature-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .help-feature {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 12px;
      color: var(--retro-text-secondary);
      line-height: 1.4;
    }
    .help-feature-icon {
      flex-shrink: 0;
      color: var(--retro-accent);
      font-size: 14px;
      margin-top: 1px;
    }
    .help-feature strong {
      color: var(--retro-text-primary);
      font-weight: 600;
    }

    /* ── Participant count button ── */
    .participant-count {
      margin-left: auto;
      font-size: 12px;
      color: var(--retro-facilitator-text);
      background: none;
      border: none;
      cursor: pointer;
      font-family: inherit;
      padding: 4px 8px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: background 0.12s;
    }
    .participant-count:hover {
      background: var(--retro-bg-hover);
    }

    /* ── Non-facilitator participants bar ── */
    .participant-bar {
      display: flex;
      align-items: center;
      padding: 8px 14px;
      background: var(--retro-glass-bg-medium);
      backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: 12px;
      margin-bottom: 16px;
      box-shadow: var(--retro-glass-shadow);
    }

    /* ── Participants popup ── */
    .participants-overlay {
      position: fixed;
      inset: 0;
      background: var(--retro-overlay-bg);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 24px;
    }
    .participants-card {
      background: var(--retro-glass-bg-strong);
      backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: 18px;
      padding: 28px 32px;
      max-width: 400px;
      width: 100%;
      box-shadow: var(--retro-glass-shadow);
    }
    .participants-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .participants-header h3 {
      font-size: 18px;
      font-weight: 800;
      color: var(--retro-text-primary);
      margin: 0;
      letter-spacing: -0.4px;
    }
    .participants-close {
      background: none;
      border: 1px solid var(--retro-border-default);
      border-radius: 50%;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      cursor: pointer;
      color: var(--retro-text-secondary);
      font-family: inherit;
      transition: background 0.12s;
    }
    .participants-close:hover {
      background: var(--retro-bg-hover);
    }
    .participants-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .participant-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .participant-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }
    .participant-name {
      font-size: 14px;
      color: var(--retro-text-primary);
    }

    .add-column-btn {
      background: none;
      border: 1.5px dashed var(--retro-facilitator-border);
      border-radius: 8px;
      padding: 7px 16px;
      font-size: 13px;
      font-weight: 500;
      color: var(--retro-facilitator-text);
      cursor: pointer;
      font-family: inherit;
      transition: all 0.12s;
    }
    .add-column-btn:hover {
      border-color: var(--retro-accent);
      color: var(--retro-accent);
    }
    .columns {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      overflow-x: auto;
    }
    @media (max-width: 800px) {
      .columns {
        flex-direction: column;
        align-items: stretch;
      }
    }

    /* ── Action items panel ── */
    .action-items-panel {
      margin-top: 24px;
      background: var(--retro-bg-subtle);
      border-radius: 14px;
      padding: 16px 20px;
    }
    .action-items-heading {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: var(--retro-text-primary);
      margin: 0 0 14px;
      letter-spacing: 0.1px;
    }
    .action-items-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .action-item {
      background: var(--retro-bg-surface);
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-shadow: 0 1px 3px var(--retro-card-shadow);
    }
    .action-item-text {
      font-size: 13px;
      color: var(--retro-text-primary);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .action-item-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .action-item-assignee {
      font-size: 11px;
      font-weight: 600;
      background: color-mix(in srgb, var(--retro-accent) 12%, transparent);
      color: var(--retro-accent);
      border-radius: 10px;
      padding: 2px 8px;
    }
    .action-item-column {
      font-size: 11px;
      color: var(--retro-text-disabled);
    }

    /* ── Settings overlay ── */
    .settings-overlay {
      position: fixed;
      inset: 0;
      background: var(--retro-overlay-bg);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 24px;
    }
    .settings-card {
      background: var(--retro-glass-bg-strong);
      backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: 18px;
      padding: 24px;
      max-width: 440px;
      width: 100%;
      box-shadow: var(--retro-glass-shadow);
    }
    .settings-card h3 {
      font-size: 18px;
      font-weight: 800;
      color: var(--retro-text-primary);
      margin: 0 0 20px;
      letter-spacing: -0.4px;
    }
    .settings-field {
      margin-bottom: 16px;
    }
    .settings-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--retro-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .settings-input {
      width: 100%;
      box-sizing: border-box;
      padding: 9px 12px;
      border: 1px solid var(--retro-border-default);
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      background: var(--retro-bg-page);
      color: var(--retro-text-primary);
      outline: none;
      transition: border-color 0.12s;
    }
    .settings-input:focus {
      border-color: var(--retro-accent);
    }
    .settings-checkbox-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      font-size: 14px;
      color: var(--retro-text-primary);
    }
    .settings-checkbox-row input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: var(--retro-accent);
      cursor: pointer;
      flex-shrink: 0;
    }
    .settings-section {
      font-size: 12px;
      font-weight: 600;
      color: var(--retro-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 20px 0 12px;
      padding-top: 16px;
      border-top: 1px solid var(--retro-border-subtle);
    }
    .settings-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 24px;
    }
    .settings-cancel-btn {
      background: none;
      border: 1px solid var(--retro-border-default);
      border-radius: 8px;
      padding: 9px 18px;
      font-size: 14px;
      font-weight: 500;
      color: var(--retro-text-secondary);
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s;
    }
    .settings-cancel-btn:hover {
      background: var(--retro-bg-hover);
    }
    .settings-save-btn {
      background: linear-gradient(135deg, oklch(0.72 0.16 50), oklch(0.66 0.17 42));
      color: white;
      border: 1px solid rgba(217, 116, 38, 0.5);
      border-radius: 8px;
      padding: 8px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 0.12s;
      box-shadow: 0 4px 12px rgba(217, 116, 38, 0.3);
    }
    .settings-save-btn:hover {
      opacity: 0.9;
    }
  `]

  private get participantColorMap(): Record<string, string> {
    return buildParticipantColorMap(this.session.participants)
  }

  private get isFacilitator(): boolean {
    return storage.isFacilitator(this.session.id) || !!this.session?.open_facilitator
  }

  private get facilitatorToken(): string {
    return storage.getFacilitatorToken(this.session.id) ?? ''
  }

  private get actionItems(): Array<{ card: Card; column: string }> {
    return this.session.cards
      .filter((c) => c.published && c.assignee)
      .map((c) => ({ card: c, column: c.column }))
  }

  private async transitionPhase(): Promise<void> {
    const order: SessionPhase[] = ['collecting', 'discussing', 'closed']
    const next = order[order.indexOf(this.session.phase) + 1]
    if (next) await api.setPhase(this.session.id, next, this.facilitatorToken, this.participantName)
  }

  private async goBackPhase(): Promise<void> {
    const order: SessionPhase[] = ['collecting', 'discussing', 'closed']
    const prev = order[order.indexOf(this.session.phase) - 1]
    if (prev) await api.setPhase(this.session.id, prev, this.facilitatorToken, this.participantName)
  }

  private async onAddCard(e: CustomEvent): Promise<void> {
    const { column, text, authorName } = e.detail as {
      column: string
      text: string
      authorName: string
    }
    await api.addCard(this.session.id, column, text, authorName)
  }

  private async onVoteCard(e: CustomEvent): Promise<void> {
    await api.addVote(this.session.id, (e.detail as { cardId: string }).cardId, this.participantName)
  }

  private async onUnvoteCard(e: CustomEvent): Promise<void> {
    await api.removeVote(
      this.session.id,
      (e.detail as { cardId: string }).cardId,
      this.participantName,
    )
  }

  private async onDeleteCard(e: CustomEvent): Promise<void> {
    await api.deleteCard(
      this.session.id,
      (e.detail as { cardId: string }).cardId,
      this.participantName,
    )
  }

  private async onEditCard(e: CustomEvent): Promise<void> {
    const { cardId, text } = e.detail as { cardId: string; text: string }
    await api.updateCardText(this.session.id, cardId, text, this.participantName)
  }

  private async onPublishCard(e: CustomEvent): Promise<void> {
    await api.publishCard(
      this.session.id,
      (e.detail as { cardId: string }).cardId,
      this.participantName,
    )
  }

  private async onPublishAllCards(e: CustomEvent): Promise<void> {
    await api.publishAllCards(
      this.session.id,
      (e.detail as { column: string }).column,
      this.participantName,
    )
  }

  private async onReact(e: CustomEvent): Promise<void> {
    const { cardId, emoji } = e.detail as { cardId: string; emoji: string }
    await api.addReaction(this.session.id, cardId, emoji, this.participantName)
  }

  private async onUnreact(e: CustomEvent): Promise<void> {
    const { cardId, emoji } = e.detail as { cardId: string; emoji: string }
    await api.removeReaction(this.session.id, cardId, emoji, this.participantName)
  }

  private async onAssignCard(e: CustomEvent): Promise<void> {
    const { cardId, assignee } = e.detail as { cardId: string; assignee: string }
    await api.assignCard(this.session.id, cardId, assignee, this.participantName, this.facilitatorToken)
  }

  private async onUnassignCard(e: CustomEvent): Promise<void> {
    const { cardId } = e.detail as { cardId: string }
    await api.assignCard(this.session.id, cardId, null, this.participantName, this.facilitatorToken)
  }

  private async onGroupCards(e: CustomEvent): Promise<void> {
    const { cardId, targetCardId } = e.detail as { cardId: string; targetCardId: string }
    await api.groupCard(this.session.id, cardId, targetCardId, this.participantName)
  }

  private async onUngroupCard(e: CustomEvent): Promise<void> {
    const { cardId } = e.detail as { cardId: string }
    await api.ungroupCard(this.session.id, cardId, this.participantName)
  }

  private async onAddColumn(): Promise<void> {
    const existing = new Set(this.session.columns)
    let name = 'New column'
    let n = 2
    while (existing.has(name)) name = `New column ${n++}`
    await api.addColumn(this.session.id, name, this.facilitatorToken, this.participantName)
  }

  private async onRenameColumn(e: CustomEvent): Promise<void> {
    const { oldName, newName } = e.detail as { oldName: string; newName: string }
    await api.renameColumn(this.session.id, oldName, newName, this.facilitatorToken, this.participantName)
  }

  private async onRemoveColumn(e: CustomEvent): Promise<void> {
    await api.removeColumn(
      this.session.id,
      (e.detail as { column: string }).column,
      this.facilitatorToken,
      this.participantName,
    )
  }

  private async onSortColumn(e: CustomEvent): Promise<void> {
    const { column, sortByVotes } = e.detail as { column: string; sortByVotes: boolean }
    await api.setColumnSort(this.session.id, column, sortByVotes, this.facilitatorToken, this.participantName)
  }

  private openSettings(): void {
    this.settingName = this.session.name
    this.settingReactions = this.session.reactions_enabled
    this.settingOpenFacilitator = this.session.open_facilitator
    this.showSettings = true
  }

  private async saveSettings(): Promise<void> {
    const updates: { name?: string; reactions_enabled?: boolean; open_facilitator?: boolean } = {}
    if (this.settingName !== this.session.name) updates.name = this.settingName
    if (this.settingReactions !== this.session.reactions_enabled) updates.reactions_enabled = this.settingReactions
    if (this.settingOpenFacilitator !== this.session.open_facilitator) updates.open_facilitator = this.settingOpenFacilitator
    if (Object.keys(updates).length > 0) {
      await api.updateSession(this.session.id, updates, this.facilitatorToken, this.participantName)
    }
    this.showSettings = false
  }

  render() {
    const { session } = this

    const colorMap = this.participantColorMap
    const participantNames = session.participants.map((p) => p.name)
    const participantCountBtn = html`
      <button class="participant-count" @click=${() => (this.showParticipants = true)}>
        ${iconUsers()} ${session.participants.length}
        participant${session.participants.length !== 1 ? 's' : ''}
      </button>
    `
    const items = this.actionItems

    return html`
      ${this.showParticipants
        ? html`
            <div class="participants-overlay" @click=${() => (this.showParticipants = false)}>
              <div class="participants-card" @click=${(e: Event) => e.stopPropagation()}>
                <div class="participants-header">
                  <h3>Participants (${session.participants.length})</h3>
                  <button class="participants-close" @click=${() => (this.showParticipants = false)}>×</button>
                </div>
                <div class="participants-list">
                  ${session.participants.map(
                    (p) => html`
                      <div class="participant-row">
                        <div
                          class="participant-avatar"
                          style="background: ${colorMap[p.name] ?? '#6b7280'}"
                        >${p.name[0]?.toUpperCase() ?? '?'}</div>
                        <span class="participant-name">${p.name}</span>
                      </div>
                    `,
                  )}
                </div>
              </div>
            </div>
          `
        : ''}

      ${this.showSettings
        ? html`
            <div class="settings-overlay" @click=${() => (this.showSettings = false)}>
              <div class="settings-card" @click=${(e: Event) => e.stopPropagation()}>
                <h3>Session settings</h3>
                <div class="settings-field">
                  <label class="settings-label">Session name</label>
                  <input
                    class="settings-input settings-name-input"
                    type="text"
                    .value=${this.settingName}
                    @input=${(e: InputEvent) => { this.settingName = (e.target as HTMLInputElement).value }}
                  />
                </div>
                <div class="settings-checkbox-row">
                  <input
                    class="settings-reactions-input"
                    type="checkbox"
                    id="settings-reactions"
                    .checked=${this.settingReactions}
                    @change=${(e: Event) => { this.settingReactions = (e.target as HTMLInputElement).checked }}
                  />
                  <label for="settings-reactions">Enable emoji reactions</label>
                </div>
                <div class="settings-checkbox-row">
                  <input
                    class="settings-open-facilitator-input"
                    type="checkbox"
                    id="settings-open-facilitator"
                    .checked=${this.settingOpenFacilitator}
                    @change=${(e: Event) => { this.settingOpenFacilitator = (e.target as HTMLInputElement).checked }}
                  />
                  <label for="settings-open-facilitator">Allow all participants to manage the board</label>
                </div>
                <div class="settings-actions">
                  <button class="settings-cancel-btn" @click=${() => (this.showSettings = false)}>Cancel</button>
                  <button class="settings-save-btn" @click=${this.saveSettings}>Save</button>
                </div>
              </div>
            </div>
          `
        : ''}

      ${this.showHelp
        ? html`
            <div class="help-overlay" @click=${() => (this.showHelp = false)}>
              <div class="help-card" @click=${(e: Event) => e.stopPropagation()}>
                <h3>How Retrospekt works</h3>
                <p class="subtitle">You control the session. Use the phase buttons to move forward or back at any time.</p>
                <div class="help-phase">
                  <span class="help-phase-icon">${iconPencil()}</span>
                  <div class="help-phase-body">
                    <h4>Collecting</h4>
                    <p>Everyone writes cards privately. Cards are invisible to others until published. Add, rename, or remove columns here. Move to discussing when everyone is ready.</p>
                  </div>
                </div>
                <div class="help-phase">
                  <span class="help-phase-icon">${iconCommentDots()}</span>
                  <div class="help-phase-body">
                    <h4>Discussing</h4>
                    <p>Participants publish and vote on cards. Use "Publish all" to reveal your own cards per column. Sort columns by votes, group related cards, and assign action items.</p>
                  </div>
                </div>
                <div class="help-phase">
                  <span class="help-phase-icon">${iconLock()}</span>
                  <div class="help-phase-body">
                    <h4>Closed</h4>
                    <p>Session is read-only. Export results as Markdown or share the link. Cards are sorted by vote count for easy review.</p>
                  </div>
                </div>
                <div class="help-features">
                  <p class="help-features-title">Facilitator tools</p>
                  <div class="help-feature-list">
                    <div class="help-feature">
                      <span class="help-feature-icon">${iconClock()}</span>
                      <span><strong>Timer</strong> — start a countdown to timebox discussions. Visible to all participants in real time.</span>
                    </div>
                    <div class="help-feature">
                      <span class="help-feature-icon">${iconThumbsUp()}</span>
                      <span><strong>Vote sorting</strong> — click ↕ Votes on any column during discussing to sort all participants' views by vote count.</span>
                    </div>
                    <div class="help-feature">
                      <span class="help-feature-icon">${iconLayerGroup()}</span>
                      <span><strong>Card grouping</strong> — drag published cards onto each other to stack related items. Click a stack to expand it.</span>
                    </div>
                    <div class="help-feature">
                      <span class="help-feature-icon">${iconUsers()}</span>
                      <span><strong>Open facilitator</strong> — enable in settings to let all participants manage phase, columns, and timer.</span>
                    </div>
                    <div class="help-feature">
                      <span class="help-feature-icon">${iconNoteSticky()}</span>
                      <span><strong>Notes</strong> — shared session notes panel for capturing decisions or follow-ups visible to everyone.</span>
                    </div>
                    <div class="help-feature">
                      <span class="help-feature-icon">${iconFileArrowDown()}</span>
                      <span><strong>Export</strong> — download the session as a Markdown file from the header once the session is closed.</span>
                    </div>
                    <div class="help-feature">
                      <span class="help-feature-icon">${iconClockRotateLeft()}</span>
                      <span><strong>History</strong> — previous sessions are saved locally and accessible from the home page sidebar.</span>
                    </div>
                  </div>
                </div>
                <button class="help-close-btn" @click=${() => (this.showHelp = false)}>Got it</button>
              </div>
            </div>
          `
        : ''}

      ${this.isFacilitator
        ? html`
            <div class="facilitator-bar">
              <span class="bar-label">Phase</span>
              <span class="phase-badge badge-${session.phase}">
                ${PHASE_LABELS[session.phase]()}
              </span>
              ${session.phase !== 'collecting'
                ? html`
                    <button class="back-btn" @click=${this.goBackPhase}>← Back</button>
                  `
                : ''}
              ${session.phase !== 'closed'
                ? html`
                    <button
                      class="phase-btn ${session.phase === 'discussing' ? 'close-btn' : ''}"
                      @click=${this.transitionPhase}
                    >
                      ${session.phase === 'collecting'
                        ? 'Start discussion →'
                        : 'Close session'}
                    </button>
                  `
                : ''}
              ${session.phase === 'collecting'
                ? html`<button class="add-column-btn" @click=${this.onAddColumn}>+ Add column</button>`
                : ''}
              ${participantCountBtn}
              <button class="settings-btn" title="Session settings" @click=${this.openSettings}>${iconGear()}</button>
              <button class="help-btn" @click=${() => (this.showHelp = true)}>?</button>
            </div>
          `
        : html`
            <div class="participant-bar">
              ${participantCountBtn}
            </div>
          `}

      ${this.isFacilitator || session.timer
        ? html`
            <retro-timer
              .timer=${session.timer ?? null}
              .sessionId=${session.id}
              ?isFacilitator=${this.isFacilitator}
              .facilitatorToken=${this.facilitatorToken}
              .participantName=${this.participantName}
            ></retro-timer>
          `
        : ''}

      <div
        class="columns"
        @add-card=${this.onAddCard}
        @vote=${this.onVoteCard}
        @unvote=${this.onUnvoteCard}
        @delete-card=${this.onDeleteCard}
        @edit-card=${this.onEditCard}
        @publish-card=${this.onPublishCard}
        @publish-all-cards=${this.onPublishAllCards}
        @react=${this.onReact}
        @unreact=${this.onUnreact}
        @assign-card=${this.onAssignCard}
        @unassign-card=${this.onUnassignCard}
        @group-cards=${this.onGroupCards}
        @ungroup-card=${this.onUngroupCard}
        @rename-column=${this.onRenameColumn}
        @remove-column=${this.onRemoveColumn}
        @sort-column=${this.onSortColumn}
      >
        ${session.columns.map(
          (col) => html`
            <retro-column
              .title=${col}
              .cards=${session.cards.filter((c) => c.column === col)}
              .participantName=${this.participantName}
              .participantNames=${participantNames}
              .phase=${session.phase}
              .accent=${COLUMN_ACCENTS[col] ?? '#e85d04'}
              .participantColorMap=${this.participantColorMap}
              ?isFacilitator=${this.isFacilitator}
              .reactionsEnabled=${session.reactions_enabled}
              .sortByVotes=${session.column_sorts?.[col] ?? false}
            ></retro-column>
          `,
        )}
      </div>

      ${(session.phase === 'discussing' || session.phase === 'closed') && items.length > 0
        ? html`
            <div class="action-items-panel">
              <h3 class="action-items-heading">${iconCircleCheck()} Action Items</h3>
              <div class="action-items-list">
                ${items.map(
                  ({ card, column }) => html`
                    <div class="action-item">
                      <span class="action-item-text">${card.text}</span>
                      <span class="action-item-meta">
                        <span class="action-item-assignee">${card.assignee}</span>
                        <span class="action-item-column">${column}</span>
                      </span>
                    </div>
                  `,
                )}
              </div>
            </div>
          `
        : ''}
    `
  }
}
