import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'

import { designIcon, type DesignIconName } from '../icons'
import { baseStyles } from '../styles'

interface PhaseHelp {
  icon: DesignIconName
  name: string
  text: string
}

const PARTICIPANT_PHASES: PhaseHelp[] = [
  { icon: 'pencil', name: 'Collecting', text: 'Add cards to the columns privately. Your cards are only visible to you until you publish them. Be honest!' },
  { icon: 'comment', name: 'Discussing', text: 'Publish your cards to share them with the team. Once visible, others can vote on them. You can still add new cards as drafts.' },
  { icon: 'lock', name: 'Closed', text: 'The session is read only. Export the board to Markdown to keep the outcome.' },
]

const FACILITATOR_PHASES: PhaseHelp[] = [
  { icon: 'pencil', name: 'Collecting', text: 'Everyone writes cards privately. Cards are invisible to others until published. Add, rename, or remove columns here. Move to discussing when everyone is ready.' },
  { icon: 'comment', name: 'Discussing', text: 'Participants publish and vote on cards. Use "Publish all" to reveal your own cards per column. Sort columns by votes, group related cards, and assign action items.' },
  { icon: 'lock', name: 'Closed', text: 'The session is read only. Export results as Markdown from Share, or share the link. Cards are sorted by vote count for easy review.' },
]

@customElement('retro-help')
export class RetroHelp extends LitElement {
  @property({ type: Boolean }) open = false
  @property({ type: String }) variant: 'participant' | 'facilitator' = 'participant'

  static styles = [baseStyles, css`
    .help-overlay {
      position: fixed;
      inset: 0;
      background: var(--retro-overlay-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 24px;
    }
    .help-card {
      background: var(--retro-glass-bg-strong);
      border: 1px solid var(--retro-glass-border);
      border-radius: var(--retro-radius-lg);
      padding: 28px;
      max-width: 460px;
      max-height: 90vh;
      overflow-y: auto;
      width: 100%;
      box-shadow: var(--retro-shadow-float);
    }
    .help-card h3 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--retro-text-primary);
    }
    .help-card .subtitle {
      font-size: 13px;
      color: var(--retro-text-secondary);
      margin: 4px 0 18px;
    }
    .help-phase {
      display: flex;
      gap: 12px;
      margin-bottom: 14px;
    }
    .help-phase-icon {
      width: 34px;
      height: 34px;
      border-radius: var(--retro-radius-md);
      background: var(--retro-accent-tint);
      color: var(--retro-accent-ink);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .help-phase-body h4 {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--retro-text-primary);
    }
    .help-phase-body p {
      font-size: 13px;
      line-height: 1.5;
      color: var(--retro-text-secondary);
      margin-top: 2px;
    }
    .help-close-btn {
      width: 100%;
      margin-top: 6px;
      padding: 9px 18px;
      background: var(--retro-accent);
      color: var(--retro-accent-contrast);
      border: 1px solid var(--retro-accent-border);
      border-radius: var(--retro-radius-sm);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s;
    }
    .help-close-btn:hover {
      background: var(--retro-accent-hover);
    }
    .help-footer {
      margin-top: 12px;
      font-size: 11px;
      color: var(--retro-text-muted);
      text-align: center;
    }
    .help-footer a {
      color: inherit;
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
    const facilitator = this.variant === 'facilitator'
    const phases = facilitator ? FACILITATOR_PHASES : PARTICIPANT_PHASES
    return html`
      <div class="help-overlay" @click=${this._close}>
        <div class="help-card" @click=${(e: Event) => e.stopPropagation()}>
          <h3>How Retrospekt works</h3>
          <p class="subtitle">
            ${facilitator
              ? 'You control the session. Use the phase buttons to move forward or back at any time.'
              : 'A session moves through three phases, guided by the facilitator.'}
          </p>
          ${phases.map((phase) => html`
            <div class="help-phase">
              <span class="help-phase-icon">${designIcon(phase.icon, 17)}</span>
              <div class="help-phase-body">
                <h4>${phase.name}</h4>
                <p>${phase.text}</p>
              </div>
            </div>
          `)}
          <button class="help-close-btn" @click=${this._close}>Got it</button>
          <p class="help-footer">
            Open source &middot;
            <a href="https://github.com/stevendejongnl/retrospekt" target="_blank" rel="noopener noreferrer">github.com/stevendejongnl/retrospekt</a>
          </p>
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
