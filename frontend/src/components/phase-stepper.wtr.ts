import { expect, fixture, html } from '@open-wc/testing'
import './phase-stepper'
import type { PhaseStepper } from './phase-stepper'

const steps = (el: PhaseStepper) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.step')]

describe('phase-stepper', () => {
  it('shows the three phases in order', async () => {
    const el = await fixture<PhaseStepper>(html`<phase-stepper phase="discussing"></phase-stepper>`)
    expect(steps(el).map((s) => s.textContent!.trim())).to.deep.equal(['Collecting', 'Discussing', 'Closed'])
  })

  it('marks the current phase, and only that one', async () => {
    const el = await fixture<PhaseStepper>(html`<phase-stepper phase="closed"></phase-stepper>`)
    expect(steps(el).map((s) => s.classList.contains('active'))).to.deep.equal([false, false, true])
  })

  it('explains the active phase in a tooltip, where the banner text used to be', async () => {
    const el = await fixture<PhaseStepper>(html`<phase-stepper phase="discussing"></phase-stepper>`)
    expect(steps(el)[1].getAttribute('title')).to.equal('Vote on the cards that matter most')
    expect(steps(el)[0].hasAttribute('title')).to.equal(false)
  })

  it('is read only for a participant: plain steps, no buttons, the current one is aria-current', async () => {
    const el = await fixture<PhaseStepper>(html`<phase-stepper phase="discussing"></phase-stepper>`)
    expect(el.shadowRoot!.querySelectorAll('button').length).to.equal(0)
    expect(steps(el)[1].getAttribute('aria-current')).to.equal('step')
  })

  it('is a row of buttons for the facilitator, the current one pressed', async () => {
    const el = await fixture<PhaseStepper>(html`<phase-stepper phase="discussing" interactive></phase-stepper>`)
    expect(el.shadowRoot!.querySelectorAll('button').length).to.equal(3)
    expect(steps(el).map((s) => s.getAttribute('aria-pressed'))).to.deep.equal(['false', 'true', 'false'])
  })

  it('announces the phase the facilitator picks with a phase-select event', async () => {
    const el = await fixture<PhaseStepper>(html`<phase-stepper phase="collecting" interactive></phase-stepper>`)
    let picked: string | null = null
    el.addEventListener('phase-select', (e) => { picked = (e as CustomEvent<string>).detail })
    steps(el)[2].click()
    expect(picked).to.equal('closed')
  })

  it('does not announce a click on the phase that is already current', async () => {
    const el = await fixture<PhaseStepper>(html`<phase-stepper phase="collecting" interactive></phase-stepper>`)
    let fired = false
    el.addEventListener('phase-select', () => { fired = true })
    steps(el)[0].click()
    expect(fired).to.equal(false)
  })
})
