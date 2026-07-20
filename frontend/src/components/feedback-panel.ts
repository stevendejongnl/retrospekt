import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

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
      <div class="feedback-block chart-block">
        <h3 class="chart-title">Feedback Comments</h3>

        ${feedback.recent.length > 0 ? html`
          <div class="feedback-tabs">
            <button
              class="feedback-tab-btn ${this.feedbackTab === 'new' ? 'active' : ''}"
              @click=${() => { this.feedbackTab = 'new' }}
            >New (${newEntries.length})</button>
            <button
              class="feedback-tab-btn ${this.feedbackTab === 'resolved' ? 'active' : ''}"
              @click=${() => { this.feedbackTab = 'resolved' }}
            >Resolved (${resolvedEntries.length})</button>
          </div>

          ${visibleEntries.length > 0 ? html`
            <div class="feedback-list">
              ${visibleEntries.map((entry) => html`
                <div class="feedback-entry">
                  <div class="feedback-entry-meta">
                    <span class="feedback-stars">${'★'.repeat(entry.rating)}${'☆'.repeat(5 - entry.rating)}</span>
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
                      >✓ fixed in ${entry.fixed_in_version}</a>
                    ` : nothing}
                    ${entry.status === 'ignored' ? html`<span class="feedback-ignored-badge">ignored</span>` : nothing}
                  </div>
                  <p class="feedback-entry-comment">
                    ${entry.comment || html`<span class="muted">—</span>`}
                  </p>
                  ${entry.status === 'new' ? html`
                    <button class="feedback-ignore-btn" @click=${() => this._onIgnoreClick(entry.id)}>Ignore</button>
                  ` : nothing}
                </div>
              `)}
            </div>
          ` : html`<p class="muted" style="margin-top: 8px;">Nothing here.</p>`}
        ` : html`<p class="muted" style="margin-top: 8px;">No feedback submitted yet.</p>`}
      </div>
    `
  }

  static styles = css`
    :host {
      display: block;
    }

    .chart-block {
      background: var(--retro-glass-bg-medium);
      backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--retro-glass-blur-medium)) saturate(180%);
      border: 1px solid var(--retro-glass-border);
      border-radius: 14px;
      padding: 18px;
      box-shadow: var(--retro-glass-shadow);
    }

    .chart-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--retro-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 12px;
    }

    .muted {
      color: var(--retro-text-muted);
      font-size: 14px;
      margin: 0;
    }

    .feedback-tabs {
      display: flex;
      gap: 6px;
      margin-bottom: 10px;
    }

    .feedback-tab-btn {
      border: 1px solid var(--retro-border-subtle);
      border-radius: 6px;
      background: transparent;
      color: var(--retro-text-secondary);
      font-size: 12px;
      padding: 4px 10px;
      cursor: pointer;
    }

    .feedback-tab-btn.active {
      background: var(--retro-accent);
      color: white;
      border-color: var(--retro-accent);
    }

    .feedback-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .feedback-entry {
      border: 1px solid var(--retro-border-subtle);
      border-radius: 8px;
      padding: 10px 12px;
      background: var(--retro-bg-subtle);
    }

    .feedback-entry-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
      flex-wrap: wrap;
    }

    .feedback-stars {
      color: var(--retro-accent);
      white-space: nowrap;
      font-size: 13px;
    }

    .feedback-entry-date {
      color: var(--retro-text-muted);
      font-size: 11px;
    }

    .feedback-participant {
      color: var(--retro-text-primary);
      font-size: 11px;
      font-weight: 600;
    }

    .feedback-version {
      color: var(--retro-text-disabled);
      font-size: 11px;
    }

    .feedback-entry-comment {
      margin: 0;
      font-size: 13px;
      color: var(--retro-text-secondary);
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .feedback-fixed-badge {
      color: #059669;
      font-size: 11px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }
    .feedback-fixed-badge:hover {
      text-decoration: underline;
    }

    .feedback-ignored-badge {
      color: var(--retro-text-disabled);
      font-size: 11px;
      font-style: italic;
    }

    .feedback-ignore-btn {
      margin-top: 6px;
      border: 1px solid var(--retro-border-subtle);
      border-radius: 6px;
      background: transparent;
      color: var(--retro-text-secondary);
      font-size: 11px;
      padding: 3px 8px;
      cursor: pointer;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'feedback-panel': FeedbackPanel
  }
}
