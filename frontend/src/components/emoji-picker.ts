import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import { EMOJI_GROUPS, type EmojiGroup } from '../emoji-data'
import { computePopupPosition } from '../popup-position'
import { bacon } from '../theme'

/**
 * Self-contained trigger + searchable popup over the full standard Unicode
 * emoji set (unicode-emoji-json), grouped like a native emoji picker.
 * Dispatches "pick-emoji" ({ emoji }) and closes itself on pick/outside-click/Escape.
 * `trigger-label`/`trigger-title` customize the toggle button for callers
 * that aren't the reaction "+" (e.g. inserting emoji into card text).
 */
@customElement('emoji-picker')
export class EmojiPicker extends LitElement {
  @property({ attribute: 'trigger-label' }) triggerLabel = '+'
  @property({ attribute: 'trigger-title' }) triggerTitle = 'Add reaction'

  @state() private open = false
  @state() private search = ''
  @state() private popupStyle = ''

  private _outsideClickListener!: (e: MouseEvent) => void
  private _escListener!: (e: KeyboardEvent) => void
  private _scrollListener!: (e: Event) => void
  private _resizeListener!: () => void

  static styles = css`
    :host {
      position: relative;
      display: inline-block;
    }
    .trigger {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 1px dashed var(--retro-border-default);
      background: none;
      color: var(--retro-text-muted);
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .trigger:hover {
      border-color: var(--retro-accent);
      color: var(--retro-accent);
    }
    .popup {
      /* popover="manual" promotes this to the top layer via showPopover(),
         which is what actually makes position:fixed viewport-relative here.
         Any ancestor with backdrop-filter/filter/transform/will-change
         (e.g. .column's frosted-glass background in retro-column.ts) turns
         itself into the containing block for a plain position:fixed
         descendant per spec — even at blur(0px) — so top/left computed
         against window.innerWidth/innerHeight landed hundreds of pixels
         off and let the popup spill outside that ancestor's (overflow:
         visible) box, inflating the scrollable area into spurious
         scrollbars. The top layer is exempt from all of that, by design.
         Positioned via inline style, computed from the trigger's real
         screen position and clamped to the true viewport. */
      position: fixed;
      margin: 0;
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
    .group-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--retro-text-muted);
      margin: 8px 2px 4px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }
    .emoji-btn {
      font-size: 16px;
      line-height: 1;
      padding: 5px 0;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 6px;
    }
    .emoji-btn:hover {
      background: var(--retro-bg-subtle);
    }
    .no-results {
      font-size: 12px;
      color: var(--retro-text-muted);
      text-align: center;
      margin: 12px 0;
    }
  `

  connectedCallback(): void {
    super.connectedCallback()
    this._outsideClickListener = (e: MouseEvent) => {
      if (this.open && !e.composedPath().includes(this)) this.close()
    }
    document.addEventListener('click', this._outsideClickListener)
    this._escListener = (e: KeyboardEvent) => {
      if (this.open && e.key === 'Escape') this.close()
    }
    document.addEventListener('keydown', this._escListener)
    // A scroll anywhere (the page, or a scrollable ancestor like .columns)
    // can move the trigger without moving us — close rather than show a
    // stale position. capture:true so this fires even for non-bubbling
    // scroll on an inner container.
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
  }

  private close(): void {
    this.shadowRoot?.querySelector<HTMLElement>('.popup')?.hidePopover()
    this.open = false
    this.search = ''
  }

  private async toggleOpen(): Promise<void> {
    this.open = !this.open
    if (this.open) {
      await this.updateComplete
      this.positionPopup()
      this.shadowRoot?.querySelector<HTMLElement>('.popup')?.showPopover()
    }
  }

  private pick(emoji: string): void {
    this.dispatchEvent(new CustomEvent('pick-emoji', { detail: { emoji }, bubbles: true, composed: true }))
    this.close()
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

  private get filteredGroups(): EmojiGroup[] {
    const q = this.search.trim().toLowerCase()
    if (!q) return EMOJI_GROUPS
    return EMOJI_GROUPS.map((g) => ({ ...g, emojis: g.emojis.filter((e) => e.name.includes(q)) }))
      .filter((g) => g.emojis.length > 0)
  }

  render() {
    const groups = this.filteredGroups
    return html`
      <button
        class="trigger"
        @click=${() => void this.toggleOpen()}
        title=${this.triggerTitle}
        aria-label=${this.triggerTitle}
        aria-haspopup="true"
        aria-expanded=${this.open}
      >${this.triggerLabel}</button>
      ${this.open ? html`
        <div class="popup" popover="manual" style=${this.popupStyle}>
          <input
            class="search-input"
            type="text"
            placeholder="Search emoji"
            .value=${this.search}
            @input=${(e: Event) => { this.search = (e.target as HTMLInputElement).value }}
            autofocus
          />
          ${groups.length === 0
            ? html`<p class="no-results">No emoji found</p>`
            : groups.map((g) => html`
                <div class="group-label">${g.name}</div>
                <div class="grid">
                  ${g.emojis.map((e) => html`
                    <button class="emoji-btn" title=${e.name} @click=${() => this.pick(e.emoji)}
                    >${e.emoji === '🥓' ? bacon() : e.emoji}</button>
                  `)}
                </div>
              `)}
        </div>
      ` : ''}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'emoji-picker': EmojiPicker
  }
}
