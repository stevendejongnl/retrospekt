import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The design is flat: no drifting colour blobs behind the pages. The page is the --retro-bg-page token.
const SRC = __dirname

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.ts$/.test(entry.name) && !/\.(spec|wtr|test)\.ts$/.test(entry.name) ? [path] : []
  })
}

describe('flat pages', () => {
  it('no longer has the background blobs component', () => {
    expect(existsSync(join(SRC, 'components/background-blobs.ts'))).toBe(false)
  })

  it('does not use or import the blobs anywhere', () => {
    const users = sourceFiles(SRC).filter((file) => /background-blobs/.test(readFileSync(file, 'utf8')))
    expect(users.map((f) => f.replace(SRC, 'src'))).toEqual([])
  })

  it('has no drift animation left in index.html', () => {
    expect(readFileSync(join(SRC, '../index.html'), 'utf8')).not.toMatch(/drift-\d/)
  })
})
