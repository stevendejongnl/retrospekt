import { expect, fixture, html, oneEvent } from '@open-wc/testing'
import './emoji-picker'
import type { EmojiPicker } from './emoji-picker'

describe('emoji-picker', () => {
  it('starts closed, showing only the trigger button', async () => {
    const el = await fixture<EmojiPicker>(html`<emoji-picker></emoji-picker>`)
    expect(el.shadowRoot!.querySelector('.trigger')).to.exist
    expect(el.shadowRoot!.querySelector('.popup')).to.not.exist
  })

  it('clicking the trigger opens the popup with a search input and emoji buttons', async () => {
    const el = await fixture<EmojiPicker>(html`<emoji-picker></emoji-picker>`)
    el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('.search-input')).to.exist
    expect(el.shadowRoot!.querySelectorAll('.emoji-btn').length).to.be.greaterThan(1000)
  })

  it('searching filters the grid down to matching emoji', async () => {
    const el = await fixture<EmojiPicker>(html`<emoji-picker></emoji-picker>`)
    el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
    await el.updateComplete
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.search-input')!
    input.value = 'unicorn'
    input.dispatchEvent(new Event('input'))
    await el.updateComplete
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.emoji-btn')]
    expect(buttons.length).to.equal(1)
    expect(buttons[0].textContent?.trim()).to.equal('🦄')
  })

  it('a search with no matches shows a no-results message', async () => {
    const el = await fixture<EmojiPicker>(html`<emoji-picker></emoji-picker>`)
    el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
    await el.updateComplete
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.search-input')!
    input.value = 'zzzznotanemojiname'
    input.dispatchEvent(new Event('input'))
    await el.updateComplete
    expect(el.shadowRoot!.querySelectorAll('.emoji-btn').length).to.equal(0)
    expect(el.shadowRoot!.querySelector('.no-results')).to.exist
  })

  it('clicking an emoji dispatches pick-emoji with its character and closes the popup', async () => {
    const el = await fixture<EmojiPicker>(html`<emoji-picker></emoji-picker>`)
    el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
    await el.updateComplete
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.search-input')!
    input.value = 'unicorn'
    input.dispatchEvent(new Event('input'))
    await el.updateComplete

    const listener = oneEvent(el, 'pick-emoji')
    el.shadowRoot!.querySelector<HTMLButtonElement>('.emoji-btn')!.click()
    const { detail } = await listener
    expect(detail.emoji).to.equal('🦄')
    expect(el.shadowRoot!.querySelector('.popup')).to.not.exist
  })

  it('pressing Escape closes the popup', async () => {
    const el = await fixture<EmojiPicker>(html`<emoji-picker></emoji-picker>`)
    el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('.popup')).to.exist
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('.popup')).to.not.exist
  })

  it('clicking outside the picker closes the popup', async () => {
    const el = await fixture<EmojiPicker>(html`<emoji-picker></emoji-picker>`)
    el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('.popup')).to.exist
    document.body.click()
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('.popup')).to.not.exist
  })
})
