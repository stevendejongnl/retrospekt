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
  board?: { phase: SessionPhase; timer?: TimerFixture; notes?: boolean }
  brand?: 'cs'
  /** Leave the analytics consent unanswered, so the consent card shows. */
  askConsent?: boolean
  /** Leave the release note unseen, so the what's-new card shows. */
  askWhatsNew?: boolean
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

const HOME_FILLED: Step[] = [{ fill: ['#session-name', 'Sprint 42 Retro'] }, { fill: ['#your-name', 'Alice'] }]

const PAGE: Pick<ParityScreen, 'viewer'> = { viewer: 'visitor' }

export const PARITY_SCREENS: ParityScreen[] = [
  // Home
  ...pair('home', { ...PAGE, size: [1000, 940], route: '/', steps: HOME_FILLED }),
  { ...PAGE, name: 'home-cs-brand', theme: 'light', brand: 'cs', size: [1000, 940], route: '/', steps: HOME_FILLED },

  // Joining a board
  { ...PAGE, name: 'join-light', theme: 'light', size: [1000, 620], route: SESSION },
  {
    ...PAGE, name: 'join-dark-taken', theme: 'dark', size: [1000, 620], route: SESSION,
    steps: [{ fill: ['.name-card input', 'Alice'] }, { click: '.name-card button' }],
  },

  // Boards, as the facilitator
  ...pair('board-collecting', { viewer: 'facilitator', size: [1100, 640], route: SESSION, board: { phase: 'collecting' } }),
  ...pair('board-discussing', { viewer: 'facilitator', size: [1100, 760], route: SESSION, board: { phase: 'discussing' } }),
  ...pair('board-closed', { viewer: 'facilitator', size: [1100, 720], route: SESSION, board: { phase: 'closed' } }),
  ...pair('board-share', {
    viewer: 'facilitator', size: [1100, 640], route: SESSION, board: { phase: 'discussing' }, steps: [{ click: '.share-btn' }],
    pending: 'The Share popover has the "Present this board" row, which the design project these references came from does not draw yet. '
      + 'The design artifact has it (SharePopover). Re-render board-share-* from the design project that holds the row, then remove this.',
  }),
  ...pair('board-actions', { viewer: 'facilitator', size: [1100, 640], route: SESSION, board: { phase: 'discussing' }, steps: [{ click: 'button[aria-label="Action items"]' }] }),
  ...pair('board-menu', { viewer: 'facilitator', size: [1100, 640], route: SESSION, board: { phase: 'discussing' }, steps: [{ click: '.avatar-menu-btn' }] }),
  { viewer: 'facilitator', name: 'board-cs-brand', theme: 'light', brand: 'cs', size: [1100, 760], route: SESSION, board: { phase: 'discussing' } },

  // The header and dock, as a participant and in their other states
  ...pair('chosen-participant', { viewer: 'participant', size: [1100, 700], route: SESSION, board: { phase: 'discussing', timer: 'running' } }),
  { viewer: 'facilitator', name: 'chosen-timer-menu-dark', theme: 'dark', size: [1100, 760], route: SESSION, board: { phase: 'discussing' }, steps: [{ click: '.timer-chip' }] },
  { viewer: 'facilitator', name: 'chosen-running-light', theme: 'light', size: [1100, 760], route: SESSION, board: { phase: 'discussing', timer: 'running' } },
  { viewer: 'facilitator', name: 'chosen-time-up-dark', theme: 'dark', size: [1100, 760], route: SESSION, board: { phase: 'discussing', timer: 'up' } },

  // Overlays that open from the header or the dock
  ...pair('dock', {
    viewer: 'facilitator', size: [1100, 820], route: SESSION, board: { phase: 'discussing' }, askConsent: true, askWhatsNew: true,
    steps: [
      { click: '.avatar-menu-btn' }, { click: '.menu-feedback' },
      { click: 'feedback-dialog rating-stars .rating-btn:nth-child(4)' },
    ],
  }),
  ...pair('settings', { viewer: 'facilitator', size: [1100, 640], route: SESSION, board: { phase: 'discussing' }, steps: [{ click: '.settings-btn' }] }),
  ...pair('help', { viewer: 'participant', size: [1000, 700], route: SESSION, board: { phase: 'discussing' }, steps: [{ click: '.avatar-menu-btn' }, { click: '.menu-help' }] }),
  ...pair('history', { viewer: 'facilitator', size: [1100, 820], route: SESSION, board: { phase: 'discussing' }, withHistory: true, steps: [{ click: '.avatar-menu-btn' }, { click: '.menu-history' }] }),
  ...pair('notes', {
    viewer: 'facilitator', size: [1100, 820], route: SESSION, board: { phase: 'discussing', notes: true },
    steps: [{ click: 'button[aria-label="Board notes"]' }, { click: 'board-notes .note-item:nth-child(3) .note-text' }],
  }),

  // Pages
  ...pair('stats', { ...PAGE, size: [1100, 880], route: '/stats' }),
  ...pair('admin', {
    ...PAGE, size: [1100, 860], route: '/admin',
    steps: [{ fill: ['input[type="password"]', 'parity'] }, { click: 'button' }],
  }),
  { ...PAGE, name: 'admin-locked-light', theme: 'light', size: [1000, 480], route: '/admin' },
  ...pair('privacy', { ...PAGE, size: [1100, 820], route: '/privacy' }),
  ...pair('feedback-page', {
    ...PAGE, size: [1000, 660], route: '/feedback',
    steps: [{ click: 'feedback-page rating-stars .rating-btn:nth-child(4)' }],
  }),
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
