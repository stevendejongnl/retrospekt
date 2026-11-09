import { LitElement, css, html } from 'lit'
import { baseStyles } from '../styles'
import { customElement } from 'lit/decorators.js'

import { bacon } from '../theme'

@customElement('privacy-page')
export class PrivacyPage extends LitElement {
  static styles = [baseStyles, css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--retro-bg-page);
      color: var(--retro-text-secondary);
    }
    .content {
      max-width: 828px; /* 780px of content plus the 24px side padding */
      margin: 0 auto;
      padding: 32px 24px 64px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .page-header {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .back-link {
      color: var(--retro-accent-ink);
      text-decoration: none;
      font-size: 13px;
      white-space: nowrap;
    }
    .back-link:hover {
      text-decoration: underline;
    }
    .page-title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--retro-text-primary);
    }
    .headline {
      font-size: 30px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: var(--retro-text-primary);
    }
    .headline em {
      font-style: normal;
      color: var(--retro-accent-ink);
    }
    .intro {
      font-size: 14px;
      line-height: 1.6;
      color: var(--retro-text-secondary);
    }
    .card {
      padding: 16px 20px;
      background: var(--retro-glass-bg-medium);
      border: 1px solid var(--retro-glass-border);
      border-radius: var(--retro-radius-md);
      box-shadow: var(--retro-glass-shadow);
    }
    .card h3 {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--retro-text-primary);
      margin-bottom: 4px;
    }
    .card p {
      font-size: 13px;
      line-height: 1.6;
      color: var(--retro-text-secondary);
    }
    .card a {
      color: var(--retro-accent-ink);
    }
    @media (max-width: 720px) {
      .content {
        padding: 24px 16px 48px;
      }
    }
  `]

  render() {
    return html`
      <div class="content">
        <header class="page-header">
          <a class="back-link" href="/" @click=${(e: Event) => { e.preventDefault(); window.router.navigate('/') }}>← Back</a>
          <h1 class="page-title">Privacy</h1>
        </header>

        <h2 class="headline">${bacon()} Privacy at Retro<em>spekt</em></h2>
        <p class="intro">A plain-language summary of what this instance collects and why.</p>

        <section class="card">
          <h3>Retro data</h3>
          <p>
            Your display name, cards, votes, reactions, and board notes are stored to run the
            retrospective and are shared with everyone in that session — there's no login, the
            name you type is your identity for that session. Sessions (and everything in them)
            expire automatically after a fixed number of days of inactivity, configured by whoever
            runs this instance.
          </p>
        </section>

        <section class="card">
          <h3>Feedback</h3>
          <p>
            The feedback form sends your rating, comment, display name, and app version to the
            people running this instance so they can improve it. Feedback isn't automatically
            deleted — it's kept until a maintainer removes it.
          </p>
        </section>

        <section class="card">
          <h3>Analytics</h3>
          <p>
            We use a self-hosted <a href="https://matomo.org" target="_blank" rel="noopener noreferrer">Matomo</a>
            instance to see which pages and features are used. This only runs after you accept the
            banner — nothing is tracked before that, and you can decline. It records page views and
            feature usage, not card/note contents.
          </p>
        </section>

        <section class="card">
          <h3>Error monitoring</h3>
          <p>
            We use <a href="https://sentry.io" target="_blank" rel="noopener noreferrer">Sentry</a>
            to catch crashes and bugs. Error reports are tagged with a session id but not your
            display name.
          </p>
        </section>

        <section class="card">
          <h3>Questions</h3>
          <p>
            This is a self-hosted, open-source tool — see the
            <a href="https://github.com/stevendejongnl/retrospekt" target="_blank" rel="noopener noreferrer">source on GitHub</a>
            for exactly what runs, or ask whoever operates this instance.
          </p>
        </section>
      </div>
    `
  }
}
