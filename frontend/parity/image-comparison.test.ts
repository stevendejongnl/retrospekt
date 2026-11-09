import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CHANNEL_TOLERANCE,
  MAXIMUM_DIFFERENCE_SHARE,
  calculateDifferenceShare,
  createDifferenceRaster,
  findDifferingPixelMask,
  isWithinTolerance,
  type Raster,
} from './image-comparison'

function solid(width: number, height: number, [r, g, b]: [number, number, number]): Raster {
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) data.set([r, g, b, 255], i * 4)
  return { width, height, data }
}

function withPixel(raster: Raster, x: number, y: number, [r, g, b]: [number, number, number]): Raster {
  const data = raster.data.slice()
  data.set([r, g, b, 255], (y * raster.width + x) * 4)
  return { ...raster, data }
}

describe('image comparison', () => {
  it('uses the same rules as the Hoard parity checks', () => {
    expect(DEFAULT_CHANNEL_TOLERANCE).toBe(24)
    expect(MAXIMUM_DIFFERENCE_SHARE).toBe(0)
  })

  it('finds no differing pixel in identical images', () => {
    const image = solid(3, 3, [10, 20, 30])
    expect(findDifferingPixelMask(image, image, 24).every((v) => v === 0)).toBe(true)
    expect(calculateDifferenceShare(image, image, 24)).toBe(0)
  })

  it('ignores a difference up to the tolerance on every channel (anti-aliasing noise)', () => {
    const reference = solid(2, 2, [100, 100, 100])
    const screenshot = withPixel(reference, 1, 1, [124, 76, 100])
    expect(calculateDifferenceShare(reference, screenshot, 24)).toBe(0)
  })

  it('counts a pixel when any one channel is further apart than the tolerance', () => {
    const reference = solid(2, 2, [100, 100, 100])
    const screenshot = withPixel(reference, 0, 1, [100, 125, 100])
    expect(calculateDifferenceShare(reference, screenshot, 24)).toBe(0.25)
  })

  it('marks exactly the differing pixel in the mask', () => {
    const reference = solid(2, 2, [0, 0, 0])
    const screenshot = withPixel(reference, 1, 0, [255, 255, 255])
    expect(Array.from(findDifferingPixelMask(reference, screenshot, 24))).toEqual([0, 1, 0, 0])
  })

  it('refuses images of different sizes, so a layout shift can never pass', () => {
    expect(() => findDifferingPixelMask(solid(2, 2, [0, 0, 0]), solid(3, 3, [0, 0, 0]), 24)).toThrow(
      'Images differ in size: reference 2x2, screenshot 3x3',
    )
  })

  it('paints differing pixels red on a dimmed copy of the screenshot', () => {
    const reference = solid(2, 1, [0, 0, 0])
    const screenshot = withPixel(solid(2, 1, [200, 200, 200]), 1, 0, [255, 255, 255])
    const marked = createDifferenceRaster(reference, screenshot, 24)
    expect(Array.from(marked.data.slice(0, 4))).toEqual([70, 70, 70, 255]) // matching pixel dimmed to 35%
    expect(Array.from(marked.data.slice(4, 8))).toEqual([255, 0, 0, 255]) // differing pixel red
  })

  it('passes only while the share of differing pixels is within the maximum', () => {
    expect(isWithinTolerance(0, 0)).toBe(true)
    expect(isWithinTolerance(0.0001, 0)).toBe(false)
    expect(isWithinTolerance(0.01, 0.02)).toBe(true)
  })
})
