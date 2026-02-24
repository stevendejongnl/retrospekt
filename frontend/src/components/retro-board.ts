import { LitElement, css, html } from 'lit'
import type { TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { Session, SessionPhase } from '../types'
import { buildParticipantColorMap } from '../types'
import { api } from '../api'
import { storage } from '../storage'
import { faIconStyles, iconPencil, iconCommentDots, iconLock, iconUsers } from '../icons'
import './retro-column'

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

  static styles = [faIconStyles, css`
    :host {
      display: block;
    }
    .facilitator-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 16px;
      background: var(--retro-facilitator-bg);
      border: 1px solid var(--retro-facilitator-border);
      border-radius: 12px;
      margin-bottom: 20px;
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
      background: var(--retro-accent);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 7px 18px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s;
    }
    .phase-btn:hover {
      background: var(--retro-accent-hover);
    }
    .phase-btn.close-btn {
      background: #6b7280;
    }
    .phase-btn.close-btn:hover {
      background: #4b5563;
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
      background: var(--retro-bg-surface);
      border-radius: 20px;
      padding: 32px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 16px 64px var(--retro-card-shadow);
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
      padding: 8px 16px;
      background: var(--retro-bg-surface);
      border: 1px solid var(--retro-border-default);
      border-radius: 10px;
      margin-bottom: 20px;
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
      background: var(--retro-bg-surface);
      border-radius: 20px;
      padding: 32px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 16px 64px var(--retro-card-shadow);
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
      }
    }
  `]

  private get participantColorMap(): Record<string, string> {
    return buildParticipantColorMap(this.session.participants)
  }

  private get isFacilitator(): boolean {
    return storage.isFacilitator(this.session.id)
  }

  private get facilitatorToken(): string {
    return storage.getFacilitatorToken(this.session.id) ?? ''
  }

  private async transitionPhase(): Promise<void> {
    const order: SessionPhase[] = ['collecting', 'discussing', 'closed']
    const next = order[order.indexOf(this.session.phase) + 1]
    if (next) await api.setPhase(this.session.id, next, this.facilitatorToken)
  }

  private async goBackPhase(): Promise<void> {
    const order: SessionPhase[] = ['collecting', 'discussing', 'closed']
    const prev = order[order.indexOf(this.session.phase) - 1]
    if (prev) await api.setPhase(this.session.id, prev, this.facilitatorToken)
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

  private async onAddColumn(): Promise<void> {
    const existing = new Set(this.session.columns)
    let name = 'New column'
    let n = 2
    while (existing.has(name)) name = `New column ${n++}`
    await api.addColumn(this.session.id, name, this.facilitatorToken)
  }

  private async onRenameColumn(e: CustomEvent): Promise<void> {
    const { oldName, newName } = e.detail as { oldName: string; newName: string }
    await api.renameColumn(this.session.id, oldName, newName, this.facilitatorToken)
  }

  private async onRemoveColumn(e: CustomEvent): Promise<void> {
    await api.removeColumn(
      this.session.id,
      (e.detail as { column: string }).column,
      this.facilitatorToken,
    )
  }

  render() {
    const { session } = this

    const colorMap = this.participantColorMap
    const participantCountBtn = html`
      <button class="participant-count" @click=${() => (this.showParticipants = true)}>
        ${iconUsers()} ${session.participants.length}
        participant${session.participants.length !== 1 ? 's' : ''}
      </button>
    `

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

      ${this.showHelp
        ? html`
            <div class="help-overlay" @click=${() => (this.showHelp = false)}>
              <div class="help-card" @click=${(e: Event) => e.stopPropagation()}>
                <h3>How Retrospekt works</h3>
                <p class="subtitle">A session moves through three phases — only you as facilitator can advance or go back.</p>
                <div class="help-phase">
                  <span class="help-phase-icon">${iconPencil()}</span>
                  <div class="help-phase-body">
                    <h4>Collecting</h4>
                    <p>Everyone adds cards to the columns anonymously. Use this phase to gather honest, unfiltered feedback before the team sees each other's responses.</p>
                  </div>
                </div>
                <div class="help-phase">
                  <span class="help-phase-icon">${iconCommentDots()}</span>
                  <div class="help-phase-body">
                    <h4>Discussing</h4>
                    <p>Each participant publishes their own cards to reveal them to the team. Once published, others can vote on them. No new cards can be added.</p>
                  </div>
                </div>
                <div class="help-phase">
                  <span class="help-phase-icon">${iconLock()}</span>
                  <div class="help-phase-body">
                    <h4>Closed</h4>
                    <p>The session is read-only. Use this phase to wrap up and share results. Voting and card creation are disabled.</p>
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
              <button class="help-btn" @click=${() => (this.showHelp = true)}>?</button>
            </div>
          `
        : html`
            <div class="participant-bar">
              ${participantCountBtn}
            </div>
          `}

      <div
        class="columns"
        @add-card=${this.onAddCard}
        @vote=${this.onVoteCard}
        @unvote=${this.onUnvoteCard}
        @delete-card=${this.onDeleteCard}
        @publish-card=${this.onPublishCard}
        @publish-all-cards=${this.onPublishAllCards}
        @rename-column=${this.onRenameColumn}
        @remove-column=${this.onRemoveColumn}
      >
        ${session.columns.map(
          (col) => html`
            <retro-column
              .title=${col}
              .cards=${session.cards.filter((c) => c.column === col)}
              .participantName=${this.participantName}
              .phase=${session.phase}
              .accent=${COLUMN_ACCENTS[col] ?? '#e85d04'}
              .participantColorMap=${this.participantColorMap}
              ?isFacilitator=${this.isFacilitator}
            ></retro-column>
          `,
        )}
      </div>
    `
  }
}
