import { LitElement, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'

import '../components/background-blobs'
import { bacon } from '../theme'

@customElement('privacy-page')
export class PrivacyPage extends LitElement {
  static styles = css`
    :host {
      display: flex;
      justify-content: center;
      min-height: 100vh;
      background: var(--retro-bg-page);
      padding: 48px 24px;
      position: relative;
      overflow: hidden;
    }
    .content {
      position: relative;
      z-index: 1;
      max-width: 640px;
      width: 100%;
      color: var(--retro-text-secondary);
      font-size: 14px;
      line-height: 1.6;
    }
    h1 {
      font-size: 26px;
      color: var(--retro-text-primary);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }
    h1 em {
      font-style: normal;
      color: var(--retro-accent);
    }
    .updated {
      font-size: 12px;
      color: var(--retro-text-muted);
      margin-bottom: 24px;
    }
    h2 {
      font-size: 16px;
      color: var(--retro-text-primary);
      margin: 28px 0 8px;
    }
    ul {
      margin: 0 0 8px;
      padding-left: 20px;
    }
    li {
      margin-bottom: 4px;
    }
    a {
      color: var(--retro-accent);
    }
    .back-pill {
      display: inline-flex;
      align-items: center;
      margin-top: 32px;
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
  `

  render() {
    return html`
      <background-blobs></background-blobs>
      <div class="content">
        <h1>${bacon()} Privacy at Retro<em>spekt</em></h1>
        <p class="updated">A plain-language summary of what this instance collects and why.</p>

        <h2>Retro data</h2>
        <p>
          Your display name, cards, votes, reactions, and board notes are stored to run the
          retrospective and are shared with everyone in that session — there's no login, the
          name you type is your identity for that session. Sessions (and everything in them)
          expire automatically after a fixed number of days of inactivity, configured by whoever
          runs this instance.
        </p>

        <h2>Feedback</h2>
        <p>
          The 💬 feedback form sends your rating, comment, display name, and app version to the
          people running this instance so they can improve it. Feedback isn't automatically
          deleted — it's kept until a maintainer removes it.
        </p>

        <h2>Analytics</h2>
        <p>
          We use a self-hosted <a href="https://matomo.org" target="_blank" rel="noopener noreferrer">Matomo</a>
          instance to see which pages and features are used. This only runs after you accept the
          banner — nothing is tracked before that, and you can decline. It records page views and
          feature usage, not card/note contents.
        </p>

        <h2>Error monitoring</h2>
        <p>
          We use <a href="https://sentry.io" target="_blank" rel="noopener noreferrer">Sentry</a>
          to catch crashes and bugs. Error reports are tagged with a session id but not your
          display name.
        </p>

        <h2>Questions</h2>
        <p>
          This is a self-hosted, open-source tool — see the
          <a href="https://github.com/stevendejongnl/retrospekt" target="_blank" rel="noopener noreferrer">source on GitHub</a>
          for exactly what runs, or ask whoever operates this instance.
        </p>

        <a class="back-pill" href="/" @click=${(e: Event) => { e.preventDefault(); window.router.navigate('/') }}>
          ← Back to home
        </a>
      </div>
    `
  }
}
