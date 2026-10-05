import { expect, fixture, html } from '@open-wc/testing'
import './feedback-dialog'
import type { FeedbackDialog } from './feedback-dialog'

describe('feedback-dialog', () => {
  it('renders nothing when open=false', async () => {
    const el = await fixture<FeedbackDialog>(html`<feedback-dialog .open=${false}></feedback-dialog>`)
    expect(el.shadowRoot!.querySelector('.card')).to.be.null
  })

  it('renders the card when open=true', async () => {
    const el = await fixture<FeedbackDialog>(html`<feedback-dialog .open=${true}></feedback-dialog>`)
    expect(el.shadowRoot!.querySelector('.card')).to.not.be.null
  })

  it('is a docked card, not a blocking full-screen overlay', async () => {
    const el = await fixture<FeedbackDialog>(html`<feedback-dialog .open=${true}></feedback-dialog>`)
    expect(el.shadowRoot!.querySelector('.overlay')).to.be.null
    expect(getComputedStyle(el.shadowRoot!.querySelector('.card')!).position).to.not.equal('fixed')
  })

  it('still offers the five-point emoji scale', async () => {
    const el = await fixture<FeedbackDialog>(html`<feedback-dialog .open=${true}></feedback-dialog>`)
    expect(el.shadowRoot!.querySelectorAll('.emoji-btn').length).to.equal(5)
  })

  it('emits feedback-dismissed from "Not now"', async () => {
    const el = await fixture<FeedbackDialog>(html`<feedback-dialog .open=${true}></feedback-dialog>`)
    let dismissed = false
    el.addEventListener('feedback-dismissed', () => { dismissed = true })
    el.shadowRoot!.querySelector<HTMLButtonElement>('.skip-btn')!.click()
    expect(dismissed).to.be.true
  })
})
