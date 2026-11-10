import { baseStyles } from '../styles'
import { designIcon } from '../icons'
import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { Card, Session, SessionPhase } from '../types'
import { buildParticipantColorMap } from '../types'
import { api, countParticipantVotes } from '../api'
import { storage } from '../storage'
import {
  faIconStyles,
} from '../icons'
import { COLUMN_COLORS, columnColorVar, resolveColumnColor } from '../column-colors'
import type { ColumnColor } from '../column-colors'
import './retro-column'
import './retro-timer'


@customElement('retro-board')
export class RetroBoard extends LitElement {
  @property({ type: Object }) session!: Session
  @property({ type: String }) participantName = ''
  // Presentation mode: the board as the room sees it, nothing of yours, nothing to press
  @property({ type: Boolean }) presenting = false

  @state() private showSettings = false
  @state() private settingName = ''
  @state() private settingReactions = true
  @state() private settingOpenFacilitator = false
  @state() private settingMaxVotes = ''
  @state() private voteLimitMessage = ''
  private _voteLimitTimer: ReturnType<typeof setTimeout> | null = null

  static styles = [baseStyles, faIconStyles, css`
    :host {
      display: block;
    }
    .written-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 0 0 12px;
      padding: 12px 16px;
      border-radius: var(--retro-radius-md);
      background: var(--retro-glass-bg-medium);
      border: 1px solid var(--retro-border-default);
      color: var(--retro-text-secondary);
      font-size: 13px;
    }
    .written-bar strong {
      color: var(--retro-text-primary);
      font-size: 14px;
    }
    .facilitator-dock {
      position: fixed;
      /* <notification-dock> sets --retro-dock-shift while a card is docked bottom-left */
      left: calc(50% + var(--retro-dock-shift, 0px));
      bottom: 20px;
      transform: translateX(-50%);
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: calc(100vw - 24px);
      padding: 8px 12px;
      background: var(--retro-glass-bg-strong);
      border: 1px solid var(--retro-glass-border);
      border-radius: 999px;
      box-shadow: var(--retro-shadow-float);
    }
    .dock-sep {
      width: 1px;
      height: 22px;
      background: var(--retro-border-default);
    }
    .phase-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--retro-accent);
      color: var(--retro-accent-contrast);
      border: 1px solid var(--retro-accent-border);
      border-radius: var(--retro-radius-sm);
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
      transition: background 0.12s;
    }
    .phase-btn:hover {
      background: var(--retro-accent-hover);
    }
    .phase-btn.close-btn {
      background: var(--retro-strong-bg);
      color: var(--retro-strong-ink);
      border-color: var(--retro-strong-bg);
    }
    .phase-btn.close-btn:hover {
      opacity: 0.85;
    }
    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: var(--retro-radius-sm);
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 500;
      color: var(--retro-text-primary);
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
      transition: background 0.12s;
    }
    .back-btn:hover {
      background: var(--retro-bg-hover);
    }
    .settings-btn {
      background: var(--retro-input-bg);
      border: 1px solid var(--retro-border-default);
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--retro-text-secondary);
      cursor: pointer;
      font-family: inherit;
      flex-shrink: 0;
      padding: 0;
      transition: background 0.12s;
    }
    .settings-btn:hover {
      background: var(--retro-bg-hover);
    }
    .add-column-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: 1px dashed var(--retro-dashed-border);
      border-radius: var(--retro-radius-sm);
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      color: var(--retro-text-secondary);
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
      gap: 12px;
      align-items: flex-start;
      overflow-x: auto;
      padding-bottom: 96px; /* the facilitator dock floats over the bottom edge */
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
      border-radius: var(--retro-radius-md);
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
      border-radius: var(--retro-radius-sm);
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
      border-radius: var(--retro-radius-md);
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
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 24px;
    }
    .settings-card {
      background: var(--retro-glass-bg-strong);
      border: 1px solid var(--retro-glass-border);
      border-radius: var(--retro-radius-lg);
      padding: 24px;
      max-width: 420px;
      width: 100%;
      box-shadow: var(--retro-shadow-float);
    }
    .settings-card h3 {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--retro-text-primary);
      margin: 0 0 16px;
    }
    .settings-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .settings-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--retro-text-primary);
    }
    .settings-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--retro-input-border);
      border-radius: var(--retro-radius-md);
      font-family: inherit;
      font-size: 14px;
      background: var(--retro-input-bg);
      color: var(--retro-text-primary);
      outline: none;
    }
    .settings-input:focus {
      border-color: color-mix(in srgb, var(--retro-accent) 55%, transparent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--retro-accent) 14%, transparent);
    }
    .settings-input.narrow {
      width: 140px;
    }
    .settings-gap-16 {
      height: 16px;
    }
    .settings-gap-8 {
      height: 8px;
    }
    .settings-check {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--retro-radius-md);
      background: var(--retro-check-bg);
      border: 1px solid var(--retro-check-border);
      cursor: pointer;
    }
    .settings-check input[type='checkbox'] {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }
    .settings-check:focus-within .check-box {
      outline: 2px solid color-mix(in srgb, var(--retro-accent) 55%, transparent);
      outline-offset: 2px;
    }
    .check-box {
      width: 18px;
      height: 18px;
      border-radius: 5px;
      border: 1px solid var(--retro-check-box-border);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--retro-accent-contrast);
      flex-shrink: 0;
      margin-top: 1px;
    }
    .check-box.on {
      background: var(--retro-accent);
      border-color: var(--retro-accent);
    }
    .check-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--retro-text-primary);
    }
    .check-sub {
      display: block;
      font-size: 11px;
      color: var(--retro-text-muted);
      margin-top: 2px;
    }
    .settings-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 20px;
    }
    .settings-cancel-btn {
      background: var(--retro-input-bg);
      border: 1px solid var(--retro-input-border);
      border-radius: var(--retro-radius-md);
      padding: 8px 16px;
      font-size: 13px;
      color: var(--retro-text-primary);
      cursor: pointer;
      font-family: inherit;
    }
    .settings-cancel-btn:hover {
      background: var(--retro-bg-hover);
    }
    .settings-save-btn {
      background: var(--retro-accent);
      color: var(--retro-accent-contrast);
      border: 1px solid color-mix(in srgb, var(--retro-accent) 50%, transparent);
      border-radius: var(--retro-radius-md);
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .settings-save-btn:hover {
      background: var(--retro-accent-hover);
    }
    .vote-limit-msg {
      background: var(--retro-warning, #fef3c7);
      color: var(--retro-warning-text, #92400e);
      text-align: center;
      padding: 6px 12px;
      font-size: 0.85rem;
      border-radius: 4px;
      margin: 0 16px 8px;
    }
  `]

  private get participantColorMap(): Record<string, string> {
    return buildParticipantColorMap(this.session.participants)
  }

  /** Collecting while presenting: cards are private, so say how many exist, not what they say. */
  private renderWrittenBar() {
    const cards = this.session.cards
    const people = new Set(cards.map((c) => c.author_name)).size
    return html`<div class="written-bar" role="status">
      ${designIcon('lock', 16)}
      <strong>${cards.length} ${cards.length === 1 ? 'card' : 'cards'} written by ${people} ${people === 1 ? 'person' : 'people'}</strong>
      <span>They stay private until the discussion starts.</span>
    </div>`
  }

  private get isFacilitator(): boolean {
    return storage.isFacilitator(this.session.id) || !!this.session?.open_facilitator
  }

  private get facilitatorToken(): string {
    return storage.getFacilitatorToken(this.session.id) ?? ''
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
    const { cardId } = e.detail as { cardId: string }
    if (
      this.session.max_votes_per_participant !== null &&
      this.votesUsed >= this.session.max_votes_per_participant
    ) {
      this._showVoteLimit()
      return
    }
    await api.addVote(this.session.id, cardId, this.participantName)
  }

  private async onUnvoteCard(e: CustomEvent): Promise<void> {
    await api.removeVote(
      this.session.id,
      (e.detail as { cardId: string }).cardId,
      this.participantName,
    )
  }

  private async onGroupVote(e: CustomEvent): Promise<void> {
    const { groupCards } = e.detail as { groupCards: Card[] }
    if (
      this.session.max_votes_per_participant !== null &&
      countParticipantVotes(this.session, this.participantName) >= this.session.max_votes_per_participant
    ) {
      this._showVoteLimit()
      return
    }
    const groupIds = new Set(groupCards.map((c) => c.id))
    const rep = this.session.cards.find((c) => groupIds.has(c.id))
    if (rep) {
      await api.addVote(this.session.id, rep.id, this.participantName)
    }
  }

  private async onGroupUnvote(e: CustomEvent): Promise<void> {
    const { groupCards } = e.detail as { groupCards: Card[] }
    await Promise.all(
      groupCards
        .filter((c) => c.votes.some((v) => v.participant_name === this.participantName))
        .map((c) => api.removeVote(this.session.id, c.id, this.participantName)),
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
    const sessionId = this.session.id
    const originalCards = this.session.cards
    this.session = { ...this.session, cards: originalCards.map(c => c.id === cardId ? { ...c, text } : c) }
    try {
      await api.updateCardText(sessionId, cardId, text, this.participantName)
    } catch (err) {
      this.session = { ...this.session, cards: originalCards }
      throw err
    }
  }

  private async onPublishCard(e: CustomEvent): Promise<void> {
    await api.publishCard(
      this.session.id,
      (e.detail as { cardId: string }).cardId,
      this.participantName,
    )
  }

  private async onUnpublishCard(e: CustomEvent): Promise<void> {
    await api.unpublishCard(
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

  private async onMoveCard(e: CustomEvent): Promise<void> {
    const { cardId, column } = e.detail as { cardId: string; column: string }
    await api.moveCard(this.session.id, cardId, column, this.participantName, this.facilitatorToken)
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
    // A new column takes the first colour no other column uses, so it stands apart.
    const used = new Set(this.session.columns.map((c, i) => resolveColumnColor(this.session.column_colors, c, i)))
    const color = COLUMN_COLORS.find((c) => !used.has(c))
    await api.addColumn(this.session.id, name, this.facilitatorToken, this.participantName, color)
  }

  private async onSetColumnColor(e: CustomEvent): Promise<void> {
    const { column, color } = e.detail as { column: string; color: ColumnColor }
    await api.setColumnColor(this.session.id, column, color, this.facilitatorToken, this.participantName)
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
    this.settingMaxVotes = this.session.max_votes_per_participant?.toString() ?? ''
    this.showSettings = true
  }

  private get votesUsed(): number {
    return this.participantName ? countParticipantVotes(this.session, this.participantName) : 0
  }

  private _showVoteLimit(): void {
    /* istanbul ignore next -- timer already active: requires two rapid calls, not worth testing */
    if (this._voteLimitTimer) clearTimeout(this._voteLimitTimer)
    this.voteLimitMessage = 'Vote limit reached — remove a vote first'
    this._voteLimitTimer = setTimeout(/* istanbul ignore next */ () => {
      this.voteLimitMessage = ''
      this._voteLimitTimer = null
    }, 3000)
  }

  private async saveSettings(): Promise<void> {
    const updates: { name?: string; reactions_enabled?: boolean; open_facilitator?: boolean; max_votes_per_participant?: number | null } = {}
    if (this.settingName !== this.session.name) updates.name = this.settingName
    if (this.settingReactions !== this.session.reactions_enabled) updates.reactions_enabled = this.settingReactions
    if (this.settingOpenFacilitator !== this.session.open_facilitator) updates.open_facilitator = this.settingOpenFacilitator
    const maxVotesRaw = this.settingMaxVotes.trim()
    const newMaxVotes = maxVotesRaw === '' ? null : parseInt(maxVotesRaw, 10)
    if (newMaxVotes !== this.session.max_votes_per_participant) {
      updates.max_votes_per_participant = newMaxVotes
    }
    if (Object.keys(updates).length > 0) {
      await api.updateSession(this.session.id, updates, this.facilitatorToken, this.participantName)
    }
    this.showSettings = false
  }

  render() {
    const { session } = this

    const participantNames = session.participants.map((p) => p.name)
    return html`
      ${this.showSettings
        ? html`
            <div class="settings-overlay" @click=${() => (this.showSettings = false)}>
              <div class="settings-card" @click=${(e: Event) => e.stopPropagation()}>
                <h3>Session settings</h3>
                <div class="settings-field">
                  <label class="settings-label" for="settings-name">Session name</label>
                  <input
                    id="settings-name"
                    class="settings-input settings-name-input"
                    type="text"
                    .value=${this.settingName}
                    @input=${(e: InputEvent) => { this.settingName = (e.target as HTMLInputElement).value }}
                  />
                </div>
                <div class="settings-gap-16"></div>
                <label class="settings-check">
                  <input
                    class="settings-reactions-input"
                    type="checkbox"
                    .checked=${this.settingReactions}
                    @change=${(e: Event) => { this.settingReactions = (e.target as HTMLInputElement).checked }}
                  />
                  <span class="check-box ${this.settingReactions ? 'on' : ''}" aria-hidden="true">${this.settingReactions ? designIcon('check', 12) : ''}</span>
                  <span>
                    <span class="check-label">Enable emoji reactions</span>
                    <span class="check-sub">Participants can react with emoji</span>
                  </span>
                </label>
                <div class="settings-gap-8"></div>
                <label class="settings-check">
                  <input
                    class="settings-open-facilitator-input"
                    type="checkbox"
                    .checked=${this.settingOpenFacilitator}
                    @change=${(e: Event) => { this.settingOpenFacilitator = (e.target as HTMLInputElement).checked }}
                  />
                  <span class="check-box ${this.settingOpenFacilitator ? 'on' : ''}" aria-hidden="true">${this.settingOpenFacilitator ? designIcon('check', 12) : ''}</span>
                  <span>
                    <span class="check-label">Allow all participants to manage the board</span>
                    <span class="check-sub">Phase, timer, columns</span>
                  </span>
                </label>
                <div class="settings-gap-16"></div>
                <div class="settings-field">
                  <label class="settings-label" for="settings-max-votes">Max votes per participant</label>
                  <input
                    id="settings-max-votes"
                    class="settings-input narrow settings-max-votes-input"
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    .value=${this.settingMaxVotes}
                    @input=${(e: InputEvent) => {
                      this.settingMaxVotes = (e.target as HTMLInputElement).value
                    }}
                  />
                </div>
                <div class="settings-actions">
                  <button class="settings-cancel-btn" @click=${() => (this.showSettings = false)}>Cancel</button>
                  <button class="settings-save-btn" @click=${this.saveSettings}>Save</button>
                </div>
              </div>
            </div>
          `
        : ''}


      ${this.isFacilitator && !this.presenting
        ? html`
            <div class="facilitator-dock" role="toolbar" aria-label="Facilitator controls">
              ${session.phase !== 'collecting'
                ? html`
                    <button class="back-btn" @click=${this.goBackPhase}>
                      ${designIcon('arrowLeft', 13)} ${session.phase === 'closed' ? 'Reopen' : 'Back'}
                    </button>
                    ${session.phase === 'discussing' ? html`<span class="dock-sep" aria-hidden="true"></span>` : ''}
                  `
                : ''}
              ${session.phase !== 'closed'
                ? html`
                    <retro-timer
                      .timer=${session.timer ?? null}
                      .sessionId=${session.id}
                      isFacilitator
                      .facilitatorToken=${this.facilitatorToken}
                      .participantName=${this.participantName}
                    ></retro-timer>
                    <span class="dock-sep" aria-hidden="true"></span>
                  `
                : html`<span class="dock-sep" aria-hidden="true"></span>`}
              ${session.phase === 'collecting'
                ? html`<button class="add-column-btn" aria-label="Add column" @click=${this.onAddColumn}>${designIcon('plus', 12)} Column</button>`
                : ''}
              <button class="settings-btn" aria-label="Session settings" title="Session settings" @click=${this.openSettings}>${designIcon('settings', 14)}</button>
              ${session.phase !== 'closed'
                ? html`
                    <span class="dock-sep" aria-hidden="true"></span>
                    <button
                      class="phase-btn ${session.phase === 'discussing' ? 'close-btn' : ''}"
                      @click=${this.transitionPhase}
                    >
                      ${session.phase === 'collecting'
                        ? html`Start discussion ${designIcon('arrowRight', 13)}`
                        : 'Close session'}
                    </button>
                  `
                : ''}
            </div>
          `
        : ''}

      ${this.voteLimitMessage
        ? html`<div class="vote-limit-msg">${this.voteLimitMessage}</div>`
        : ''}

      ${this.presenting && session.phase === 'collecting' ? this.renderWrittenBar() : ''}

      <div
        class="columns"
        @add-card=${this.onAddCard}
        @vote=${this.onVoteCard}
        @unvote=${this.onUnvoteCard}
        @delete-card=${this.onDeleteCard}
        @edit-card=${this.onEditCard}
        @publish-card=${this.onPublishCard}
        @unpublish-card=${this.onUnpublishCard}
        @publish-all-cards=${this.onPublishAllCards}
        @react=${this.onReact}
        @unreact=${this.onUnreact}
        @assign-card=${this.onAssignCard}
        @unassign-card=${this.onUnassignCard}
        @group-cards=${this.onGroupCards}
        @move-card=${this.onMoveCard}
        @ungroup-card=${this.onUngroupCard}
        @group-vote=${this.onGroupVote}
        @group-unvote=${this.onGroupUnvote}
        @rename-column=${this.onRenameColumn}
        @remove-column=${this.onRemoveColumn}
        @sort-column=${this.onSortColumn}
        @set-column-color=${this.onSetColumnColor}
      >
        ${session.columns.map(
          (col, index) => html`
            <retro-column
              .title=${col}
              .cards=${session.cards.filter((c) => c.column === col)}
              .participantName=${this.presenting ? '' : this.participantName}
              .participantNames=${participantNames}
              .phase=${session.phase}
              .accent=${columnColorVar(resolveColumnColor(session.column_colors, col, index))}
              .color=${resolveColumnColor(session.column_colors, col, index)}
              .participantColorMap=${this.participantColorMap}
              ?isFacilitator=${this.isFacilitator && !this.presenting}
              ?presenting=${this.presenting}
              .reactionsEnabled=${session.reactions_enabled}
              .sortByVotes=${session.column_sorts?.[col] ?? false}
            ></retro-column>
          `,
        )}
      </div>
    `
  }
}
