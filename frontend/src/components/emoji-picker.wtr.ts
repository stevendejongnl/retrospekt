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

  describe('positioning', () => {
    it('is a fixed-position popup anchored just below the trigger by default', async () => {
      const el = await fixture<EmojiPicker>(html`<emoji-picker></emoji-picker>`)
      el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
      await el.updateComplete
      await el.updateComplete // second cycle: popupStyle is set after positioning runs
      const popup = el.shadowRoot!.querySelector<HTMLElement>('.popup')!
      expect(getComputedStyle(popup).position).to.equal('fixed')
      const triggerRect = el.shadowRoot!.querySelector('.trigger')!.getBoundingClientRect()
      const popupRect = popup.getBoundingClientRect()
      expect(popupRect.top).to.be.greaterThan(triggerRect.bottom - 1)
    })

    it('never overflows the right edge of the viewport, however far right the trigger sits', async () => {
      const el = await fixture<EmojiPicker>(
        html`<div style="position:fixed; left:${window.innerWidth - 20}px; top:100px;">
          <emoji-picker></emoji-picker>
        </div>`,
      )
      const picker = el.querySelector('emoji-picker') as EmojiPicker
      picker.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
      await picker.updateComplete
      await picker.updateComplete
      const popup = picker.shadowRoot!.querySelector<HTMLElement>('.popup')!
      const popupRect = popup.getBoundingClientRect()
      expect(popupRect.right).to.be.at.most(window.innerWidth)
      expect(popupRect.left).to.be.at.least(0)
    })

    it('opens above the trigger when there is not enough room below', async () => {
      const el = await fixture<EmojiPicker>(
        html`<div style="position:fixed; left:20px; top:${window.innerHeight - 30}px;">
          <emoji-picker></emoji-picker>
        </div>`,
      )
      const picker = el.querySelector('emoji-picker') as EmojiPicker
      const trigger = picker.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!
      trigger.click()
      await picker.updateComplete
      await picker.updateComplete
      const popup = picker.shadowRoot!.querySelector<HTMLElement>('.popup')!
      const triggerRect = trigger.getBoundingClientRect()
      const popupRect = popup.getBoundingClientRect()
      expect(popupRect.bottom).to.be.at.most(triggerRect.top + 1)
      expect(popupRect.bottom).to.be.at.most(window.innerHeight)
    })

    it('stays viewport-relative even inside an ancestor with backdrop-filter', async () => {
      // Any backdrop-filter value — even blur(0px) — makes that ancestor the
      // containing block for a plain position:fixed descendant. Without
      // popover="manual" promoting .popup to the top layer, its top/left
      // (computed against window.innerWidth/innerHeight) would land relative
      // to this wrapper instead, landing far from the trigger. Reproduces
      // the real .column ancestor in retro-column.ts (frosted-glass cards).
      const el = await fixture<EmojiPicker>(
        html`<div style="position:absolute; top:500px; left:50px; backdrop-filter:blur(0px);">
          <emoji-picker></emoji-picker>
        </div>`,
      )
      const picker = el.querySelector('emoji-picker') as EmojiPicker
      const trigger = picker.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!
      trigger.click()
      await picker.updateComplete
      await picker.updateComplete
      const popup = picker.shadowRoot!.querySelector<HTMLElement>('.popup')!
      const triggerRect = trigger.getBoundingClientRect()
      const popupRect = popup.getBoundingClientRect()
      // Should open directly adjacent to the trigger — below it if there's
      // room, else above (whichever this viewport has space for) — not
      // offset by however far the filtered ancestor sits from the origin,
      // which is what a containing-block escape failure would look like.
      const opensBelow = Math.abs(popupRect.top - (triggerRect.bottom + 8)) <= 2
      const opensAbove = Math.abs(popupRect.bottom - (triggerRect.top - 8)) <= 2
      expect(opensBelow || opensAbove, `popup wasn't adjacent to trigger: ${JSON.stringify({ triggerRect, popupRect })}`).to.be.true
      expect(popupRect.left).to.be.closeTo(triggerRect.left, 2)
    })
  })

  describe('closing on scroll/resize', () => {
    it('closes the popup on a document scroll event', async () => {
      const el = await fixture<EmojiPicker>(html`<emoji-picker></emoji-picker>`)
      el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
      await el.updateComplete
      expect(el.shadowRoot!.querySelector('.popup')).to.exist
      document.dispatchEvent(new Event('scroll'))
      await el.updateComplete
      expect(el.shadowRoot!.querySelector('.popup')).to.not.exist
    })

    it('repositions the popup on window resize while open', async () => {
      const el = await fixture<EmojiPicker>(html`<emoji-picker></emoji-picker>`)
      el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
      await el.updateComplete
      await el.updateComplete
      const before = el.shadowRoot!.querySelector<HTMLElement>('.popup')!.getAttribute('style')
      window.dispatchEvent(new Event('resize'))
      await el.updateComplete
      // Still open (resize repositions, doesn't close) and still has a style attribute.
      expect(el.shadowRoot!.querySelector('.popup')).to.exist
      expect(el.shadowRoot!.querySelector<HTMLElement>('.popup')!.getAttribute('style')).to.exist
      expect(before).to.exist
    })
  })
})
