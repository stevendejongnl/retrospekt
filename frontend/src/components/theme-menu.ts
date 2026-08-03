import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'

import { faIconStyles, iconSun, iconMoon } from '../icons'
import { getEffectiveTheme, getThemePreference, setThemePreference, getHalalMode, setHalalMode } from '../theme'

@customElement('theme-menu')
export class ThemeMenu extends LitElement {
  @state() private isDark = getEffectiveTheme() === 'dark'
  @state() private preference = getThemePreference()
  @state() private halal = getHalalMode()
  @state() private open = false

  private _themeListener!: EventListener
  private _outsideClickListener!: (e: MouseEvent) => void
  private _escListener!: (e: KeyboardEvent) => void

  static styles = [faIconStyles, css`
    :host {
      position: relative;
      display: inline-block;
    }

    .theme-toggle {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 1.5px solid var(--retro-border-default);
      background: none;
      cursor: pointer;
      color: var(--retro-text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: background 0.12s, border-color 0.12s;
    }
    .theme-toggle:hover {
      background: var(--retro-bg-subtle);
      color: var(--retro-text-primary);
    }

    .popup {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      background: var(--retro-glass-bg-strong);
      backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: 12px;
      box-shadow: var(--retro-glass-shadow);
      padding: 10px;
      min-width: 160px;
      z-index: 200;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 8px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      color: var(--retro-text-primary);
      background: none;
      border: none;
      font-family: inherit;
      text-align: left;
      width: 100%;
    }
    .option:hover {
      background: var(--retro-bg-subtle);
    }
    .option.selected {
      color: var(--retro-accent);
      font-weight: 600;
    }

    .divider {
      height: 1px;
      background: var(--retro-border-subtle);
      margin: 6px 0;
    }

    .halal-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 8px;
      font-size: 13px;
      color: var(--retro-text-primary);
      cursor: pointer;
    }
  `]

  connectedCallback(): void {
    super.connectedCallback()
    this._themeListener = () => {
      this.isDark = getEffectiveTheme() === 'dark'
      this.preference = getThemePreference()
      this.halal = getHalalMode()
    }
    window.addEventListener('retro-theme-change', this._themeListener)
    window.addEventListener('retro-halal-change', this._themeListener)
    this._outsideClickListener = (e: MouseEvent) => {
      if (this.open && !e.composedPath().includes(this)) this.open = false
    }
    document.addEventListener('click', this._outsideClickListener)
    this._escListener = (e: KeyboardEvent) => {
      if (this.open && e.key === 'Escape') this.open = false
    }
    document.addEventListener('keydown', this._escListener)
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    window.removeEventListener('retro-theme-change', this._themeListener)
    window.removeEventListener('retro-halal-change', this._themeListener)
    document.removeEventListener('click', this._outsideClickListener)
    document.removeEventListener('keydown', this._escListener)
  }

  render() {
    return html`
      <button
        class="theme-toggle"
        @click=${() => { this.open = !this.open }}
        aria-label="Theme settings"
        aria-haspopup="true"
        aria-expanded=${this.open}
      >${this.isDark ? iconSun() : iconMoon()}</button>
      ${this.open ? html`
        <div class="popup">
          <button
            class="option ${this.preference === 'light' ? 'selected' : ''}"
            @click=${() => setThemePreference('light')}
          >Light</button>
          <button
            class="option ${this.preference === 'dark' ? 'selected' : ''}"
            @click=${() => setThemePreference('dark')}
          >Dark</button>
          <button
            class="option ${this.preference === 'system' ? 'selected' : ''}"
            @click=${() => setThemePreference('system')}
          >System</button>
          <div class="divider"></div>
          <label class="halal-option">
            <input
              type="checkbox"
              .checked=${this.halal}
              @change=${(e: Event) => setHalalMode((e.target as HTMLInputElement).checked)}
            />
            Halal mode
          </label>
        </div>
      ` : ''}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'theme-menu': ThemeMenu
  }
}
