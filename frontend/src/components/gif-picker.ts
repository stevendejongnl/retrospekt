import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'

import { api } from '../api'
import { computePopupPosition } from '../popup-position'
import type { GifResult } from '../types'

const SEARCH_DEBOUNCE_MS = 350

/**
 * Self-contained "GIF" trigger + searchable popup over GIPHY/Tenor (whichever
 * the backend has an API key for — see GET /api/v1/gifs/status). Renders
 * nothing at all when neither provider is configured, same as the Sentry
 * health widgets. Dispatches "pick-gif" ({ url }) and closes itself on
 * pick/outside-click/Escape/scroll, mirroring emoji-picker.ts.
 */
@customElement('gif-picker')
export class GifPicker extends LitElement {
  @state() private enabled = false
  @state() private open = false
  @state() private search = ''
  @state() private results: GifResult[] = []
  @state() private loading = false
  @state() private popupStyle = ''

  private _outsideClickListener!: (e: MouseEvent) => void
  private _escListener!: (e: KeyboardEvent) => void
  private _scrollListener!: (e: Event) => void
  private _resizeListener!: () => void
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null

  static styles = css`
    :host {
      position: relative;
      display: inline-block;
      z-index: 250;
    }
    .trigger {
      height: 26px;
      padding: 0 8px;
      border-radius: 13px;
      border: 1px dashed var(--retro-border-default);
      background: none;
      color: var(--retro-text-muted);
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .trigger:hover {
      border-color: var(--retro-accent);
      color: var(--retro-accent);
    }
    .popup {
      position: fixed;
      box-sizing: border-box;
      width: 260px;
      max-height: 260px;
      overflow-y: auto;
      background: var(--retro-glass-bg-strong);
      backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: 12px;
      box-shadow: var(--retro-glass-shadow);
      padding: 8px;
      z-index: 200;
    }
    .search-input {
      width: 100%;
      box-sizing: border-box;
      padding: 6px 8px;
      font-size: 12px;
      font-family: inherit;
      border: 1px solid var(--retro-border-default);
      border-radius: 8px;
      background: var(--retro-bg-subtle);
      color: var(--retro-text-primary);
      margin-bottom: 6px;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--retro-accent);
    }
    .status {
      font-size: 12px;
      color: var(--retro-text-muted);
      text-align: center;
      margin: 12px 0;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4px;
    }
    .gif-btn {
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 6px;
      overflow: hidden;
      line-height: 0;
    }
    .gif-btn img {
      width: 100%;
      height: 80px;
      object-fit: cover;
      display: block;
    }
  `

  connectedCallback(): void {
    super.connectedCallback()
    void api.getGifsStatus().then((s) => { this.enabled = s.enabled }).catch(() => { this.enabled = false })

    this._outsideClickListener = (e: MouseEvent) => {
      if (this.open && !e.composedPath().includes(this)) this.close()
    }
    document.addEventListener('click', this._outsideClickListener)
    this._escListener = (e: KeyboardEvent) => {
      if (this.open && e.key === 'Escape') this.close()
    }
    document.addEventListener('keydown', this._escListener)
    this._scrollListener = () => { if (this.open) this.close() }
    document.addEventListener('scroll', this._scrollListener, true)
    this._resizeListener = () => { if (this.open) this.positionPopup() }
    window.addEventListener('resize', this._resizeListener)
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    document.removeEventListener('click', this._outsideClickListener)
    document.removeEventListener('keydown', this._escListener)
    document.removeEventListener('scroll', this._scrollListener, true)
    window.removeEventListener('resize', this._resizeListener)
    if (this._debounceTimer) clearTimeout(this._debounceTimer)
  }

  private close(): void {
    this.open = false
    this.search = ''
    this.results = []
  }

  private async toggleOpen(): Promise<void> {
    this.open = !this.open
    if (this.open) {
      await this.updateComplete
      this.positionPopup()
    }
  }

  private positionPopup(): void {
    const trigger = this.shadowRoot?.querySelector('.trigger') as HTMLElement | null
    if (!trigger) return
    const { top, left } = computePopupPosition(
      trigger.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
      260,
      260,
    )
    this.popupStyle = `top:${top}px; left:${left}px;`
  }

  private onSearchInput(e: Event): void {
    this.search = (e.target as HTMLInputElement).value
    if (this._debounceTimer) clearTimeout(this._debounceTimer)
    this._debounceTimer = setTimeout(() => void this.runSearch(), SEARCH_DEBOUNCE_MS)
  }

  private async runSearch(): Promise<void> {
    const q = this.search.trim()
    if (!q) {
      this.results = []
      return
    }
    this.loading = true
    try {
      this.results = await api.searchGifs(q)
    } catch {
      this.results = []
    } finally {
      this.loading = false
    }
  }

  private pick(url: string): void {
    this.dispatchEvent(new CustomEvent('pick-gif', { detail: { url }, bubbles: true, composed: true }))
    this.close()
  }

  render() {
    if (!this.enabled) return html``
    return html`
      <button
        class="trigger"
        @click=${() => void this.toggleOpen()}
        title="Insert a GIF"
        aria-label="Insert a GIF"
        aria-haspopup="true"
        aria-expanded=${this.open}
      >GIF</button>
      ${this.open ? html`
        <div class="popup" style=${this.popupStyle}>
          <input
            class="search-input"
            type="text"
            placeholder="Search GIFs"
            .value=${this.search}
            @input=${(e: Event) => this.onSearchInput(e)}
            autofocus
          />
          ${this.loading ? html`<p class="status">Searching…</p>` : ''}
          ${!this.loading && this.search.trim() !== '' && this.results.length === 0
            ? html`<p class="status">No GIFs found</p>`
            : ''}
          <div class="grid">
            ${this.results.map((r) => html`
              <button class="gif-btn" title="Insert GIF" @click=${() => this.pick(r.url)}>
                <img src=${r.preview_url} alt="" loading="lazy" />
              </button>
            `)}
          </div>
        </div>
      ` : ''}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gif-picker': GifPicker
  }
}
