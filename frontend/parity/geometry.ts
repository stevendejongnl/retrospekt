/**
 * Where every piece of text sits on a screen, as { text, x, y, width, height }, so the app and its design reference
 * can be compared number by number instead of by eye. Walks shadow roots, so it works on the app as well as on the
 * design's plain DOM. Used by `render-references.ts` and `compare-screens.ts` when PARITY_GEOMETRY names a folder.
 */
export interface TextRect {
  text: string
  x: number
  y: number
  width: number
  height: number
}

/** Runs in the page. Plain JavaScript in a string, because a transpiled function arrives in the page with helpers it lacks. */
export const COLLECT_TEXT_RECTS = `(() => {
  const found = []
  const visit = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').replace(/\\s+/g, ' ').trim()
        if (text) {
          const range = document.createRange()
          range.selectNodeContents(node)
          const box = range.getBoundingClientRect()
          if (box.width > 0 && box.height > 0) {
            found.push({ text, x: Math.round(box.x * 10) / 10, y: Math.round(box.y * 10) / 10, width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10 })
          }
        }
      } else {
        if (node.tagName === 'BUTTON' || node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
          const box = node.getBoundingClientRect()
          const label = (node.textContent || '').replace(/\\s+/g, '') || node.getAttribute('aria-label') || node.getAttribute('title') || node.tagName
          if (box.width > 0 && box.height > 0) {
            found.push({ text: '[box] ' + label, x: Math.round(box.x * 10) / 10, y: Math.round(box.y * 10) / 10, width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10 })
          }
        }
        if (node.shadowRoot) visit(node.shadowRoot)
      }
      node = walker.nextNode()
    }
  }
  visit(document.body)
  return found
})()`

/** Pairs the two lists by text, in order of appearance, and reports every pair that is not in the same place. */
export function compareTextRects(reference: TextRect[], actual: TextRect[], tolerance = 0.6): string[] {
  const lines: string[] = []
  const unused = [...actual]
  for (const want of reference) {
    const at = unused.findIndex((got) => got.text === want.text)
    if (at < 0) {
      lines.push(`missing in the app: "${want.text}" at ${want.x},${want.y}`)
      continue
    }
    const [got] = unused.splice(at, 1)
    const dx = got.x - want.x
    const dy = got.y - want.y
    const dw = got.width - want.width
    const dh = got.height - want.height
    if (Math.abs(dx) > tolerance || Math.abs(dy) > tolerance || Math.abs(dw) > 1.5 || Math.abs(dh) > 0.6) {
      lines.push(`"${want.text.slice(0, 40)}": dx ${dx.toFixed(1)}  dy ${dy.toFixed(1)}  dwidth ${dw.toFixed(1)}  dheight ${dh.toFixed(1)}   (design ${want.x},${want.y} ${want.width}x${want.height})`)
    }
  }
  for (const extra of unused) lines.push(`only in the app: "${extra.text.slice(0, 40)}" at ${extra.x},${extra.y}`)
  return lines
}
