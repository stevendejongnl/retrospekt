import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { TimerState } from '../types'
import { api } from '../api'
import { faIconStyles, iconClock, iconPlay, iconPause, iconRotateLeft, iconVolumeHigh, iconVolumeXmark } from '../icons'

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
  @property({ type: Boolean }) isFacilitator = false
  @property({ type: String }) facilitatorToken = ''

  @state() private displaySeconds = 0
  @state() private customMinutes = ''

  private _interval: number | null = null
  private _muted = localStorage.getItem('retro_timer_muted') === 'true'
  private _audioCtx: AudioContext | null = null

  static styles = [faIconStyles, css`
    :host {
      display: block;
      margin-bottom: 16px;
    }
    .timer-panel {
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .timer-heading {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--retro-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      flex-shrink: 0;
    }
    .timer-display {
      font-size: 22px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.5px;
      min-width: 58px;
      flex-shrink: 0;
    }
    .timer-display.green { color: #22c55e; }
    .timer-display.amber { color: #f97316; }
    .timer-display.red   { color: #ef4444; }
    .timer-display.idle  { color: var(--retro-text-disabled); }
    .presets {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .preset-btn {
      background: none;
      border: 1px solid var(--retro-border-default);
      border-radius: 6px;
      padding: 3px 9px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      color: var(--retro-text-secondary);
      font-family: inherit;
      transition: all 0.12s;
    }
    .preset-btn:hover {
      border-color: var(--retro-accent);
      color: var(--retro-accent);
    }
    .preset-btn.active {
      background: var(--retro-accent);
      border-color: var(--retro-accent);
      color: white;
    }
    .custom-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .custom-input {
      width: 52px;
      padding: 3px 7px;
      border: 1px solid var(--retro-border-default);
      border-radius: 6px;
      font-size: 12px;
      font-family: inherit;
      background: var(--retro-bg-surface);
      color: var(--retro-text-primary);
    }
    .custom-input:focus {
      outline: none;
      border-color: var(--retro-accent);
    }
    .custom-set-btn {
      background: none;
      border: 1px solid var(--retro-border-default);
      border-radius: 6px;
      padding: 3px 9px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      color: var(--retro-text-secondary);
      font-family: inherit;
      transition: all 0.12s;
    }
    .custom-set-btn:hover:not(:disabled) {
      border-color: var(--retro-accent);
      color: var(--retro-accent);
    }
    .custom-set-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .timer-actions {
      display: flex;
      gap: 6px;
      margin-left: auto;
    }
    .timer-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: var(--retro-accent);
      color: white;
      border: none;
      border-radius: 7px;
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
      background: none;
      border: 1px solid var(--retro-border-default);
      color: var(--retro-text-secondary);
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
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: 20px;
      padding: 6px 14px;
    }
    .mute-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: 1px solid var(--retro-border-default);
      border-radius: 7px;
      padding: 5px 8px;
      font-size: 12px;
      cursor: pointer;
      color: var(--retro-text-secondary);
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
      padding: 0 2px;
      font-size: 11px;
      cursor: pointer;
      color: var(--retro-text-disabled);
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

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.clearTimer()
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
    return `${m}:${sec.toString().padStart(2, '0')}`
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
    if (!this.timer) return null
    const match = PRESETS.find((p) => p.seconds === this.timer!.duration_seconds)
    return match?.seconds ?? null
  }

  private async onSetDuration(seconds: number): Promise<void> {
    await api.setTimerDuration(this.sessionId, seconds, this.facilitatorToken)
  }

  private async onSetCustom(): Promise<void> {
    const minutes = parseFloat(this.customMinutes)
    if (isNaN(minutes) || minutes <= 0) return
    await api.setTimerDuration(this.sessionId, Math.round(minutes * 60), this.facilitatorToken)
    this.customMinutes = ''
  }

  private async onStart(): Promise<void> {
    await api.startTimer(this.sessionId, this.facilitatorToken)
  }

  private async onPause(): Promise<void> {
    await api.pauseTimer(this.sessionId, this.facilitatorToken)
  }

  private async onReset(): Promise<void> {
    await api.resetTimer(this.sessionId, this.facilitatorToken)
  }

  render() {
    if (!this.isFacilitator) {
      // Read-only pill for participants
      if (!this.timer) return html``
      return html`
        <div class="timer-pill">
          ${iconClock()}
          <span class="timer-display ${this.colorClass}" style="font-size:16px">
            ${this.formatTime(this.displaySeconds)}
          </span>
          <button
            class="mute-btn-pill"
            title=${this._muted ? 'Unmute timer sound' : 'Mute timer sound'}
            @click=${this.toggleMute}
          >${this._muted ? iconVolumeXmark() : iconVolumeHigh()}</button>
        </div>
      `
    }

    const canStart = !!this.timer && !this.isRunning && this.displaySeconds > 0
    const isPreset = this.activePreset

    return html`
      <div class="timer-panel">
        <span class="timer-heading">${iconClock()} Timer</span>

        ${this.timer
          ? html`
              <span class="timer-display ${this.colorClass}">
                ${this.formatTime(this.displaySeconds)}
              </span>
            `
          : ''}

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
            .value=${this.customMinutes}
            @input=${(e: Event) => { this.customMinutes = (e.target as HTMLInputElement).value }}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this.onSetCustom() }}
          />
          <button
            class="custom-set-btn"
            ?disabled=${!this.customMinutes || isNaN(parseFloat(this.customMinutes))}
            @click=${this.onSetCustom}
          >Set</button>
        </div>

        <div class="timer-actions">
          ${this.isRunning
            ? html`
                <button class="timer-btn" @click=${this.onPause}>
                  ${iconPause()} Pause
                </button>
              `
            : html`
                <button class="timer-btn" ?disabled=${!canStart} @click=${this.onStart}>
                  ${iconPlay()} ${this.timer?.paused_remaining != null ? 'Resume' : 'Start'}
                </button>
              `}
          <button
            class="timer-btn secondary"
            ?disabled=${!this.timer}
            @click=${this.onReset}
          >${iconRotateLeft()} Reset</button>
          <button
            class="mute-btn ${this._muted ? 'muted' : ''}"
            title=${this._muted ? 'Unmute timer sound' : 'Mute timer sound'}
            @click=${this.toggleMute}
          >${this._muted ? iconVolumeXmark() : iconVolumeHigh()}</button>
        </div>
      </div>
    `
  }
}
