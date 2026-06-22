import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'

import {
  faIconStyles,
  iconPencil,
  iconCommentDots,
  iconLock,
  iconClock,
  iconThumbsUp,
  iconLayerGroup,
  iconUsers,
  iconNoteSticky,
  iconFileArrowDown,
  iconClockRotateLeft,
} from '../icons'

@customElement('retro-help')
export class RetroHelp extends LitElement {
  @property({ type: Boolean }) open = false
  @property({ type: String }) variant: 'participant' | 'facilitator' = 'participant'

  static styles = [faIconStyles, css`
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
    .help-footer {
      margin-top: 16px;
      font-size: 11px;
      color: var(--retro-text-muted);
      text-align: center;
    }
    .help-footer a {
      color: var(--retro-accent);
      text-decoration: none;
    }
    .help-footer a:hover {
      text-decoration: underline;
    }
  `]

  private _close(): void {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))
  }

  render() {
    if (!this.open) return nothing
    return html`
      <div class="help-overlay" @click=${this._close}>
        <div class="help-card" @click=${(e: Event) => e.stopPropagation()}>
          ${this.variant === 'participant' ? this._renderParticipant() : this._renderFacilitator()}
          <button class="help-close-btn" @click=${this._close}>Got it</button>
          ${this.variant === 'participant' ? html`
            <p class="help-footer">
              Open source &middot;
              <a href="https://github.com/stevendejongnl/retrospekt" target="_blank" rel="noopener noreferrer">github.com/stevendejongnl/retrospekt</a>
            </p>
          ` : nothing}
        </div>
      </div>
    `
  }

  private _renderParticipant() {
    return html`
      <h3>How Retrospekt works</h3>
      <p class="subtitle">
        A session moves through three phases, guided by the facilitator.
      </p>
      <div class="help-phase">
        <span class="help-phase-icon">${iconPencil()}</span>
        <div class="help-phase-body">
          <h4>Collecting</h4>
          <p>
            Add cards to the columns privately. Your cards are only visible to you until
            you publish them — be honest!
          </p>
        </div>
      </div>
      <div class="help-phase">
        <span class="help-phase-icon">${iconCommentDots()}</span>
        <div class="help-phase-body">
          <h4>Discussing</h4>
          <p>
            Publish your cards to share them with the team. Once visible, others can
            vote on them. You can still add new cards as drafts during this phase.
          </p>
        </div>
      </div>
      <div class="help-phase">
        <span class="help-phase-icon">${iconLock()}</span>
        <div class="help-phase-body">
          <h4>Closed</h4>
          <p>
            The session is read-only. The facilitator has wrapped up — results are
            available to review.
          </p>
        </div>
      </div>
      <div class="help-features">
        <p class="help-features-title">Features</p>
        <div class="help-feature-list">
          <div class="help-feature">
            <span class="help-feature-icon">${iconThumbsUp()}</span>
            <span><strong>Voting</strong> — tap the vote button on any published card during discussing to upvote it. One vote per card.</span>
          </div>
          <div class="help-feature">
            <span class="help-feature-icon">${iconLayerGroup()}</span>
            <span><strong>Card grouping</strong> — drag a published card onto another to stack related cards together. Click the stack to expand it.</span>
          </div>
          <div class="help-feature">
            <span class="help-feature-icon">${iconCommentDots()}</span>
            <span><strong>Reactions</strong> — react to any published card with an emoji. Enabled or disabled by the facilitator.</span>
          </div>
          <div class="help-feature">
            <span class="help-feature-icon">${iconNoteSticky()}</span>
            <span><strong>Notes</strong> — shared session notes are available via the notes panel, visible to everyone.</span>
          </div>
          <div class="help-feature">
            <span class="help-feature-icon">${iconUsers()}</span>
            <span><strong>History</strong> — access your previous sessions from the history sidebar on the home page.</span>
          </div>
        </div>
      </div>
    `
  }

  private _renderFacilitator() {
    return html`
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
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'retro-help': RetroHelp
  }
}
