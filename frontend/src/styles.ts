import { css } from 'lit'

/**
 * Touch screens: every button gets an invisible hit area of at least 32 px in both directions, without changing how
 * it looks (a mouse never sees it, so the desktop and the parity screens stay as they are). The area is a centred
 * ::after, so a 20 px chip gets a 32 px target and a 17 px x button too. Selects get a minimum height instead.
 */
export const touchTargetStyles = css`
  @media (pointer: coarse) {
    button,
    [role='button'] {
      position: relative;
    }
    button::after,
    [role='button']::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: max(100%, 32px);
      height: max(100%, 32px);
      transform: translate(-50%, -50%);
    }
    select {
      min-height: 32px;
    }
  }
`

/**
 * Shared start for every page's styles. A shadow root does not see the page-level reset in index.html, so
 * without this each page gets the browser's default margins and content-box sizing, and drifts from the design.
 */
export const baseStyles = css`
  *, *::before, *::after { box-sizing: border-box; }
  h1, h2, h3, h4, p { margin: 0; }
  ${touchTargetStyles}
`
