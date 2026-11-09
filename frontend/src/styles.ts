import { css } from 'lit'

/**
 * Shared start for every page's styles. A shadow root does not see the page-level reset in index.html, so
 * without this each page gets the browser's default margins and content-box sizing, and drifts from the design.
 */
export const baseStyles = css`
  *, *::before, *::after { box-sizing: border-box; }
  h1, h2, h3, h4, p { margin: 0; }
`
