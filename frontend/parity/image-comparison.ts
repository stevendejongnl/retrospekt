/**
 * Compare a screenshot with its reference image for the pixel parity checks.
 *
 * Font anti-aliasing differs a little between two renders of the same screen, so a pixel only counts as
 * different when one of its colour channels is further apart than a tolerance. A screen passes only while
 * the share of differing pixels stays within the maximum, which is none. Both numbers are set here once.
 */

export interface Raster {
  width: number
  height: number
  /** RGBA, 4 bytes per pixel, row by row. */
  data: Uint8Array
}

/** A pixel differs when any colour channel is further apart than this (0 to 255). */
export const DEFAULT_CHANNEL_TOLERANCE = 24
/** A screen passes while at most this share of its pixels differs; none may. */
export const MAXIMUM_DIFFERENCE_SHARE = 0

const MATCHING_PIXEL_BRIGHTNESS = 0.35
const DIFFERENCE_COLOUR = [255, 0, 0] as const

function ensureSameSize(reference: Raster, screenshot: Raster): void {
  if (reference.width === screenshot.width && reference.height === screenshot.height) return
  throw new Error(
    `Images differ in size: reference ${reference.width}x${reference.height}, screenshot ${screenshot.width}x${screenshot.height}`,
  )
}

/** One byte per pixel: 1 where any colour channel differs by more than the tolerance. */
export function findDifferingPixelMask(reference: Raster, screenshot: Raster, channelTolerance: number): Uint8Array {
  ensureSameSize(reference, screenshot)
  const pixelCount = reference.width * reference.height
  const mask = new Uint8Array(pixelCount)
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    const offset = pixel * 4
    for (let channel = 0; channel < 3; channel++) {
      if (Math.abs(reference.data[offset + channel] - screenshot.data[offset + channel]) > channelTolerance) {
        mask[pixel] = 1
        break
      }
    }
  }
  return mask
}

/** The share of pixels, from 0 to 1, that differ more than the tolerance. */
export function calculateDifferenceShare(reference: Raster, screenshot: Raster, channelTolerance: number): number {
  const mask = findDifferingPixelMask(reference, screenshot, channelTolerance)
  let differing = 0
  for (const value of mask) differing += value
  return differing / mask.length
}

/** The screenshot dimmed, with every differing pixel painted red. */
export function createDifferenceRaster(reference: Raster, screenshot: Raster, channelTolerance: number): Raster {
  const mask = findDifferingPixelMask(reference, screenshot, channelTolerance)
  const data = new Uint8Array(screenshot.data.length)
  for (let pixel = 0; pixel < mask.length; pixel++) {
    const offset = pixel * 4
    for (let channel = 0; channel < 3; channel++) {
      data[offset + channel] = mask[pixel]
        ? DIFFERENCE_COLOUR[channel]
        : Math.round(screenshot.data[offset + channel] * MATCHING_PIXEL_BRIGHTNESS)
    }
    data[offset + 3] = 255
  }
  return { width: screenshot.width, height: screenshot.height, data }
}

export function isWithinTolerance(differenceShare: number, maximumShare: number): boolean {
  return differenceShare <= maximumShare
}
