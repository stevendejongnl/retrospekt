import * as Sentry from '@sentry/browser'
import { LitElement, PropertyValues, css, html, nothing } from 'lit'
import { baseStyles } from '../styles'
import { customElement, property, state } from 'lit/decorators.js'

import type { Session, SessionPhase } from '../types'
import { api } from '../api'
import { SSEClient } from '../sse'
import { storage } from '../storage'
import { getBrand, clearBrand, bacon, getThemePreference, setThemePreference, getHalalMode, setHalalMode } from '../theme'
import { tagManager } from '../analytics'
import {
  faIconStyles,
  csLogo,
  designIcon,
} from '../icons'
import '../components/retro-board'
import '../components/phase-stepper'
import '../components/retro-timer'
import '../components/session-history'
import '../components/board-notes'
import { notifications } from '../components/notification-dock'
import '../components/retro-help'
import { CHANGELOG } from '../generated/changelog'
import { semverGt } from '../storage'
import { exportFilename, sessionToMarkdown } from '../export-markdown'

const IDLE_THRESHOLD_MS = 10 * 60 * 1000  // 10 minutes
const FEEDBACK_CLOSE_DELAY_MS = 1500       // delay before showing after session close

@customElement('session-page')
export class SessionPage extends LitElement {
  @property({ attribute: 'session-id', type: String }) sessionId = ''

  @state() private session: Session | null = null
  @state() private participantName = ''
  @state() private nameInput = ''
  @state() private nameTakenError = false
  @state() private renamingName = false
  @state() private renameInput = ''
  @state() private renameTakenError = false
  @state() private loading = true
  @state() private showNamePrompt = false
  @state() private copied = false
  @state() private openPanel: 'share' | 'actions' | 'menu' | null = null
  @state() private themeOpen = false
  @state() private brand = getBrand()
  @state() private showHelp = false
  @state() private showHistory = false
  @state() private showNotes = false

  // Not @state: the notification dock renders these, not this template.
  // The flag only exists so the idle check doesn't keep re-asking while the
  // feedback card is already on screen.
  private feedbackOpen = false

  private sseClient: SSEClient | null = null
  private _halalListener!: EventListener
  private _brandListener!: EventListener
  private _idleCheckInterval: ReturnType<typeof setInterval> | null = null
  private _lastActivityAt = Date.now()
  private _onActivity = (): void => { this._lastActivityAt = Date.now() }

  static styles = [ baseStyles, faIconStyles, css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--retro-bg-page);
      position: relative;
      overflow-x: hidden;
    }

    /* ── Header ── */
    header {
      position: sticky;
      top: 0;
      z-index: 20;
      height: 56px;
      background: var(--retro-glass-bg-strong);
      backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      border-bottom: 1px solid var(--retro-glass-border);
      padding: 0 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 6.4px;
      font-size: 16px;
      font-weight: 700;
      color: var(--retro-text-primary);
      text-decoration: none;
      letter-spacing: -0.02em;
      cursor: pointer;
      flex-shrink: 0;
    }
    .brand-mark {
      font-size: 17.6px;
      filter: saturate(1.1);
    }
    .brand em {
      font-style: normal;
      color: var(--retro-accent);
    }
    .cs-collab {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 400;
      color: var(--retro-text-muted);
      letter-spacing: 0;
    }
    .cs-logo {
      height: 1.1em;
      width: auto;
      flex-shrink: 0;
      vertical-align: middle;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 0;
    }
    .header-tools {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .session-title {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
      font-size: 14px;
      font-weight: 700;
      color: var(--retro-text-primary);
      white-space: nowrap;
    }
    .session-date {
      color: var(--retro-text-muted);
      font-size: 12px;
      font-weight: 400;
    }
    .icon-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--retro-input-bg);
      border: 1px solid var(--retro-border-default);
      color: var(--retro-text-secondary);
      cursor: pointer;
      font-size: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.12s, color 0.12s;
      flex-shrink: 0;
    }
    .icon-btn:hover {
      border-color: var(--retro-accent);
      color: var(--retro-accent);
    }

    .icon-btn.active {
      border-color: color-mix(in srgb, var(--retro-accent) 50%, transparent);
      color: var(--retro-accent-ink);
      background: var(--retro-accent-tint);
    }
    .actions-wrap {
      position: relative;
      display: inline-flex;
    }
    .actions-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 999px;
      background: var(--retro-accent);
      color: var(--retro-accent-contrast);
      font-size: 10px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }
    .header-votes {
      font-size: 12px;
      font-weight: 600;
      color: var(--retro-text-secondary);
      white-space: nowrap;
    }
    .pop-wrap {
      position: relative;
    }
    .popover {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 30;
      padding: 12px;
      background: var(--retro-glass-bg-strong);
      border: 1px solid var(--retro-glass-border);
      border-radius: var(--retro-radius-md);
      box-shadow: var(--retro-shadow-float);
      box-sizing: border-box;
    }
    .eyebrow {
      margin-bottom: 8px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--retro-text-muted);
    }
    .people-eyebrow {
      margin-top: 12px;
      margin-bottom: 6px;
    }
    .people {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .share-person {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 10px 2px 2px;
      border-radius: 999px;
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      font-size: 12px;
      color: var(--retro-text-primary);
    }
    .person-avatar {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--retro-accent);
      color: var(--retro-accent-contrast);
      font-size: 10px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .share-popover {
      top: calc(100% + 21px);
      right: 1px;
      width: 340px;
    }
    .actions-popover {
      width: 340px;
      top: calc(100% + 18px);
      right: -9px;
    }
    .action-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .action-row {
      padding: 8px 10px;
      border-radius: var(--retro-radius-sm);
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
    }
    .action-text {
      font-size: 13px;
      color: var(--retro-text-primary);
    }
    .action-meta {
      margin-top: 2px;
      font-size: 11px;
      color: var(--retro-text-muted);
    }
    .popover-empty {
      margin: 0;
      font-size: 12px;
      color: var(--retro-text-secondary);
    }
    .avatar-menu-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px 3px 3px;
      border-radius: 999px;
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      font-family: inherit;
      font-size: 13px;
      color: var(--retro-text-primary);
      cursor: pointer;
    }
    .avatar-menu-btn.open {
      border-color: color-mix(in srgb, var(--retro-accent) 50%, transparent);
    }
    .user-menu {
      width: 210px;
      padding: 6px;
      top: calc(100% + 17px);
    }
    .menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 10px;
      border: none;
      border-radius: var(--retro-radius-sm);
      background: none;
      font-family: inherit;
      font-size: 13px;
      color: var(--retro-text-primary);
      text-align: left;
      cursor: pointer;
      box-sizing: border-box;
    }
    .menu-item svg {
      color: var(--retro-text-secondary);
    }
    .menu-item:hover {
      background: var(--retro-bg-hover);
    }
    .menu-sub {
      padding: 2px 0 4px 34px;
    }
    .menu-choice.selected {
      color: var(--retro-accent-ink);
      font-weight: 600;
    }
    .menu-halal {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      font-size: 13px;
      color: var(--retro-text-secondary);
    }
    .user-chip {
      position: relative;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .avatar {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--retro-accent);
      color: var(--retro-accent-contrast);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .avatar-name {
      font-size: 13px;
      color: var(--retro-text-primary);
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
    }
    .avatar-name:hover {
      text-decoration: underline;
    }
    .avatar-name-input {
      width: 110px;
      font-size: 13px;
      font-family: inherit;
      padding: 3px 6px;
      border: 1.5px solid var(--retro-accent);
      border-radius: var(--retro-radius-sm);
      background: var(--retro-bg-surface);
      color: var(--retro-text-primary);
    }
    .avatar-name-input:focus {
      outline: none;
    }
    .rename-error {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      padding: 4px 8px;
      background: var(--retro-bg-surface);
      border: 1px solid var(--retro-error);
      border-radius: var(--retro-radius-sm);
      white-space: nowrap;
    }
    @media (max-width: 640px) {
      header {
        padding: 0 12px;
        gap: 8px;
      }
      .session-title {
        display: none;
      }
      phase-stepper {
        display: none;
      }
      .avatar-name {
        display: none;
      }
      .cs-collab {
        display: none;
      }
    }

    /* ── Main ── */
    main {
      max-width: 1280px;
      margin: 0 auto;
      padding: 14px 24px 40px;
    }

    /* ── Share popover ── */
    .header-countdown retro-timer {
      display: block;
      margin: 0;
    }
    .share-wrap {
      position: relative;
      display: inline-flex;
    }
    .share-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: var(--retro-radius-sm);
      color: var(--retro-text-primary);
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
    }
    .share-btn[aria-expanded='true'] {
      border-color: color-mix(in srgb, var(--retro-accent) 50%, transparent);
      color: var(--retro-accent-ink);
    }
    .share-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: var(--retro-radius-sm);
    }
    .share-url {
      flex: 1;
      min-width: 0;
      font-size: 11px;
      color: var(--retro-text-secondary);
      font-family: var(--retro-font-mono);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .copy-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      padding: 5px 12px;
      background: var(--retro-accent);
      border: 1px solid var(--retro-accent-border);
      border-radius: var(--retro-radius-sm);
      color: var(--retro-accent-contrast);
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .export-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      margin-top: 8px;
      padding: 5px 12px;
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: var(--retro-radius-sm);
      color: var(--retro-text-primary);
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }

    /* ── States ── */
    .state-center {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 50vh;
      flex-direction: column;
      gap: 12px;
      color: var(--retro-text-disabled);
      font-size: 16px;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--retro-border-subtle);
      border-top-color: var(--retro-accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    /* ── Name prompt overlay ── */
    .overlay {
      position: fixed;
      inset: 0;
      background: var(--retro-overlay-bg);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 24px;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
    header.dimmed {
      opacity: 0.4;
      filter: blur(2px);
    }
    .name-card {
      background: var(--retro-glass-bg-strong);
      border: 1px solid var(--retro-glass-border);
      border-radius: var(--retro-radius-lg);
      padding: 28px;
      max-width: 380px;
      width: 100%;
      text-align: center;
      box-shadow: var(--retro-shadow-float);
    }
    .name-card .logo {
      font-size: 44px;
      line-height: 1;
      filter: drop-shadow(0 8px 24px oklch(0.65 0.18 45 / 0.35));
      user-select: none;
    }
    .name-card h2 {
      font-size: 22px;
      font-weight: 800;
      color: var(--retro-text-primary);
      margin: 10px 0 4px;
      letter-spacing: -0.02em;
    }
    .name-card p {
      font-size: 13px;
      color: var(--retro-text-secondary);
      margin: 0 0 16px;
    }
    .name-card input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--retro-input-border);
      border-radius: var(--retro-radius-md);
      font-size: 14px;
      font-family: inherit;
      text-align: center;
      background: var(--retro-input-bg);
      color: var(--retro-text-primary);
      outline: none;
    }
    .name-card input:focus {
      border-color: color-mix(in srgb, var(--retro-accent) 55%, transparent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--retro-accent) 14%, transparent);
    }
    .name-card input[aria-invalid='true'] {
      border-color: var(--retro-error-border);
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.14);
    }
    .name-card input::placeholder {
      color: var(--retro-text-muted);
    }
    .name-card .name-error {
      margin: 8px 0 0;
      font-size: 12px;
      color: var(--retro-error-ink);
      text-align: center;
    }
    .name-card button {
      width: 100%;
      margin-top: 14px;
      padding: 12px;
      background: var(--retro-accent);
      color: var(--retro-accent-contrast);
      border: 1px solid var(--retro-accent-border);
      border-radius: var(--retro-radius-sm);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s;
    }
    .name-card button:hover:not(:disabled) {
      background: var(--retro-accent-hover);
    }
    .name-card button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `]

  async connectedCallback(): Promise<void> {
    super.connectedCallback()
    this._halalListener = () => {
      this.requestUpdate()
    }
    this._brandListener = () => {
      this.brand = getBrand()
    }
    window.addEventListener('retro-halal-change', this._halalListener)
    window.addEventListener('retro-brand-change', this._brandListener)
    window.addEventListener('pointermove', this._onActivity)
    window.addEventListener('keydown', this._onActivity)
    this._idleCheckInterval = setInterval(() => this._checkIdle(), 30_000)
    await this.loadSession()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.sseClient?.disconnect()
    window.removeEventListener('retro-halal-change', this._halalListener)
    window.removeEventListener('retro-brand-change', this._brandListener)
    window.removeEventListener('pointermove', this._onActivity)
    window.removeEventListener('keydown', this._onActivity)
    document.removeEventListener('keydown', this._onPanelKeydown)
    document.removeEventListener('click', this._onPanelOutsideClick, true)
    if (this._idleCheckInterval !== null) clearInterval(this._idleCheckInterval)
  }

  private async loadSession(): Promise<void> {
    this.loading = true

    try {
      const session = await api.getSession(this.sessionId)
      this.session = session

      const storedName = storage.getName(this.sessionId)
      if (storedName) {
        this.participantName = storedName
        /* istanbul ignore next */
        Sentry.setTag('session_id', this.sessionId)
        await api.joinSession(this.sessionId, storedName)
        this.saveToHistory(session, storedName)
      } else {
        this.showNamePrompt = true
      }

      this.sseClient = new SSEClient(this.sessionId, (updated) => {
        this.session = updated
        if (this.participantName) {
          this.saveToHistory(updated, this.participantName)
        }
      })
      this.sseClient.connect()
      this._checkWhatsNew()
    } catch {
      window.router.navigate('/?session_not_found')
    } finally {
      this.loading = false
    }
  }

  private async submitName(): Promise<void> {
    const name = this.nameInput.trim()
    if (!name) return

    const taken = this.session?.participants.some(
      (p) => p.name.toLowerCase() === name.toLowerCase(),
    )
    if (taken) {
      this.nameTakenError = true
      return
    }

    storage.setName(this.sessionId, name)
    this.participantName = name
    /* istanbul ignore next */
    Sentry.setTag('session_id', this.sessionId)
    this.showNamePrompt = false
    await api.joinSession(this.sessionId, name)
    if (this.session) this.saveToHistory(this.session, name)
  }

  private startRename(): void {
    this.renameInput = this.participantName
    this.renameTakenError = false
    this.renamingName = true
  }

  private cancelRename(): void {
    this.renamingName = false
    this.renameTakenError = false
  }

  private async saveRename(): Promise<void> {
    const name = this.renameInput.trim()
    if (!name || name === this.participantName) {
      this.cancelRename()
      return
    }

    const taken = this.session?.participants.some(
      (p) => p.name.toLowerCase() === name.toLowerCase() &&
        p.name.toLowerCase() !== this.participantName.toLowerCase(),
    )
    if (taken) {
      this.renameTakenError = true
      return
    }

    storage.setName(this.sessionId, name)
    this.participantName = name
    this.renamingName = false
    this.renameTakenError = false
    await api.joinSession(this.sessionId, name)
    if (this.session) this.saveToHistory(this.session, name)
  }

  private get isFacilitator(): boolean {
    return !!this.session && (storage.isFacilitator(this.session.id) || !!this.session.open_facilitator)
  }

  private async onPhaseSelect(e: CustomEvent<SessionPhase>): Promise<void> {
    if (!this.session || !this.isFacilitator) return
    await api.setPhase(this.session.id, e.detail, storage.getFacilitatorToken(this.session.id) ?? '', this.participantName)
  }

  private togglePanel(name: 'share' | 'actions' | 'menu'): void {
    if (this.openPanel === name) {
      this.closePanel()
      return
    }
    if (!this.openPanel) {
      document.addEventListener('keydown', this._onPanelKeydown)
      document.addEventListener('click', this._onPanelOutsideClick, true)
    }
    this.openPanel = name
    this.themeOpen = false
  }

  private closePanel(): void {
    this.openPanel = null
    this.themeOpen = false
    document.removeEventListener('keydown', this._onPanelKeydown)
    document.removeEventListener('click', this._onPanelOutsideClick, true)
  }

  private _onPanelKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.closePanel()
  }

  private _onPanelOutsideClick = (e: MouseEvent): void => {
    const wrap = this.renderRoot.querySelector('.pop-wrap[data-open]')
    if (wrap && !e.composedPath().includes(wrap)) this.closePanel()
  }

  private get votesUsed(): number {
    if (!this.session) return 0
    return this.session.cards.reduce((n, c) => n + c.votes.filter((v) => v.participant_name === this.participantName).length, 0)
  }

  private async copyUrl(): Promise<void> {
    await navigator.clipboard.writeText(window.location.href)
    this.copied = true
    setTimeout(() => (this.copied = false), 2000)
    tagManager.trackEvent('Session', 'copy_link')
  }

  private goHome(e: Event): void {
    e.preventDefault()
    window.router.navigate('/')
  }

  protected override updated(changedProps: PropertyValues): void {
    super.updated(changedProps)
    if (changedProps.has('session')) {
      const prev = changedProps.get('session') as Session | null
      // Show feedback after session closes
      if (prev && this.session?.phase === 'closed' && prev.phase !== 'closed') {
        setTimeout(() => this._openFeedback(), FEEDBACK_CLOSE_DELAY_MS)
      }
      // Reset idle timer on every SSE update
      this._lastActivityAt = Date.now()
    }
  }

  private _checkWhatsNew(): void {
    const history = storage.getHistory()
    // Only show to returning users — must have at least one *other* session in history
    const otherSessions = history.filter((e) => e.id !== this.sessionId)
    if (otherSessions.length === 0) return
    const lastSeen = storage.getMaxSeenChangelogVersion()
    const current = __APP_VERSION__
    if (!lastSeen || semverGt(current, lastSeen)) {
      const entry = CHANGELOG[0]
      if (entry) {
        notifications.whatsNew(entry, {
          onClose: () => storage.markChangelogSeen(this.sessionId, __APP_VERSION__),
        })
      }
    }
  }

  private _openFeedback(): void {
    if (this.feedbackOpen) return
    this.feedbackOpen = true
    notifications.feedback({
      sessionId: this.sessionId,
      participantName: this.participantName,
      onClose: () => { this.feedbackOpen = false },
    })
  }

  private _checkIdle(): void {
    if (this.feedbackOpen || !this.participantName) return
    if (Date.now() - this._lastActivityAt > IDLE_THRESHOLD_MS) {
      this._openFeedback()
    }
  }

  private saveToHistory(session: Session, name: string): void {
    storage.addOrUpdateHistory({
      id: session.id,
      name: session.name,
      phase: session.phase,
      created_at: session.created_at,
      participantName: name,
      isFacilitator: storage.isFacilitator(session.id),
      joinedAt: new Date().toISOString(),
    })
  }

  private exportSession(): void {
    if (!this.session) return
    const { session } = this
    const md = sessionToMarkdown(session)

    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportFilename(session.name)
    a.click()
    URL.revokeObjectURL(url)
    tagManager.trackEvent('Session', 'export_markdown')
  }


  private menuAction(action: () => void): void {
    this.closePanel()
    action()
  }

  private renderUserMenu() {
    const preference = getThemePreference()
    const choice = (value: 'light' | 'dark' | 'system', label: string) => html`
      <button
        class="menu-item menu-choice ${preference === value ? 'selected' : ''}"
        role="menuitemradio"
        aria-checked=${preference === value}
        @click=${() => { setThemePreference(value); this.requestUpdate() }}
      >${label}</button>
    `
    return html`
      <div class="popover user-menu" role="menu">
        <button class="menu-item menu-history" role="menuitem" @click=${() => this.menuAction(() => { this.showHistory = true })}>
          ${designIcon('history', 14)} Your sessions
        </button>
        <button class="menu-item menu-stats" role="menuitem" @click=${() => this.menuAction(() => window.router.navigate('/stats'))}>
          ${designIcon('chart', 14)} Stats
        </button>
        <button class="menu-item menu-feedback" role="menuitem" @click=${() => this.menuAction(() => this._openFeedback())}>
          ${designIcon('comment', 14)} Give feedback
        </button>
        ${this.brand === 'cs'
          ? html`<button class="menu-item brand-reset" role="menuitem" @click=${() => this.menuAction(clearBrand)}>${designIcon('theme', 14)} Reset theme</button>`
          : html`
              <button
                class="menu-item menu-theme"
                role="menuitem"
                aria-expanded=${this.themeOpen}
                @click=${() => { this.themeOpen = !this.themeOpen }}
              >${designIcon('theme', 14)} Theme</button>
              ${this.themeOpen
                ? html`
                    <div class="menu-sub">
                      ${choice('light', 'Light')}${choice('dark', 'Dark')}${choice('system', 'System')}
                      <label class="menu-halal">
                        <input type="checkbox" .checked=${getHalalMode()} @change=${(e: Event) => setHalalMode((e.target as HTMLInputElement).checked)} />
                        Halal mode
                      </label>
                    </div>
                  `
                : ''}
            `}
        <button class="menu-item menu-rename" role="menuitem" @click=${() => this.menuAction(() => this.startRename())}>
          ${designIcon('pencil', 14)} Change name
        </button>
        <button class="menu-item menu-help" role="menuitem" @click=${() => this.menuAction(() => { this.showHelp = true })}>
          ${designIcon('help', 14)} How it works
        </button>
      </div>
    `
  }

  render() {
    if (this.loading) {
      return html`
        <div class="state-center">
          <div class="spinner"></div>
          <span>Loading session…</span>
        </div>
      `
    }

    if (!this.session) return nothing

    const { session } = this
    const actionItems = session.cards.filter((c) => c.published && c.assignee)
    const maxVotes = session.max_votes_per_participant

    return html`
      <session-history .open=${this.showHistory} @close=${() => { this.showHistory = false }}></session-history>
      <board-notes
        .open=${this.showNotes}
        .notes=${session.notes}
        .participantName=${this.participantName}
        .sessionId=${this.sessionId}
        @close=${() => { this.showNotes = false }}
      ></board-notes>

      <retro-help .open=${this.showHelp} variant=${this.isFacilitator ? 'facilitator' : 'participant'} @close=${() => { this.showHelp = false }}></retro-help>

      ${this.showNamePrompt
        ? html`
            <div class="overlay">
              <div class="name-card">
                <div class="logo">${bacon()}</div>
                <h2>${session.name}</h2>
                <p>Enter your name to join the retrospective.</p>
                <label class="visually-hidden" for="join-name">Your name</label>
                <input
                  id="join-name"
                  type="text"
                  placeholder="Your name"
                  aria-invalid=${this.nameTakenError ? 'true' : 'false'}
                  .value=${this.nameInput}
                  @input=${(e: Event) => {
                    this.nameInput = (e.target as HTMLInputElement).value
                    this.nameTakenError = false
                  }}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter') void this.submitName()
                  }}
                  autofocus
                />
                ${this.nameTakenError
                  ? html`<p class="name-error">That name is already taken in this retro — try another.</p>`
                  : ''}
                <button @click=${this.submitName} ?disabled=${!this.nameInput.trim()}>
                  Join session →
                </button>
              </div>
            </div>
          `
        : ''}

      <header class=${this.showNamePrompt ? 'dimmed' : ''}>
        <div class="header-left">
        <span class="brand" @click=${this.goHome}><span class="brand-mark">${bacon()}</span><span>Retro<em>spekt</em></span>${getBrand() === 'cs' ? html`<span class="cs-collab">× ${csLogo()}</span>` : nothing}</span>
        <span class="session-title">
          <span>${session.name}</span><span class="session-date">${new Date(session.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
        </span>
        </div>
        <phase-stepper
          .phase=${session.phase}
          ?interactive=${this.isFacilitator}
          @phase-select=${this.onPhaseSelect}
        ></phase-stepper>
        <div class="header-tools">
        ${session.phase === 'discussing' && maxVotes
          ? html`<span class="header-votes">${this.votesUsed}/${maxVotes} votes</span>`
          : nothing}
        ${session.timer && (session.timer.started_at || !this.isFacilitator)
          ? html`<div class="header-countdown">
              <retro-timer .timer=${session.timer} .sessionId=${session.id} .participantName=${this.participantName}></retro-timer>
            </div>`
          : nothing}
        <div class="share-wrap pop-wrap" ?data-open=${this.openPanel === 'share'}>
          <button
            class="share-btn"
            aria-haspopup="dialog"
            aria-expanded=${this.openPanel === 'share'}
            @click=${() => this.togglePanel('share')}
          >${designIcon('link', 13)} Share ${designIcon('chevronDown', 12)}</button>
          ${this.openPanel === 'share'
            ? html`
                <div class="popover share-popover" role="dialog" aria-label="Share this board">
                  <div class="eyebrow">Share this board</div>
                  <div class="share-row">
                    <span class="share-url">${window.location.href.replace(/^https?:\/\//, '')}</span>
                    <button class="copy-btn" @click=${this.copyUrl}>
                      ${this.copied ? html`${designIcon('check', 13)} Copied` : 'Copy link'}
                    </button>
                  </div>
                  ${session.phase !== 'collecting'
                    ? html`
                        <button class="export-btn" @click=${() => { this.exportSession(); this.closePanel() }}>
                          ${designIcon('download', 13)} Export to Markdown
                        </button>
                      `
                    : ''}
                  <div class="eyebrow people-eyebrow">${session.participants.length} ${session.participants.length === 1 ? 'person' : 'people'} here</div>
                  <div class="people">
                    ${session.participants.map((p) => html`
                      <span class="share-person">
                        <span class="person-avatar">${p.name[0].toUpperCase()}</span>${p.name}
                      </span>
                    `)}
                  </div>
                </div>
              `
            : ''}
        </div>
        <div class="pop-wrap actions-wrap" ?data-open=${this.openPanel === 'actions'}>
          <button
            class="icon-btn ${this.openPanel === 'actions' ? 'active' : ''}"
            aria-label="Action items"
            title="Action items"
            aria-haspopup="dialog"
            aria-expanded=${this.openPanel === 'actions'}
            @click=${() => this.togglePanel('actions')}
          >${designIcon('tasks', 15)}</button>
          ${actionItems.length > 0 ? html`<span class="actions-badge" aria-hidden="true">${actionItems.length}</span>` : nothing}
          ${this.openPanel === 'actions'
            ? html`
                <div class="popover actions-popover" role="dialog" aria-label="Action items">
                  <div class="eyebrow">Action items · ${actionItems.length}</div>
                  ${actionItems.length === 0
                    ? html`<p class="popover-empty">Nothing is assigned yet. Assign a card to somebody and it shows up here.</p>`
                    : html`<div class="action-list">
                        ${actionItems.map((c) => html`
                          <div class="action-row">
                            <div class="action-text">${c.text}</div>
                            <div class="action-meta">Assigned to ${c.assignee} · from ${c.author_name}</div>
                          </div>
                        `)}
                      </div>`}
                </div>
              `
            : ''}
        </div>
        <button class="icon-btn" aria-label="Board notes" @click=${() => { this.showNotes = true }} title="Board notes">${designIcon('note', 15)}</button>
        ${this.participantName
          ? html`
              <div class="user-chip pop-wrap" ?data-open=${this.openPanel === 'menu'}>
                ${this.renamingName
                  ? html`
                      <div class="avatar">${this.participantName[0].toUpperCase()}</div>
                      <input
                        class="avatar-name-input"
                        .value=${this.renameInput}
                        @input=${(e: Event) => {
                          this.renameInput = (e.target as HTMLInputElement).value
                          this.renameTakenError = false
                        }}
                        @keydown=${(e: KeyboardEvent) => {
                          if (e.key === 'Enter') void this.saveRename()
                          if (e.key === 'Escape') this.cancelRename()
                        }}
                        @blur=${() => { if (this.renamingName) void this.saveRename() }}
                        autofocus
                      />
                    `
                  : html`
                      <button
                        class="avatar-menu-btn ${this.openPanel === 'menu' ? 'open' : ''}"
                        aria-haspopup="menu"
                        aria-expanded=${this.openPanel === 'menu'}
                        @click=${() => this.togglePanel('menu')}
                      >
                        <span class="avatar">${this.participantName[0].toUpperCase()}</span>
                        <span class="avatar-name">${this.participantName}</span>
                        ${designIcon('chevronDown', 12)}
                      </button>
                    `}
                ${this.openPanel === 'menu' ? this.renderUserMenu() : ''}
                ${this.renameTakenError
                  ? html`<p class="name-error rename-error">That name is already taken in this retro.</p>`
                  : ''}
              </div>
            `
          : ''}
        </div>
      </header>

      ${this.showNamePrompt
        ? nothing
        : html`<main>
            <retro-board .session=${session} .participantName=${this.participantName}></retro-board>
          </main>`}
    `
  }
}
