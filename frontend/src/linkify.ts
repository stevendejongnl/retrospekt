import { html, type TemplateResult } from 'lit'

// Deliberately inline-only, no nesting — a card is a short line of text,
// not a document. Alternatives are tried in order at each scan position
// (standard regex left-to-right alternation), so more specific patterns
// must come first where they could otherwise collide — "**bold**" must be
// tried before "*italic*", and a markdown [link](url) before a bare URL
// (so its URL is never separately re-matched as bare once consumed here).
// http(s) only, by construction — a non-http(s) scheme (javascript:,
// data:, ...) never matches, so it can never become a clickable <a> or a
// loaded <img>.
const TOKEN_RE =
  /(?<url>https?:\/\/[^\s<>"']+)|\[(?<linkText>[^\]\n]+)\]\((?<linkUrl>https?:\/\/[^\s<>")]+)\)|\*\*(?<bold>[^*\n]+)\*\*|`(?<code>[^`\n]+)`|\*(?<italic>[^*\n]+)\*/g

/**
 * Renders card/note text with a small set of inline markdown (**bold**,
 * *italic*, `code`, [links](url)) plus bare http(s) URLs turned into
 * clickable links. A bare URL — but not a markdown link, which keeps its
 * chosen label — is optimistically rendered as an <img> first, catching
 * image URLs with no recognizable file extension (signed CDN links,
 * imgur-style short links, ...) by letting the browser's own decode
 * succeed or fail, rather than guessing from the extension or fetching
 * content-type (which would hit CORS for a third-party URL). If the image
 * fails to load, it's swapped for a plain link. No uploads — this only
 * recognizes links already present in the text. Built from lit-html
 * fragments (never a raw-HTML string), so this is safe against script
 * injection the same way plain text interpolation is.
 */
export function renderCardText(text: string): TemplateResult {
  const parts: (string | TemplateResult)[] = []
  let lastIndex = 0

  for (const match of text.matchAll(TOKEN_RE)) {
    const start = match.index
    if (start > lastIndex) parts.push(text.slice(lastIndex, start))

    const g = match.groups!
    if (g.url) {
      parts.push(renderAsImageOrLink(g.url))
    } else if (g.linkUrl) {
      parts.push(html`<a href=${g.linkUrl} target="_blank" rel="noopener noreferrer">${g.linkText}</a>`)
    } else if (g.bold !== undefined) {
      parts.push(html`<strong>${g.bold}</strong>`)
    } else if (g.code !== undefined) {
      parts.push(html`<code>${g.code}</code>`)
    } else {
      parts.push(html`<em>${g.italic}</em>`)
    }

    lastIndex = start + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))

  return html`${parts}`
}

function renderAsImageOrLink(url: string): TemplateResult {
  return html`<img
    class="card-text-image"
    src=${url}
    alt=""
    loading="lazy"
    @error=${(e: Event) => {
      const img = e.target as HTMLImageElement
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.textContent = url
      img.replaceWith(a)
    }}
  />`
}
