import { describe, it, expect } from 'vitest'
import { render } from 'lit'
import { renderCardText } from './linkify'

function renderToDiv(text: string): HTMLDivElement {
  const div = document.createElement('div')
  render(renderCardText(text), div)
  return div
}

describe('renderCardText', () => {
  it('renders plain text with no links unchanged, with no anchors or images', () => {
    const div = renderToDiv('Just a normal card with no links.')
    expect(div.textContent).toBe('Just a normal card with no links.')
    expect(div.querySelector('a')).toBeNull()
    expect(div.querySelector('img')).toBeNull()
  })

  it('turns a bare https URL into a clickable link opening in a new tab', () => {
    const div = renderToDiv('See https://example.com/page for details')
    const a = div.querySelector('a')
    expect(a).not.toBeNull()
    expect(a!.href).toBe('https://example.com/page')
    expect(a!.target).toBe('_blank')
    expect(a!.rel).toBe('noopener noreferrer')
    expect(a!.textContent).toBe('https://example.com/page')
    expect(div.textContent).toBe('See https://example.com/page for details')
  })

  it('embeds an image URL as an <img> instead of a link', () => {
    const div = renderToDiv('https://example.com/cat.gif')
    const img = div.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.src).toBe('https://example.com/cat.gif')
    expect(div.querySelector('a')).toBeNull()
  })

  it('recognizes common image extensions case-insensitively, with a query string', () => {
    const div = renderToDiv('https://example.com/Photo.PNG?w=200')
    expect(div.querySelector('img')).not.toBeNull()
  })

  it('renders multiple links in order', () => {
    const div = renderToDiv('a https://one.example b https://two.example c')
    const anchors = [...div.querySelectorAll('a')]
    expect(anchors.map((a) => a.href)).toEqual(['https://one.example/', 'https://two.example/'])
  })

  it('does not linkify a non-http(s) scheme like javascript:', () => {
    const div = renderToDiv('javascript:alert(1) is not a link')
    expect(div.querySelector('a')).toBeNull()
    expect(div.querySelector('img')).toBeNull()
    expect(div.textContent).toBe('javascript:alert(1) is not a link')
  })

  it('handles an empty string', () => {
    const div = renderToDiv('')
    expect(div.textContent).toBe('')
  })
})
