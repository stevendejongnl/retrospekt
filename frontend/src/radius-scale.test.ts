import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The shape scale has three radii with a job (--retro-radius-sm/md/lg), so a skin can change how round the
// interface feels in one place. Pills (999px), circles (50%) and tiny radii (up to 5px) stay as they are.
const SOURCE = join(__dirname)
const SCALE_FROM = 6
const SCALE_TO = 22

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.ts$/.test(entry.name) && !/\.(spec|wtr|test)\.ts$/.test(entry.name) ? [path] : []
  })
}

function hardcodedRadii(): string[] {
  const offenders: string[] = []
  for (const directory of ['components', 'pages']) {
    for (const file of sourceFiles(join(SOURCE, directory))) {
      const text = readFileSync(file, 'utf8')
      for (const [declaration, value] of Array.from(text.matchAll(/border-radius:\s*([^;]+);/g), (m): [string, string] => [m[0], m[1]])) {
        const sizes = [...value.matchAll(/(\d+)px/g)].map((m) => Number(m[1]))
        if (sizes.some((n) => n >= SCALE_FROM && n <= SCALE_TO)) offenders.push(`${file.replace(SOURCE, 'src')}: ${declaration}`)
      }
    }
  }
  return offenders
}

describe('radius scale', () => {
  it('has no hardcoded radius between 6px and 22px in a component or page', () => {
    expect(hardcodedRadii()).toEqual([])
  })
})
