import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import { baseStyles } from '../styles'
import type { FeedbackStats } from '../types'

@customElement('feedback-panel')
export class FeedbackPanel extends LitElement {
  @property({ attribute: false }) feedback: FeedbackStats | null = null
  @property({ attribute: false }) adminToken = ''
  @state() private feedbackTab: 'new' | 'resolved' = 'new'

  private _onIgnoreClick(id: string): void {
    this.dispatchEvent(new CustomEvent('ignore-feedback', { detail: { id }, bubbles: true, composed: true }))
  }

  render() {
    if (!this.feedback) return nothing
    const feedback = this.feedback

    const newEntries = feedback.recent.filter((e) => e.status === 'new')
    const resolvedEntries = feedback.recent.filter((e) => e.status !== 'new')
    const visibleEntries = this.feedbackTab === 'new' ? newEntries : resolvedEntries

    return html`
      <section class="feedback-block">
        <div class="eyebrow">Feedback comments</div>

        ${feedback.recent.length > 0 ? html`
          <div class="feedback-tabs">
            <button
              class="feedback-tab-btn ${this.feedbackTab === 'new' ? 'active' : ''}"
              aria-pressed=${this.feedbackTab === 'new'}
              @click=${() => { this.feedbackTab = 'new' }}
            >New (${newEntries.length})</button>
            <button
              class="feedback-tab-btn ${this.feedbackTab === 'resolved' ? 'active' : ''}"
              aria-pressed=${this.feedbackTab === 'resolved'}
              @click=${() => { this.feedbackTab = 'resolved' }}
            >Resolved (${resolvedEntries.length})</button>
          </div>

          ${visibleEntries.length > 0 ? html`
            <div class="feedback-list">
              ${visibleEntries.map((entry) => html`
                <div class="feedback-entry">
                  <div class="feedback-entry-meta">
                    <span class="feedback-stars" aria-label="${entry.rating} of 5 stars">${'★'.repeat(entry.rating)}${'☆'.repeat(5 - entry.rating)}</span>
                    ${entry.participant_name ? html`<span class="feedback-participant">${entry.participant_name}</span>` : nothing}
                    <span class="feedback-entry-date">${new Date(entry.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                    ${entry.app_version ? html`<span class="feedback-version">${entry.app_version}</span>` : nothing}
                    ${entry.status === 'fixed' && entry.fixed_in_version ? html`
                      <a
                        class="feedback-fixed-badge"
                        href="/changelog#v${entry.fixed_in_version}"
                        @click=${(e: Event) => {
                          e.preventDefault()
                          window.router.navigate(`/changelog#v${entry.fixed_in_version}`)
                        }}
                      >fixed in ${entry.fixed_in_version}</a>
                    ` : nothing}
                    ${entry.status === 'ignored' ? html`<span class="feedback-ignored-badge">ignored</span>` : nothing}
                  </div>
                  <div class="feedback-entry-body">
                    <p class="feedback-entry-comment">${entry.comment || '—'}</p>
                    ${entry.status === 'new' ? html`
                      <button class="feedback-ignore-btn" @click=${() => this._onIgnoreClick(entry.id)}>Ignore</button>
                    ` : nothing}
                  </div>
                </div>
              `)}
            </div>
          ` : html`<p class="muted">Nothing here.</p>`}
        ` : html`<p class="muted">No feedback submitted yet.</p>`}
      </section>
    `
  }

  static styles = [baseStyles, css`
    :host {
      display: block;
    }
    .feedback-block {
      padding: 18px;
      background: var(--retro-bg-surface);
      border: 1px solid var(--retro-border-default);
      border-radius: var(--retro-radius-md);
      box-shadow: var(--retro-glass-shadow);
    }
    .eyebrow {
      margin-bottom: 12px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--retro-text-muted);
    }
    .muted {
      font-size: 13px;
      color: var(--retro-text-secondary);
    }
    .feedback-tabs {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
    }
    .feedback-tab-btn {
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      background: var(--retro-bg-subtle);
      color: var(--retro-text-secondary);
      border: 1px solid var(--retro-border-default);
    }
    .feedback-tab-btn.active {
      font-weight: 600;
      background: var(--retro-accent-tint);
      color: var(--retro-accent-ink);
      border-color: color-mix(in srgb, var(--retro-accent) 50%, transparent);
    }
    .feedback-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .feedback-entry {
      padding: 10px 12px;
      border-radius: var(--retro-radius-md);
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
    }
    .feedback-entry-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
      font-size: 11px;
      color: var(--retro-text-muted);
    }
    .feedback-stars {
      color: var(--retro-accent-ink);
      letter-spacing: 1px;
    }
    .feedback-version {
      font-family: var(--retro-font-mono);
    }
    .feedback-entry-body {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .feedback-entry-comment {
      font-size: 13px;
      line-height: 1.5;
      color: var(--retro-text-primary);
    }
    .feedback-fixed-badge,
    .feedback-ignored-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: var(--retro-radius-md);
      font-size: 11px;
      font-weight: 500;
      text-decoration: none;
    }
    .feedback-fixed-badge {
      background: var(--retro-accent-tint);
      color: var(--retro-accent-ink);
      border: 1px solid color-mix(in srgb, var(--retro-accent) 35%, transparent);
    }
    .feedback-fixed-badge:hover {
      text-decoration: underline;
    }
    .feedback-ignored-badge {
      background: var(--retro-bg-subtle);
      color: var(--retro-text-secondary);
      border: 1px solid var(--retro-border-default);
    }
    .feedback-ignore-btn {
      padding: 5px 12px;
      background: var(--retro-bg-subtle);
      border: 1px solid var(--retro-border-default);
      border-radius: var(--retro-radius-sm);
      font-size: 12px;
      font-weight: 500;
      font-family: inherit;
      color: var(--retro-text-primary);
      cursor: pointer;
      flex-shrink: 0;
    }
    .feedback-ignore-btn:hover {
      background: var(--retro-bg-hover);
    }
  `]
}

declare global {
  interface HTMLElementTagNameMap {
    'feedback-panel': FeedbackPanel
  }
}
