import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { baseStyles } from './styles'

// Styles inside a shadow root do not see the page's global reset, so each page would otherwise get the
// browser's default margins and content-box sizing. One shared base style gives every page the same start.
const PAGES = join(__dirname, 'pages')
const pageFiles = readdirSync(PAGES).filter((f) => f.endsWith('-page.ts') && !/\.(spec|wtr|test)\.ts$/.test(f))

describe('base styles', () => {
  it('reset sizing and the default margins of headings and paragraphs', () => {
    const css = baseStyles.cssText.replace(/\s+/g, ' ')
    expect(css).toMatch(/box-sizing: border-box/)
    expect(css).toMatch(/h1, h2, h3, h4, p \{ margin: 0; \}/)
  })

  it.each(pageFiles)('%s starts from the base styles', (file) => {
    const source = readFileSync(join(PAGES, file), 'utf8')
    expect(source).toMatch(/import \{ baseStyles \} from '\.\.\/styles'/)
    expect(source).toMatch(/static styles = \[baseStyles, css`/)
  })
})
