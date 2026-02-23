import type { Session } from './types'

type SessionUpdatedCallback = (session: Session) => void

/**
 * Thin wrapper around EventSource.
 * EventSource auto-reconnects on error — we only need to parse messages
 * and forward them to the callback.
 */
export class SSEClient {
  private eventSource: EventSource | null = null

  constructor(
    private readonly sessionId: string,
    private readonly onUpdate: SessionUpdatedCallback,
  ) {}

  connect(): void {
    this.eventSource = new EventSource(`/api/v1/sessions/${this.sessionId}/stream`)

    this.eventSource.onmessage = (event: MessageEvent) => {
      try {
        const session = JSON.parse(event.data as string) as Session
        this.onUpdate(session)
      } catch (err) {
        console.warn('[SSE] Failed to parse message', err)
      }
    }

    this.eventSource.onerror = () => {
      // EventSource handles reconnection automatically
    }
  }

  disconnect(): void {
    this.eventSource?.close()
    this.eventSource = null
  }
}
