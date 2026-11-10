/** Prints where the app's text differs from the design's, for the screens whose geometry was dumped
 *  (run render-references.ts and compare-screens.ts with PARITY_GEOMETRY=<folder> first). */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compareTextRects, type TextRect } from './geometry'

const [folder, ...names] = process.argv.slice(2)
for (const name of names) {
  const design = join(folder, `${name}.design.json`)
  const app = join(folder, `${name}.app.json`)
  if (!existsSync(design) || !existsSync(app)) {
    console.log(`${name}: no geometry dumped`)
    continue
  }
  const lines = compareTextRects(JSON.parse(readFileSync(design, 'utf8')) as TextRect[], JSON.parse(readFileSync(app, 'utf8')) as TextRect[])
  console.log(`\n== ${name}: ${lines.length} differences`)
  for (const line of lines.slice(0, 60)) console.log('  ' + line)
}
