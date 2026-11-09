import { LitElement, css, html, svg } from 'lit'
import { customElement, property } from 'lit/decorators.js'

import { baseStyles } from '../styles'

const STAR = svg`<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />`

/**
 * A 1 to 5 star rating. Stars fill up to the value; only the chosen one is pressed.
 * Replaces the five face emoji: the interface uses line icons, never emoticons.
 */
@customElement('rating-stars')
export class RatingStars extends LitElement {
  @property({ type: Number }) value = 0
  /** Height of the icon row in px, the buttons are 12px taller. */
  @property({ type: Number }) size = 28

  static styles = [baseStyles, css`
    :host {
      display: block;
    }
    .row {
      display: flex;
      gap: 6px;
      justify-content: space-between;
    }
    .rating-btn {
      flex: 1;
      height: calc(var(--star-size) + 12px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--retro-radius-md);
      border: 1px solid var(--retro-border-default);
      background: var(--retro-bg-subtle);
      color: var(--retro-text-muted);
      cursor: pointer;
      font-family: inherit;
      padding: 0;
    }
    .rating-btn.filled {
      background: var(--retro-accent-tint);
      border-color: var(--retro-accent-border);
      color: var(--retro-accent-ink);
    }
    svg {
      width: calc(var(--star-size) * 0.62);
      height: calc(var(--star-size) * 0.62);
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }
    .filled svg {
      fill: currentColor;
    }
    .ends {
      display: flex;
      justify-content: space-between;
      margin-top: 4px;
      padding: 0 2px;
      font-size: 11px;
      color: var(--retro-text-muted);
    }
  `]

  private choose(rating: number): void {
    this.value = rating
    this.dispatchEvent(new CustomEvent<number>('rating-change', { detail: rating, bubbles: true, composed: true }))
  }

  render() {
    return html`
      <div class="row" role="group" aria-label="Rating" style="--star-size: ${this.size}px">
        ${[1, 2, 3, 4, 5].map(
          (n) => html`
            <button
              type="button"
              class="rating-btn ${n <= this.value ? 'filled' : ''} ${n === this.value ? 'selected' : ''}"
              aria-label="Rate ${n} out of 5"
              aria-pressed=${n === this.value}
              @click=${() => this.choose(n)}
            ><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${STAR}</svg></button>
          `,
        )}
      </div>
      <div class="ends"><span>Poor</span><span>Great</span></div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'rating-stars': RatingStars
  }
}
