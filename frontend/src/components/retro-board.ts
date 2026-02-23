import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { Session, SessionPhase } from '../types'
import { api } from '../api'
import { storage } from '../storage'
import './retro-column'

const COLUMN_ACCENTS: Record<string, string> = {
  'Went Well': '#22c55e',
  'To Improve': '#f97316',
  'Action Items': '#3b82f6',
}

const PHASE_LABELS: Record<SessionPhase, string> = {
  collecting: '✏️ Collecting',
  discussing: '💬 Discussing',
  closed: '🔒 Closed',
}

@customElement('retro-board')
export class RetroBoard extends LitElement {
  @property({ type: Object }) session!: Session
  @property({ type: String }) participantName = ''

  @state() private showHelp = false

  static styles = css`
    :host {
      display: block;
    }
    .facilitator-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 16px;
      background: #fff8f0;
      border: 1px solid #fed7aa;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .bar-label {
      font-size: 12px;
      font-weight: 600;
      color: #9a6a3a;
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
      background: #dbeafe;
      color: #1d4ed8;
    }
    .badge-discussing {
      background: #ffedd5;
      color: #c2410c;
    }
    .badge-closed {
      background: #f3e8ff;
      color: #7e22ce;
    }
    .phase-btn {
      background: #e85d04;
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
      background: #c44e00;
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
      color: #b07040;
    }
    .back-btn {
      background: none;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 7px 14px;
      font-size: 13px;
      font-weight: 500;
      color: #9a6a3a;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s;
    }
    .back-btn:hover {
      background: #fef3e8;
    }
    .help-btn {
      background: none;
      border: 1px solid #fed7aa;
      border-radius: 50%;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      color: #9a6a3a;
      cursor: pointer;
      font-family: inherit;
      flex-shrink: 0;
      transition: background 0.12s;
    }
    .help-btn:hover {
      background: #fef3e8;
    }

    /* ── Help overlay ── */
    .help-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 24px;
    }
    .help-card {
      background: white;
      border-radius: 20px;
      padding: 32px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 16px 64px rgba(0, 0, 0, 0.16);
    }
    .help-card h3 {
      font-size: 18px;
      font-weight: 800;
      color: #111;
      margin: 0 0 6px;
      letter-spacing: -0.4px;
    }
    .help-card .subtitle {
      font-size: 13px;
      color: #888;
      margin-bottom: 24px;
    }
    .help-phase {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      padding: 14px 0;
      border-top: 1px solid #f0ede8;
    }
    .help-phase-icon {
      font-size: 24px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .help-phase-body h4 {
      font-size: 14px;
      font-weight: 700;
      color: #111;
      margin: 0 0 4px;
    }
    .help-phase-body p {
      font-size: 13px;
      color: #666;
      margin: 0;
      line-height: 1.5;
    }
    .help-close-btn {
      margin-top: 24px;
      width: 100%;
      padding: 11px;
      background: #e85d04;
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
      background: #c44e00;
    }
    .columns {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    @media (max-width: 800px) {
      .columns {
        flex-direction: column;
      }
    }
  `

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

  render() {
    const { session } = this

    return html`
      ${this.showHelp
        ? html`
            <div class="help-overlay" @click=${() => (this.showHelp = false)}>
              <div class="help-card" @click=${(e: Event) => e.stopPropagation()}>
                <h3>How Retrospekt works</h3>
                <p class="subtitle">A session moves through three phases — only you as facilitator can advance or go back.</p>
                <div class="help-phase">
                  <span class="help-phase-icon">✏️</span>
                  <div class="help-phase-body">
                    <h4>Collecting</h4>
                    <p>Everyone adds cards to the columns anonymously. Use this phase to gather honest, unfiltered feedback before the team sees each other's responses.</p>
                  </div>
                </div>
                <div class="help-phase">
                  <span class="help-phase-icon">💬</span>
                  <div class="help-phase-body">
                    <h4>Discussing</h4>
                    <p>Each participant publishes their own cards to reveal them to the team. Once published, others can vote on them. No new cards can be added.</p>
                  </div>
                </div>
                <div class="help-phase">
                  <span class="help-phase-icon">🔒</span>
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
                ${PHASE_LABELS[session.phase]}
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
              <span class="participant-count">
                👥 ${session.participants.length}
                participant${session.participants.length !== 1 ? 's' : ''}
              </span>
              <button class="help-btn" @click=${() => (this.showHelp = true)}>?</button>
            </div>
          `
        : ''}

      <div
        class="columns"
        @add-card=${this.onAddCard}
        @vote=${this.onVoteCard}
        @unvote=${this.onUnvoteCard}
        @delete-card=${this.onDeleteCard}
        @publish-card=${this.onPublishCard}
      >
        ${session.columns.map(
          (col) => html`
            <retro-column
              .title=${col}
              .cards=${session.cards.filter((c) => c.column === col)}
              .participantName=${this.participantName}
              .phase=${session.phase}
              .accent=${COLUMN_ACCENTS[col] ?? '#e85d04'}
            ></retro-column>
          `,
        )}
      </div>
    `
  }
}
