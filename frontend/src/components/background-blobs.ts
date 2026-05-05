import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'

@customElement('background-blobs')
export class BackgroundBlobs extends LitElement {
  @state() private dark = false

  static styles = css`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      border-radius: inherit;
      z-index: 0;
    }
    .blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(40px);
      transform: translate(-50%, -50%);
    }
    .blob-0 { animation: drift-0 120s ease-in-out 0s infinite alternate; }
    .blob-1 { animation: drift-1 150s ease-in-out -30s infinite alternate; }
    .blob-2 { animation: drift-2 180s ease-in-out -60s infinite alternate; }
    .noise {
      position: absolute;
      inset: 0;
      opacity: 0.25;
      mix-blend-mode: soft-light;
    }
    :host([dark]) .noise {
      opacity: 0.4;
      mix-blend-mode: overlay;
    }
  `

  connectedCallback() {
    super.connectedCallback()
    this.dark = document.documentElement.getAttribute('data-theme') === 'dark'
    window.addEventListener('retro-theme-change', this._onThemeChange)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('retro-theme-change', this._onThemeChange)
  }

  private _onThemeChange = () => {
    this.dark = document.documentElement.getAttribute('data-theme') === 'dark'
  }

  private get _blobs() {
    if (this.dark) {
      return [
        { color: 'oklch(0.55 0.18 45)', x: '12%', y: '18%', size: 540, opacity: 0.55 },
        { color: 'oklch(0.42 0.12 25)', x: '82%', y: '72%', size: 480, opacity: 0.55 },
        { color: 'oklch(0.38 0.06 280)', x: '52%', y: '50%', size: 420, opacity: 0.55 },
      ]
    }
    return [
      { color: 'oklch(0.97 0.04 55)', x: '10%', y: '15%', size: 620, opacity: 0.55 },
      { color: 'oklch(0.98 0.025 25)', x: '82%', y: '72%', size: 540, opacity: 0.55 },
      { color: 'oklch(0.985 0.015 250)', x: '55%', y: '50%', size: 460, opacity: 0.55 },
    ]
  }

  render() {
    const noiseOpacity = this.dark ? 0.5 : 0.2
    const noiseUri = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='${noiseOpacity}'/></svg>")`
    return html`
      ${this._blobs.map((b, i) => html`
        <div
          class="blob blob-${i}"
          style="
            left: ${b.x};
            top: ${b.y};
            width: ${b.size}px;
            height: ${b.size}px;
            background: radial-gradient(circle at 35% 35%, ${b.color}, transparent 65%);
            opacity: ${b.opacity};
          "
        ></div>
      `)}
      <div class="noise" style="background-image: ${noiseUri};"></div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'background-blobs': BackgroundBlobs
  }
}
