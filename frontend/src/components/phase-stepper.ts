import { LitElement, css, html, type TemplateResult } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'

import { designIcon } from '../icons'
import { baseStyles } from '../styles'
import type { SessionPhase } from '../types'

interface Step {
  phase: SessionPhase
  label: string
  hint: string
  icon: () => TemplateResult
}

const STEPS: Step[] = [
  { phase: 'collecting', label: 'Collecting', hint: 'Add your cards privately', icon: () => designIcon('pencil', 13) },
  { phase: 'discussing', label: 'Discussing', hint: 'Vote on the cards that matter most', icon: () => designIcon('comment', 13) },
  { phase: 'closed', label: 'Closed', hint: 'This session is read only', icon: () => designIcon('lock', 13) },
]

/**
 * The one place the phase is shown. The facilitator clicks a step to move there (`interactive`);
 * everybody else only reads it. The active step carries the hint that the old banner used to show.
 */
@customElement('phase-stepper')
export class PhaseStepper extends LitElement {
  @property({ type: String }) phase: SessionPhase = 'collecting'
  @property({ type: Boolean }) interactive = false

  static styles = [baseStyles, css`
    :host {
      display: inline-flex;
    }
    .stepper {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: 999px;
    }
    .step {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px;
      border: none;
      border-radius: 999px;
      background: transparent;
      color: var(--retro-text-muted);
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }
    button.step {
      cursor: pointer;
    }
    .step.active {
      font-weight: 700;
    }
    .step.active.collecting {
      background: var(--retro-phase-collecting-bg);
      color: var(--retro-phase-collecting-text);
    }
    .step.active.discussing {
      background: var(--retro-phase-discussing-bg);
      color: var(--retro-phase-discussing-text);
    }
    .step.active.closed {
      background: var(--retro-phase-closed-bg);
      color: var(--retro-phase-closed-text);
    }
  `]

  private select(phase: SessionPhase): void {
    if (phase === this.phase) return
    this.dispatchEvent(new CustomEvent<SessionPhase>('phase-select', { detail: phase, bubbles: true, composed: true }))
  }

  render() {
    return html`
      <div class="stepper" role="group" aria-label="Session phase">
        ${STEPS.map((step) => {
          const active = step.phase === this.phase
          const classes = `step ${step.phase} ${active ? 'active' : ''}`
          const title = active ? step.hint : undefined
          return this.interactive
            ? html`<button type="button" class=${classes} title=${ifDefined(title)} aria-pressed=${active} @click=${() => this.select(step.phase)}>${step.icon()} ${step.label}</button>`
            : html`<span class=${classes} title=${ifDefined(title)} aria-current=${active ? 'step' : 'false'}>${step.icon()} ${step.label}</span>`
        })}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'phase-stepper': PhaseStepper
  }
}
