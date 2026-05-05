import { LitElement, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import '../components/background-blobs'

@customElement('not-found-page')
export class NotFoundPage extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      flex-direction: column;
      gap: 14px;
      background: var(--retro-bg-page);
      color: var(--retro-text-muted);
      text-align: center;
      padding: 24px;
      position: relative;
      overflow: hidden;
    }
    .content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .emoji {
      font-size: 64px;
      filter: drop-shadow(0 8px 24px rgba(217, 116, 38, 0.35));
    }
    h2 {
      font-size: 26px;
      color: var(--retro-text-primary);
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    h2 em {
      font-style: normal;
      color: var(--retro-accent);
    }
    p {
      font-size: 14px;
      color: var(--retro-text-secondary);
    }
    .back-pill {
      display: inline-flex;
      align-items: center;
      padding: 10px 22px;
      border-radius: 999px;
      background: var(--retro-glass-bg-strong);
      backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-strong)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      box-shadow: var(--retro-glass-shadow);
      font-size: 13px;
      font-weight: 600;
      color: var(--retro-accent);
      cursor: pointer;
      text-decoration: none;
      transition: opacity 0.12s;
    }
    .back-pill:hover {
      opacity: 0.85;
    }
    .github-link {
      margin-top: 4px;
      font-size: 11px;
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    }
    .github-link a {
      font-size: 11px;
      color: var(--retro-text-muted);
      text-decoration: underline;
      text-decoration-color: rgba(0, 0, 0, 0.2);
      text-underline-offset: 3px;
    }
  `

  render() {
    return html`
      <background-blobs></background-blobs>
      <div class="content">
        <span class="emoji">🥓</span>
        <h2>404 — Nothing to retro<em>spekt</em></h2>
        <p>This page never made it past the collecting phase.</p>
        <a class="back-pill" href="/" @click=${(e: Event) => { e.preventDefault(); window.router.navigate('/') }}>
          ← Back to home
        </a>
        <p class="github-link">
          <a href="https://github.com/stevendejongnl/retrospekt" target="_blank" rel="noopener noreferrer">github.com/stevendejongnl/retrospekt</a>
        </p>
      </div>
    `
  }
}
