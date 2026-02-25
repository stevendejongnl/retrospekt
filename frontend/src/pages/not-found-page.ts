import { LitElement, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'

@customElement('not-found-page')
export class NotFoundPage extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      flex-direction: column;
      gap: 12px;
      background: var(--retro-bg-page);
      color: var(--retro-text-muted);
      text-align: center;
      padding: 24px;
    }
    .emoji {
      font-size: 64px;
    }
    h2 {
      font-size: 24px;
      color: var(--retro-text-primary);
      font-weight: 800;
    }
    a {
      color: var(--retro-accent);
      font-size: 15px;
    }
    .github-link {
      margin-top: 8px;
      font-size: 12px;
      color: var(--retro-text-muted);
    }
    .github-link a {
      font-size: 12px;
      color: var(--retro-text-muted);
      text-decoration: underline;
    }
  `

  render() {
    return html`
      <span class="emoji">🥓</span>
      <h2>404 — Nothing to retrospekt</h2>
      <p>This page never made it past the collecting phase.</p>
      <a href="/" @click=${(e: Event) => { e.preventDefault(); window.router.navigate('/') }}>
        ← Back to home
      </a>
      <p class="github-link">
        <a href="https://github.com/stevendejongnl/retrospekt" target="_blank" rel="noopener noreferrer">github.com/stevendejongnl/retrospekt</a>
      </p>
    `
  }
}
