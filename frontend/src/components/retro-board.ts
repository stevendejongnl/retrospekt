import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'

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

  render() {
    const { session } = this

    return html`
      ${this.isFacilitator
        ? html`
            <div class="facilitator-bar">
              <span class="bar-label">Phase</span>
              <span class="phase-badge badge-${session.phase}">
                ${PHASE_LABELS[session.phase]}
              </span>
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
            </div>
          `
        : ''}

      <div
        class="columns"
        @add-card=${this.onAddCard}
        @vote=${this.onVoteCard}
        @unvote=${this.onUnvoteCard}
        @delete-card=${this.onDeleteCard}
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
