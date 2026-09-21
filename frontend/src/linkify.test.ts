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

  it('optimistically renders every http(s) URL as an image first, regardless of extension', () => {
    const div = renderToDiv('See https://example.com/page for details')
    const img = div.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.src).toBe('https://example.com/page')
    expect(div.querySelector('a')).toBeNull()
  })

  it('falls back to a clickable link when the image fails to load', () => {
    const div = renderToDiv('See https://example.com/page for details')
    const img = div.querySelector('img')!
    img.dispatchEvent(new Event('error'))

    const a = div.querySelector('a')
    expect(a).not.toBeNull()
    expect(div.querySelector('img')).toBeNull()
    expect(a!.href).toBe('https://example.com/page')
    expect(a!.target).toBe('_blank')
    expect(a!.rel).toBe('noopener noreferrer')
    expect(a!.textContent).toBe('https://example.com/page')
    expect(div.textContent).toBe('See https://example.com/page for details')
  })

  it('embeds an extension-less URL as an image just as readily as one with a recognized extension', () => {
    // e.g. a signed CDN URL or an imgur-style short link with no file extension
    const div = renderToDiv('https://i.example.com/abc123')
    const img = div.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.src).toBe('https://i.example.com/abc123')
  })

  it('a genuine image URL (by extension) stays an image — no error fires for it', () => {
    const div = renderToDiv('https://example.com/cat.gif')
    expect(div.querySelector('img')).not.toBeNull()
    expect(div.querySelector('a')).toBeNull()
  })

  it('renders multiple URLs in order, each falling back independently on error', () => {
    const div = renderToDiv('a https://one.example b https://two.example c')
    const imgs = [...div.querySelectorAll('img')]
    expect(imgs.map((i) => i.src)).toEqual(['https://one.example/', 'https://two.example/'])

    imgs[0].dispatchEvent(new Event('error'))
    expect(div.querySelectorAll('img')).toHaveLength(1)
    expect(div.querySelectorAll('a')).toHaveLength(1)
    expect(div.querySelector('a')!.href).toBe('https://one.example/')
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

describe('renderCardText — inline markdown', () => {
  it('renders **bold** as <strong>', () => {
    const div = renderToDiv('this is **important**')
    const strong = div.querySelector('strong')
    expect(strong).not.toBeNull()
    expect(strong!.textContent).toBe('important')
    expect(div.textContent).toBe('this is important')
  })

  it('renders *italic* as <em>', () => {
    const div = renderToDiv('this is *nice*')
    const em = div.querySelector('em')
    expect(em).not.toBeNull()
    expect(em!.textContent).toBe('nice')
  })

  it('renders `code` as <code>', () => {
    const div = renderToDiv('run `npm test` first')
    const code = div.querySelector('code')
    expect(code).not.toBeNull()
    expect(code!.textContent).toBe('npm test')
  })

  it('renders a markdown link with its label text, not the raw URL', () => {
    const div = renderToDiv('see [the doc](https://example.com/doc) for details')
    const a = div.querySelector('a')
    expect(a).not.toBeNull()
    expect(a!.href).toBe('https://example.com/doc')
    expect(a!.textContent).toBe('the doc')
    expect(div.querySelector('img')).toBeNull()
  })

  it('a markdown link never gets image-embedded, even if the URL looks like an image', () => {
    const div = renderToDiv('[my screenshot](https://example.com/shot.png)')
    expect(div.querySelector('img')).toBeNull()
    const a = div.querySelector('a')!
    expect(a.textContent).toBe('my screenshot')
  })

  it('markdown and a bare URL can appear together in the same text', () => {
    const div = renderToDiv('**important**: see https://example.com/x')
    expect(div.querySelector('strong')!.textContent).toBe('important')
    expect(div.querySelector('img')).not.toBeNull() // bare URL still optimistically an image
  })

  it('an unmatched stray asterisk is left as literal text, not swallowed', () => {
    const div = renderToDiv('5 * 3 = 15, not markdown')
    expect(div.querySelector('em')).toBeNull()
    expect(div.querySelector('strong')).toBeNull()
    expect(div.textContent).toBe('5 * 3 = 15, not markdown')
  })

  it('escapes HTML-looking content inside markdown tokens (no injection)', () => {
    const div = renderToDiv('run `<script>alert(1)</script>`')
    expect(div.querySelector('script')).toBeNull()
    expect(div.querySelector('code')!.textContent).toBe('<script>alert(1)</script>')
  })
})
