import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { PARITY_SCREENS } from './screens'

const REFERENCES = join(__dirname, 'references')

describe('reference images', () => {
  it.each(PARITY_SCREENS.map((s) => [s.name, s] as const))('%s has a reference of exactly its size', (_name, screen) => {
    const path = join(REFERENCES, `${screen.name}.png`)
    expect(existsSync(path), `${path} (run npm run parity:references)`).toBe(true)
    const { width, height } = PNG.sync.read(readFileSync(path))
    expect([width, height]).toEqual(screen.size)
  })

  it('has no reference for a screen that is not in the table', () => {
    const known = new Set(PARITY_SCREENS.map((s) => `${s.name}.png`))
    const stray = readdirSync(REFERENCES).filter((file) => file.endsWith('.png') && !known.has(file))
    expect(stray).toEqual([])
  })
})
