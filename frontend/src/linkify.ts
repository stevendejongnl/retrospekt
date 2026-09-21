import { html, type TemplateResult } from 'lit'

// http(s) only, by construction — a non-http(s) scheme (javascript:, data:, ...)
// never matches, so it can never become a clickable <a> or a loaded <img>.
const URL_RE = /https?:\/\/[^\s<>"']+/g
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|svg)(\?[^\s<>"']*)?$/i

/**
 * Renders card/note text with bare http(s) URLs turned into clickable links,
 * and URLs that look like an image (by extension) embedded as an <img>
 * instead. No uploads — this only recognizes links already present in the
 * text. Built from lit-html fragments (never raw HTML strings), so this is
 * safe against script injection the same way plain text interpolation is.
 */
export function renderCardText(text: string): TemplateResult {
  const parts: (string | TemplateResult)[] = []
  let lastIndex = 0

  for (const match of text.matchAll(URL_RE)) {
    const url = match[0]
    const start = match.index
    if (start > lastIndex) parts.push(text.slice(lastIndex, start))

    parts.push(
      IMAGE_EXT_RE.test(url)
        ? html`<img class="card-text-image" src=${url} alt="" loading="lazy" />`
        : html`<a href=${url} target="_blank" rel="noopener noreferrer">${url}</a>`,
    )

    lastIndex = start + url.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))

  return html`${parts}`
}
