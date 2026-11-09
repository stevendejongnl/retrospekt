import { expect, fixture, html } from '@open-wc/testing'
import './rating-stars'
import type { RatingStars } from './rating-stars'

const buttons = (el: RatingStars) => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.rating-btn')]

describe('rating-stars', () => {
  it('renders five buttons, each labelled with its rating', async () => {
    const el = await fixture<RatingStars>(html`<rating-stars></rating-stars>`)
    expect(buttons(el).map((b) => b.getAttribute('aria-label'))).to.deep.equal([
      'Rate 1 out of 5', 'Rate 2 out of 5', 'Rate 3 out of 5', 'Rate 4 out of 5', 'Rate 5 out of 5',
    ])
  })

  it('fills every star up to the value and presses only the chosen one', async () => {
    const el = await fixture<RatingStars>(html`<rating-stars .value=${3}></rating-stars>`)
    expect(buttons(el).map((b) => b.classList.contains('filled'))).to.deep.equal([true, true, true, false, false])
    expect(buttons(el).map((b) => b.getAttribute('aria-pressed'))).to.deep.equal(['false', 'false', 'true', 'false', 'false'])
  })

  it('has nothing filled or pressed without a value', async () => {
    const el = await fixture<RatingStars>(html`<rating-stars></rating-stars>`)
    expect(buttons(el).some((b) => b.classList.contains('filled'))).to.equal(false)
    expect(buttons(el).some((b) => b.getAttribute('aria-pressed') === 'true')).to.equal(false)
  })

  it('announces the chosen rating with a rating-change event, and shows it', async () => {
    const el = await fixture<RatingStars>(html`<rating-stars></rating-stars>`)
    let detail: number | null = null
    el.addEventListener('rating-change', (e) => { detail = (e as CustomEvent<number>).detail })
    buttons(el)[3].click()
    await el.updateComplete
    expect(detail).to.equal(4)
    expect(el.value).to.equal(4)
    expect(buttons(el)[3].classList.contains('selected')).to.equal(true)
  })

  it('labels the two ends of the scale', async () => {
    const el = await fixture<RatingStars>(html`<rating-stars></rating-stars>`)
    const text = el.shadowRoot!.textContent ?? ''
    expect(text).to.contain('Poor')
    expect(text).to.contain('Great')
  })
})
