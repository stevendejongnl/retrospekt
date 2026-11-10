import { baseStyles } from '../styles'
import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { TimerState } from '../types'
import { api } from '../api'
import { faIconStyles, designIcon } from '../icons'

/**
 * Pure function: compute how many seconds remain on the timer at a given `now` timestamp.
 * Exported so it can be unit-tested without a DOM.
 */
export function computeRemaining(timer: TimerState, now: number): number {
  if (timer.started_at) {
    const elapsed = (now - new Date(timer.started_at).getTime()) / 1000
    return Math.max(0, timer.duration_seconds - elapsed)
  }
  return timer.paused_remaining ?? timer.duration_seconds
}

const DEFAULT_SECONDS = 600

const PRESETS = [
  { label: '5m', seconds: 300 },
  { label: '10m', seconds: 600 },
  { label: '15m', seconds: 900 },
  { label: '30m', seconds: 1800 },
]

@customElement('retro-timer')
export class RetroTimer extends LitElement {
  @property({ type: Object }) timer: TimerState | null = null
  @property({ type: String }) sessionId = ''
  @property({ type: Boolean, reflect: true }) isFacilitator = false
  @property({ type: String }) facilitatorToken = ''
  @property({ type: String }) participantName = ''

  @state() private displaySeconds = 0
  @state() private customMinutes = ''
  @state() private open = false

  private _interval: number | null = null
  private _muted = localStorage.getItem('retro_timer_muted') === 'true'
  private _audioCtx: AudioContext | null = null

  static styles = [baseStyles, faIconStyles, css`
    :host {
      display: block;
      margin-bottom: 16px;
    }
    :host([isfacilitator]) {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 0;
    }
    .timer-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: var(--retro-radius-sm);
      padding: 5px 10px;
      color: var(--retro-text-primary);
      cursor: pointer;
      font-family: var(--retro-font-mono);
      font-size: 14px;
      font-weight: 800;
      white-space: nowrap;
    }
    .timer-chip:hover {
      background: var(--retro-bg-hover);
    }
    .timer-chip .timer-display {
      font-size: 14px;
      min-width: 0;
      letter-spacing: 0;
    }
    .timer-readout {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--retro-font-mono);
    }
    .timer-readout .timer-display {
      font-size: 14px;
      min-width: 0;
      letter-spacing: 0;
    }
    .timer-btn.icon {
      width: 28px;
      height: 28px;
      padding: 0;
      justify-content: center;
      border-radius: 50%;
    }
    .timer-panel {
      position: absolute;
      bottom: calc(100% + 17px);
      left: 1.5px;
      z-index: 30;
      width: 300px;
      max-width: calc(100vw - 24px);
      padding: 12px;
      background: var(--retro-glass-bg-strong);
      border: 1px solid var(--retro-glass-border);
      border-radius: var(--retro-radius-md);
      box-shadow: var(--retro-shadow-float);
    }
    .panel-eyebrow {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 8px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--retro-text-muted);
    }
    .panel-readout {
      margin-bottom: 8px;
      font-family: var(--retro-font-mono);
      font-size: 30px;
      font-weight: 800;
      color: var(--retro-text-primary);
    }
    .timer-display {
      font-size: 22px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.5px;
      min-width: 58px;
      flex-shrink: 0;
    }
    .timer-display.green { color: var(--retro-timer-ok); }
    .timer-display.amber { color: #f97316; }
    .timer-display.red   { color: var(--retro-timer-late); }
    .timer-display.idle  { color: var(--retro-text-disabled); }
    .presets {
      display: flex;
      gap: 6px;
      margin-bottom: 10px;
    }
    .preset-btn {
      padding: 4px 10px;
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: var(--retro-radius-sm);
      font-size: 12px;
      color: var(--retro-text-secondary);
      cursor: pointer;
      font-family: inherit;
    }
    .preset-btn:hover {
      border-color: var(--retro-accent-border);
    }
    .preset-btn.active {
      background: var(--retro-accent-tint);
      border-color: color-mix(in srgb, var(--retro-accent) 50%, transparent);
      color: var(--retro-accent-ink);
    }
    .custom-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
    }
    .custom-input {
      width: 80px;
      padding: 5px 10px;
      border: 1px solid var(--retro-input-border);
      border-radius: var(--retro-radius-sm);
      font-size: 12px;
      font-family: inherit;
      background: var(--retro-input-bg);
      color: var(--retro-text-primary);
    }
    .custom-input:focus {
      outline: none;
      border-color: color-mix(in srgb, var(--retro-accent) 55%, transparent);
    }
    .custom-set-btn {
      padding: 5px 12px;
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: var(--retro-radius-sm);
      font-size: 12px;
      font-weight: 500;
      color: var(--retro-text-primary);
      cursor: pointer;
      font-family: inherit;
    }
    .timer-actions {
      display: flex;
      gap: 6px;
    }
    .timer-btn {
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
      transition: opacity 0.12s;
    }
    .timer-btn:hover:not(:disabled) {
      opacity: 0.85;
    }
    .timer-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .timer-btn.secondary {
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      color: var(--retro-text-primary);
      font-weight: 500;
    }
    .timer-btn.secondary:hover:not(:disabled) {
      opacity: 1;
      border-color: var(--retro-text-secondary);
    }

    /* Participant view: compact pill */
    .timer-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--retro-glass-bg-medium);
      border: 1px solid var(--retro-border-default);
      border-radius: 999px;
      box-shadow: var(--retro-glass-shadow);
      padding: 5px 12px;
      font-family: var(--retro-font-mono);
    }
    .timer-pill .timer-display {
      font-size: 15px;
      min-width: 0;
      letter-spacing: 0;
    }
    .mute-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: var(--retro-radius-sm);
      padding: 5px 12px;
      font-size: 12px;
      cursor: pointer;
      color: var(--retro-text-primary);
      font-family: inherit;
      transition: all 0.12s;
    }
    .mute-btn:hover {
      border-color: var(--retro-text-secondary);
    }
    .mute-btn.muted {
      color: var(--retro-text-disabled);
    }
    .mute-btn-pill {
      display: inline-flex;
      align-items: center;
      background: none;
      border: none;
      padding: 0;
      font-size: 11px;
      cursor: pointer;
      color: var(--retro-text-secondary);
      transition: color 0.12s;
    }
    .mute-btn-pill:hover {
      color: var(--retro-text-secondary);
    }
  `]

  updated(changedProperties: Map<string | number | symbol, unknown>): void {
    if (changedProperties.has('timer')) {
      this.syncFromTimer()
    }
  }

  connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('keydown', this.onKeydown)
    document.addEventListener('click', this.onOutsideClick)
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    document.removeEventListener('keydown', this.onKeydown)
    document.removeEventListener('click', this.onOutsideClick)
    this.clearTimer()
  }

  private onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.open = false
  }

  private onOutsideClick = (e: MouseEvent): void => {
    if (!e.composedPath().includes(this)) this.open = false
  }

  private clearTimer(): void {
    if (this._interval !== null) {
      clearInterval(this._interval)
      this._interval = null
    }
  }

  private playDing(): void {
    if (this._muted) return
    try {
      if (!this._audioCtx) this._audioCtx = new AudioContext()
      const ctx = this._audioCtx
      if (ctx.state === 'suspended') void ctx.resume()
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, t)
      gain.gain.setValueAtTime(0.4, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5)
      osc.start(t)
      osc.stop(t + 1.5)
    } catch { /* audio unavailable */ }
  }

  private toggleMute(): void {
    this._muted = !this._muted
    localStorage.setItem('retro_timer_muted', String(this._muted))
    this.requestUpdate()
  }

  private syncFromTimer(): void {
    this.clearTimer()
    if (!this.timer) {
      this.displaySeconds = 0
      return
    }
    this.displaySeconds = Math.round(computeRemaining(this.timer, Date.now()))
    if (this.timer.started_at) {
      this._interval = window.setInterval(() => {
        if (!this.timer?.started_at) {
          this.clearTimer()
          return
        }
        const remaining = Math.round(computeRemaining(this.timer, Date.now()))
        const wasRunning = this.displaySeconds > 0
        this.displaySeconds = remaining
        if (remaining <= 0) {
          if (wasRunning) this.playDing()
          this.clearTimer()
        }
      }, 1000)
    }
  }

  private formatTime(seconds: number): string {
    const s = Math.max(0, Math.round(seconds))
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  private get colorClass(): string {
    if (!this.timer) return 'idle'
    const pct = this.displaySeconds / this.timer.duration_seconds
    if (pct > 0.25) return 'green'
    if (pct > 0.1) return 'amber'
    return 'red'
  }

  private get isRunning(): boolean {
    return !!this.timer?.started_at
  }

  private get activePreset(): number | null {
    const seconds = this.timer ? this.timer.duration_seconds : DEFAULT_SECONDS
    const match = PRESETS.find((p) => p.seconds === seconds)
    return match?.seconds ?? null
  }

  private async onSetDuration(seconds: number): Promise<void> {
    await api.setTimerDuration(this.sessionId, seconds, this.facilitatorToken, this.participantName)
  }

  private async onSetCustom(): Promise<void> {
    const minutes = parseFloat(this.customMinutes)
    if (isNaN(minutes) || minutes <= 0) return
    await api.setTimerDuration(this.sessionId, Math.round(minutes * 60), this.facilitatorToken, this.participantName)
    this.customMinutes = ''
  }

  private async onStartClick(): Promise<void> {
    if (!this.timer) {
      await api.setTimerDuration(this.sessionId, DEFAULT_SECONDS, this.facilitatorToken, this.participantName)
    }
    await this.onStart()
  }

  private async onStart(): Promise<void> {
    await api.startTimer(this.sessionId, this.facilitatorToken, this.participantName)
  }

  private async onPause(): Promise<void> {
    await api.pauseTimer(this.sessionId, this.facilitatorToken, this.participantName)
  }

  private async onReset(): Promise<void> {
    if (!this.timer) return
    await api.resetTimer(this.sessionId, this.facilitatorToken, this.participantName)
  }

  render() {
    if (!this.isFacilitator) {
      // Read-only pill for participants
      // retro-board only renders retro-timer when isFacilitator||timer, so this guard
      // is structurally unreachable for participants — only fires if timer is cleared
      // via SSE while mounted (Lit removes the element before that happens in practice).
      /* istanbul ignore next */
      if (!this.timer) return html``
      return html`
        <div class="timer-pill">
          ${designIcon('clock', 14)}
          <span class="timer-display ${this.colorClass}">${this.formatTime(this.displaySeconds)}</span>
          <button
            class="mute-btn-pill"
            title=${this._muted ? 'Unmute timer sound' : 'Mute timer sound'}
            @click=${this.toggleMute}
          >${this._muted ? designIcon('mute', 13) : designIcon('volume', 13)}</button>
        </div>
      `
    }

    const state = this.isRunning ? (this.displaySeconds <= 0 ? 'up' : 'running') : 'idle'
    const idleSeconds = this.timer ? this.displaySeconds : DEFAULT_SECONDS
    const isPreset = this.activePreset

    if (state === 'running') {
      return html`
        <span class="timer-readout">
          ${designIcon('clock', 14)}
          <span class="timer-display ${this.colorClass}">${this.formatTime(this.displaySeconds)}</span>
        </span>
        <button class="timer-btn secondary" @click=${this.onPause}>${designIcon('pause', 11)} Pause</button>
        <button class="timer-btn secondary icon" aria-label="Reset timer" title="Reset timer" @click=${this.onReset}>${designIcon('history', 13)}</button>
      `
    }
    if (state === 'up') {
      return html`
        <span class="timer-readout">
          ${designIcon('clock', 14)}
          <span class="timer-display red">${this.formatTime(0)}</span>
        </span>
        <button class="timer-btn" @click=${this.onReset}>Reset</button>
      `
    }
    return html`
      <button
        class="timer-chip"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-label="Set timer"
        title="Set timer"
        @click=${() => { this.open = !this.open }}
      >
        ${designIcon('clock', 14)}
        <span class="timer-display idle-time">${this.formatTime(idleSeconds)}</span>
        ${designIcon('chevronUp', 12)}
      </button>
      <button class="timer-btn" @click=${this.onStartClick}>
        ${designIcon('play', 10)} ${this.timer?.paused_remaining != null ? 'Resume' : 'Start'}
      </button>
      ${this.open ? this.renderPanel(isPreset) : ''}
    `
  }

  private renderPanel(isPreset: number | null) {
    return html`
      <div class="timer-panel">
        <div class="panel-eyebrow">${designIcon('clock', 12)} Timer</div>
        <div class="panel-readout">${this.formatTime(this.timer ? this.displaySeconds : DEFAULT_SECONDS)}</div>
        <div class="presets">
          ${PRESETS.map(
            (p) => html`
              <button
                class="preset-btn ${isPreset === p.seconds ? 'active' : ''}"
                @click=${() => this.onSetDuration(p.seconds)}
              >${p.label}</button>
            `,
          )}
        </div>

        <div class="custom-row">
          <input
            class="custom-input"
            type="number"
            min="0.5"
            max="120"
            step="0.5"
            placeholder="min"
            aria-label="Custom minutes"
            .value=${this.customMinutes}
            @input=${(e: Event) => { this.customMinutes = (e.target as HTMLInputElement).value }}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this.onSetCustom() }}
          />
          <button
            class="custom-set-btn"
            aria-disabled=${!this.customMinutes || isNaN(parseFloat(this.customMinutes)) ? 'true' : 'false'}
            @click=${this.onSetCustom}
          >Set</button>
        </div>

        <div class="timer-actions">
          <button
            class="timer-btn secondary"
            aria-disabled=${this.timer ? 'false' : 'true'}
            @click=${this.onReset}
          >Reset</button>
          <button
            class="mute-btn ${this._muted ? 'muted' : ''}"
            title=${this._muted ? 'Unmute timer sound' : 'Mute timer sound'}
            @click=${this.toggleMute}
          >${this._muted ? designIcon('mute', 13) : designIcon('volume', 13)}</button>
        </div>
      </div>
    `
  }
}
