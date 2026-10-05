import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'

import type { ChangelogEntry } from '../generated/changelog'

import './consent-banner'
import './feedback-dialog'
import './whats-new-dialog'

/**
 * The one place non-blocking notifications live. Everything that used to be a
 * full-screen modal with a backdrop (feedback, what's new) is now a card in
 * this dock, alongside the consent banner that was already shaped this way.
 *
 * The dock is a single `position: fixed` container in document.body — the
 * cards themselves do no positioning at all, so several can be on screen at
 * once and stack instead of covering each other. Bottom-LEFT, because
 * board-notes and session-history dock to the right edge.
 *
 * `column-reverse` + append order means the first notification sits nearest
 * the corner and later ones grow upward, so an arriving card never shifts the
 * one the user is already reading.
 */

type NotificationKind = 'consent' | 'feedback' | 'whats-new'

interface NotificationItem {
  kind: NotificationKind
  onClose?: () => void
  sessionId?: string
  participantName?: string
  entry?: ChangelogEntry
}

@customElement('notification-dock')
export class NotificationDock extends LitElement {
  @state() private items: NotificationItem[] = []

  static styles = css`
    :host {
      position: fixed;
      left: 12px;
      bottom: 12px;
      z-index: 300;
      /* Like every other overlay in this app: the container never eats a
         click meant for the board behind it — only the cards' own controls
         opt back in. */
      pointer-events: none;
      display: flex;
      flex-direction: column-reverse;
      gap: 8px;
      width: 320px;
      max-width: calc(100vw - 24px);
      max-height: calc(100vh - 24px);
    }

    @media (max-width: 480px) {
      :host {
        left: 8px;
        right: 8px;
        bottom: 8px;
        width: auto;
      }
    }
  `

  /** Queue a notification. A kind already on screen is never stacked twice. */
  show(item: NotificationItem): void {
    if (this.items.some((i) => i.kind === item.kind)) return
    this.items = [...this.items, item]
  }

  private close(kind: NotificationKind): void {
    const item = this.items.find((i) => i.kind === kind)
    if (!item) return
    this.items = this.items.filter((i) => i.kind !== kind)
    item.onClose?.()
  }

  private renderItem(item: NotificationItem) {
    switch (item.kind) {
      case 'consent':
        return html`
          <consent-banner @consent-closed=${() => this.close('consent')}></consent-banner>
        `
      case 'feedback':
        return html`
          <feedback-dialog
            .open=${true}
            .sessionId=${item.sessionId ?? ''}
            .participantName=${item.participantName ?? ''}
            @feedback-dismissed=${() => this.close('feedback')}
          ></feedback-dialog>
        `
      case 'whats-new':
        return html`
          <whats-new-dialog
            .open=${true}
            .entry=${item.entry ?? null}
            @whats-new-acknowledged=${() => this.close('whats-new')}
          ></whats-new-dialog>
        `
    }
  }

  render() {
    return html`${this.items.map((item) => this.renderItem(item))}`
  }
}

let dockEl: NotificationDock | null = null

function dock(): NotificationDock {
  if (!dockEl || !dockEl.isConnected) {
    dockEl = document.createElement('notification-dock')
    document.body.appendChild(dockEl)
  }
  return dockEl
}

export interface FeedbackNotificationOptions {
  sessionId?: string
  participantName?: string
  onClose?: () => void
}

/**
 * Call sites don't own the dock or its DOM — they just ask for a card. The
 * dock is created on first use and reused after that.
 */
export const notifications = {
  consent(onClose?: () => void): void {
    dock().show({ kind: 'consent', onClose })
  },

  feedback(options: FeedbackNotificationOptions = {}): void {
    dock().show({ kind: 'feedback', ...options })
  },

  whatsNew(entry: ChangelogEntry, options: { onClose?: () => void } = {}): void {
    dock().show({ kind: 'whats-new', entry, ...options })
  },
}

declare global {
  interface HTMLElementTagNameMap {
    'notification-dock': NotificationDock
  }
}
