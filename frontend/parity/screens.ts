/**
 * Every comparable view of the design, with how to reach it in the app.
 * Screens that depend on a component that is not built yet are `pending`, with the reason, so they show up
 * in the report as work to do instead of silently missing. Remove `pending` when the component lands.
 */
import type { SessionPhase } from '../src/types'
import type { TimerFixture } from './fixtures'

export type Theme = 'light' | 'dark'
export type Step =
  | { click: string }
  | { fill: [selector: string, text: string] }
  | { press: string }
  | { scroll: [selector: string, top: number] }

export interface ParityScreen {
  name: string
  size: [number, number]
  theme: Theme
  route: string
  /** Who is looking: the facilitator of the board, a participant, or somebody who has not joined yet. */
  viewer: 'facilitator' | 'participant' | 'visitor'
  /** The session the board shows, when the route is a board. */
  board?: { phase: SessionPhase; timer?: TimerFixture }
  brand?: 'cs'
  /** Leave the analytics consent unanswered, so the consent card shows. */
  askConsent?: boolean
  /** Seed the "your sessions" history in local storage. */
  withHistory?: boolean
  steps?: Step[]
  pending?: string
}

const SESSION = '/session/ad9aaaea-758c-4e27-a70d-169ff1b6cd90'

type Base = Omit<ParityScreen, 'name' | 'theme'>

/** One screen per theme: `<name>-light` and `<name>-dark`. */
function pair(name: string, base: Base): ParityScreen[] {
  return (['light', 'dark'] as const).map((theme) => ({ ...base, name: `${name}-${theme}`, theme }))
}

const PAGE: Pick<ParityScreen, 'viewer'> = { viewer: 'visitor' }
const NEEDS_HEADER = 'needs the slim header with the phase stepper and the facilitator dock'
const NEEDS_NEW_HEADER_ICONS = 'is opened from the new header, which is not built yet'

export const PARITY_SCREENS: ParityScreen[] = [
  // Home
  ...pair('home', { ...PAGE, size: [1000, 780], route: '/' }),
  { ...PAGE, name: 'home-cs-brand', theme: 'light', brand: 'cs', size: [1000, 780], route: '/' },

  // Joining a board
  { ...PAGE, name: 'join-light', theme: 'light', size: [1000, 620], route: SESSION },
  {
    ...PAGE, name: 'join-dark-taken', theme: 'dark', size: [1000, 620], route: SESSION,
    steps: [{ fill: ['.name-card input', 'Alice'] }, { click: '.name-card button' }],
  },

  // Boards, as the facilitator
  ...pair('board-collecting', { viewer: 'facilitator', size: [1100, 600], route: SESSION, board: { phase: 'collecting' } }),
  ...pair('board-discussing', { viewer: 'facilitator', size: [1100, 760], route: SESSION, board: { phase: 'discussing' } }),
  ...pair('board-closed', { viewer: 'facilitator', size: [1100, 720], route: SESSION, board: { phase: 'closed' } }),
  { viewer: 'facilitator', name: 'board-cs-brand', theme: 'light', brand: 'cs', size: [1100, 760], route: SESSION, board: { phase: 'discussing' } },

  // The header and dock, as a participant and in their other states
  ...pair('chosen-participant', { viewer: 'participant', size: [1100, 700], route: SESSION, board: { phase: 'discussing', timer: 'running' } }),
  { viewer: 'facilitator', name: 'chosen-share-light', theme: 'light', size: [1100, 760], route: SESSION, board: { phase: 'discussing' }, pending: `the Share popover ${NEEDS_HEADER}` },
  { viewer: 'facilitator', name: 'chosen-timer-menu-dark', theme: 'dark', size: [1100, 760], route: SESSION, board: { phase: 'discussing' }, pending: `the timer menu ${NEEDS_HEADER}` },
  { viewer: 'facilitator', name: 'chosen-running-light', theme: 'light', size: [1100, 760], route: SESSION, board: { phase: 'discussing', timer: 'running' }, pending: `the running timer ${NEEDS_HEADER}` },
  { viewer: 'facilitator', name: 'chosen-time-up-dark', theme: 'dark', size: [1100, 760], route: SESSION, board: { phase: 'discussing', timer: 'up' }, pending: `the time-is-up state ${NEEDS_HEADER}` },

  // Overlays that open from the header or the dock
  ...pair('dock', { viewer: 'facilitator', size: [1100, 820], route: SESSION, board: { phase: 'discussing' }, askConsent: true, pending: 'needs the star-rating feedback card and the dock that shifts right' }),
  ...pair('settings', { viewer: 'facilitator', size: [1100, 640], route: SESSION, board: { phase: 'discussing' }, pending: `the settings dialog ${NEEDS_NEW_HEADER_ICONS.replace('is opened from the new header', 'is opened from the dock')}` }),
  ...pair('help', { viewer: 'facilitator', size: [1000, 700], route: SESSION, board: { phase: 'discussing' }, pending: `the help dialog ${NEEDS_NEW_HEADER_ICONS}` }),
  ...pair('history', { viewer: 'facilitator', size: [1100, 820], route: SESSION, board: { phase: 'discussing' }, withHistory: true, pending: `the sessions sidebar ${NEEDS_NEW_HEADER_ICONS}` }),
  ...pair('notes', { viewer: 'facilitator', size: [1100, 820], route: SESSION, board: { phase: 'discussing' }, pending: `the notes sidebar ${NEEDS_NEW_HEADER_ICONS}` }),

  // Pages
  ...pair('stats', { ...PAGE, size: [1100, 1100], route: '/stats' }),
  ...pair('admin', {
    ...PAGE, size: [1100, 1060], route: '/admin',
    steps: [{ fill: ['input[type="password"]', 'parity'] }, { click: 'button' }],
  }),
  { ...PAGE, name: 'admin-locked-light', theme: 'light', size: [1000, 480], route: '/admin' },
  ...pair('privacy', { ...PAGE, size: [1100, 860], route: '/privacy' }),
  ...pair('feedback-page', { ...PAGE, size: [1000, 660], route: '/feedback' }),
  ...pair('not-found', { ...PAGE, size: [1000, 620], route: '/no-such-page' }),
  ...pair('changelog', { ...PAGE, size: [1100, 1100], route: '/changelog' }),
]

export const PENDING_SCREENS = PARITY_SCREENS.filter((screen) => screen.pending)
export const COMPARED_SCREENS = PARITY_SCREENS.filter((screen) => !screen.pending)

export function screenByName(name: string): ParityScreen {
  const screen = PARITY_SCREENS.find((candidate) => candidate.name === name)
  if (!screen) throw new Error(`Unknown parity screen: ${name}`)
  return screen
}
