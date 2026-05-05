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
      filter: blur(60px);
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
    @keyframes drift-0 {
      0%   { transform: translate(-50%, -50%) scale(1); }
      33%  { transform: translate(calc(-50% + 80px), calc(-50% - 60px)) scale(1.08); }
      66%  { transform: translate(calc(-50% - 50px), calc(-50% + 70px)) scale(0.95); }
      100% { transform: translate(calc(-50% + 40px), calc(-50% + 30px)) scale(1.05); }
    }
    @keyframes drift-1 {
      0%   { transform: translate(-50%, -50%) scale(1.05); }
      33%  { transform: translate(calc(-50% - 70px), calc(-50% + 50px)) scale(0.96); }
      66%  { transform: translate(calc(-50% + 60px), calc(-50% - 80px)) scale(1.1); }
      100% { transform: translate(calc(-50% - 30px), calc(-50% - 40px)) scale(1); }
    }
    @keyframes drift-2 {
      0%   { transform: translate(-50%, -50%) scale(0.97); }
      33%  { transform: translate(calc(-50% + 50px), calc(-50% + 80px)) scale(1.06); }
      66%  { transform: translate(calc(-50% - 60px), calc(-50% - 50px)) scale(0.93); }
      100% { transform: translate(calc(-50% + 20px), calc(-50% + 60px)) scale(1.03); }
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
      { color: 'oklch(0.88 0.10 55)', x: '10%', y: '15%', size: 700, opacity: 0.7 },
      { color: 'oklch(0.90 0.07 25)', x: '82%', y: '72%', size: 600, opacity: 0.65 },
      { color: 'oklch(0.92 0.04 250)', x: '55%', y: '50%', size: 520, opacity: 0.55 },
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
