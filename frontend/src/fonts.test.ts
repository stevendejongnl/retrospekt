import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Fonts are self-hosted (fontsource), never loaded from a third party: the privacy page promises that
// visiting the app does not send anything to anyone but its own server.
const main = readFileSync(resolve(__dirname, 'main.ts'), 'utf8')

describe('fonts', () => {
  it('self-hosts Inter, the body font of the design', () => {
    expect(main).toMatch(/import '@fontsource-variable\/inter\/wght\.css'/)
  })

  it.each([400, 500, 700, 800])('self-hosts JetBrains Mono %i, the font for timers and numbers', (weight) => {
    expect(main).toContain(`import '@fontsource/jetbrains-mono/${weight}.css'`)
  })

  it('never links a font from a third-party host', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8')
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  })
})
