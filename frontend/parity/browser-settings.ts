/**
 * Browser conditions shared by the reference renderer and the comparison run.
 * Both must see the same clock, locale, timezone and motion, or identical screens would still differ.
 */

export const LOCALE = 'en-GB'
export const TIMEZONE = 'UTC'

/** Fixed clock. The design's running timer shows 04:32 of 10:00, so it started 5m28s before this moment. */
export const FIXED_TIME = new Date('2026-05-05T10:02:00Z')

export const FREEZE_MOTION_STYLE =
  '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; scroll-behavior: auto !important; }'

export const CONTEXT_OPTIONS = {
  deviceScaleFactor: 1,
  locale: LOCALE,
  timezoneId: TIMEZONE,
} as const
