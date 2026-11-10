import { html, css } from 'lit'
import type { TemplateResult, CSSResult } from 'lit'
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'

// Shared CSS for all inline SVG icons from Font Awesome Free 7.2.0.
// Import this in each Lit component's static styles that uses icons.
export const faIconStyles: CSSResult = css`
  .fa-icon {
    width: 1em;
    height: 1em;
    vertical-align: -0.125em;
    display: inline-block;
    flex-shrink: 0;
  }
`

// Font Awesome Free 7.2.0 — solid icons as inline SVG Lit templates.
// Using inline SVGs avoids the Shadow DOM CSS barrier; currentColor inherits
// the surrounding text color; 1em sizing scales with font-size.

export const iconThumbsUp = (): TemplateResult => html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="fa-icon" aria-hidden="true"><path fill="currentColor" d="M313.4 32.9c26 5.2 42.9 30.5 37.7 56.5l-2.3 11.4c-5.3 26.7-19.1 50.4-38.8 68.3H480c17.7 0 32 14.3 32 32 0 13.9-8.9 25.8-21.3 30.4l1.3 .4c13.7 3.7 23.5 16.1 23.5 30.6 0 16.5-12.6 30.1-28.7 31.7l1 .2c12.5 3.5 21.7 15 21.7 28.6 0 15.5-11.8 28.5-27.2 30l1 .2c11.3 3.3 19.5 13.7 19.5 26.2 0 14.6-11.8 26.4-26.4 26.4H272C216 448 160 432 160 432V192h5.7c5.4 0 10.7-1.6 15.2-4.6C222.7 158.2 253.3 106.4 262.1 48c2.1-13.7 10.4-25.2 22.3-31 5.6-2.7 11.8-4.1 18.1-4.1h10.9zM32 192H96c17.7 0 32 14.3 32 32V448c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32V224c0-17.7 14.3-32 32-32z"/></svg>`

export const iconLayerGroup = (): TemplateResult => html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" class="fa-icon" aria-hidden="true"><path fill="currentColor" d="M264.5 5.2c14.9-6.9 32.1-6.9 47 0l218.6 101c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 149.8C37.4 145.8 32 137.3 32 128s5.4-17.9 13.9-21.8L264.5 5.2zM476.9 209.6l53.2 24.6c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 277.8C37.4 273.8 32 265.3 32 256s5.4-17.9 13.9-21.8l53.2-24.6 152 70.2c23.4 10.8 50.4 10.8 73.8 0l152-70.2zm-152 198.2l152-70.2 53.2 24.6c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 405.8C37.4 401.8 32 393.3 32 384s5.4-17.9 13.9-21.8l53.2-24.6 152 70.2c23.4 10.8 50.4 10.8 73.8 0z"/></svg>`

// CloudSuite wordmark — official logo from cloudsuite.com (icon mark + logotype).
// Used in the session-page header when data-brand="cs" is active.
export const csLogo = (): TemplateResult => html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 198 31" class="cs-logo" aria-label="CloudSuite"><path d="M2.071 23.188a2.948 2.948 0 015.105-2.947 9.579 9.579 0 018.278-14.358 2.943 2.943 0 000-5.883A15.462 15.462 0 002.072 23.188z" fill="#F27730"/><path d="M26.382 4.526A15.354 15.354 0 0015.454 0a2.943 2.943 0 010 5.883 9.575 9.575 0 018.291 14.358 2.948 2.948 0 005.105 2.947 15.466 15.466 0 00-2.457-18.662h-.011z" fill="#37AE83"/><path d="M26.29 24.658a2.943 2.943 0 01-2.552-4.417 9.571 9.571 0 01-16.584 0 2.947 2.947 0 10-5.105 2.947 15.457 15.457 0 0026.769 0 2.939 2.939 0 01-2.527 1.47zm23.111-14.18a5.855 5.855 0 00-5.47.172 5.546 5.546 0 00-2.081 2.115 6.055 6.055 0 000 5.886 5.634 5.634 0 002.093 2.12 5.709 5.709 0 002.917.776 6.152 6.152 0 002.476-.543 7.102 7.102 0 002.188-1.503l1.947 2.166a10.177 10.177 0 01-3.154 2.189 8.882 8.882 0 01-3.647.802 9.02 9.02 0 01-4.558-1.182 8.664 8.664 0 01-3.252-3.216 8.78 8.78 0 01-1.182-4.497 8.576 8.576 0 011.207-4.482 8.672 8.672 0 013.282-3.177 9.545 9.545 0 018.281-.445 8.897 8.897 0 013.03 2.046l-1.922 2.414a6.499 6.499 0 00-2.154-1.64zm6.976-3.326h3.3v14.267h7.44v2.98h-10.74V7.152z" fill="#0D2F66"/><path fill-rule="evenodd" clip-rule="evenodd" d="M87.065 15.748a8.607 8.607 0 00-4.521-7.659 9.99 9.99 0 00-9.335 0 8.607 8.607 0 00-4.522 7.659 8.636 8.636 0 001.207 4.497 8.77 8.77 0 003.315 3.216 9.804 9.804 0 009.335 0 8.774 8.774 0 003.314-3.216 8.64 8.64 0 001.207-4.497zM72.863 18.73a5.902 5.902 0 012.13-8.067 5.797 5.797 0 012.93-.795 5.619 5.619 0 012.882.777 5.73 5.73 0 012.107 2.119c.522.908.79 1.94.777 2.987a5.89 5.89 0 01-.777 2.98 5.79 5.79 0 01-2.108 2.144 5.55 5.55 0 01-2.88.787 5.658 5.658 0 01-2.917-.787 5.951 5.951 0 01-2.144-2.145z" fill="#0D2F66"/><path d="M94.41 20.507a4.193 4.193 0 003.102 1.156 4.07 4.07 0 003.067-1.156c.746-.77 1.119-1.838 1.119-3.202V7.152h3.318v10.153a8.004 8.004 0 01-.911 3.906 6.174 6.174 0 01-2.6 2.553c-1.234.617-2.6.92-3.978.886a8.639 8.639 0 01-4.011-.886 6.14 6.14 0 01-2.622-2.553 8 8 0 01-.912-3.906V7.152h3.3v10.153c-.022 1.362.354 2.43 1.127 3.202z" fill="#0D2F66"/><path fill-rule="evenodd" clip-rule="evenodd" d="M124.04 11.306a8.058 8.058 0 00-3.201-3.056 9.656 9.656 0 00-4.642-1.098h-7.169v17.221h7.059a9.806 9.806 0 004.704-1.094 8.211 8.211 0 003.238-3.067 8.507 8.507 0 001.171-4.446 8.647 8.647 0 00-1.16-4.46zm-2.932 7.44a5.154 5.154 0 01-1.983 2.02 5.62 5.62 0 01-2.844.726h-3.942V10.06h3.843a5.807 5.807 0 012.895.729 5.235 5.235 0 012.031 2.046c.497.91.748 1.933.73 2.969a5.989 5.989 0 01-.73 2.943z" fill="#0D2F66"/><path d="M136.288 10.332a8.215 8.215 0 00-2.465-.445 3.428 3.428 0 00-1.87.445 1.39 1.39 0 00-.682 1.233c-.012.45.164.884.485 1.2.348.338.757.605 1.207.787.648.26 1.311.484 1.984.671.985.277 1.95.623 2.887 1.036a5.104 5.104 0 011.893 1.517 4.21 4.21 0 01.788 2.663 4.558 4.558 0 01-.857 2.753 5.324 5.324 0 01-2.341 1.787 8.87 8.87 0 01-3.413.617c-1.35 0-2.687-.255-3.942-.752a11.19 11.19 0 01-3.351-2.009l1.378-2.808a10.085 10.085 0 002.917 1.896 7.8 7.8 0 003.03.69 3.846 3.846 0 002.166-.53 1.744 1.744 0 00.307-2.662 3.583 3.583 0 00-1.218-.776c-.486-.197-1.16-.419-2.02-.664a23.89 23.89 0 01-2.859-1.01 4.965 4.965 0 01-1.896-1.492 4.106 4.106 0 01-.788-2.622 4.397 4.397 0 01.802-2.623 5.158 5.158 0 012.265-1.736 8.69 8.69 0 013.387-.616 11.46 11.46 0 013.311.492 11.17 11.17 0 012.917 1.332l-1.331 2.88a12.453 12.453 0 00-2.691-1.254zM147.8 20.507a4.193 4.193 0 003.103 1.156 4.07 4.07 0 003.067-1.156c.746-.77 1.119-1.838 1.119-3.202V7.152h3.3v10.153a7.994 7.994 0 01-.912 3.906 6.177 6.177 0 01-2.599 2.553 8.43 8.43 0 01-3.979.886 8.64 8.64 0 01-4.011-.886 6.146 6.146 0 01-2.622-2.553 8.004 8.004 0 01-.911-3.906V7.152h3.3v10.153c-.01 1.362.372 2.43 1.145 3.202zm14.629-13.355h3.3v17.247h-3.3V7.152zm5.907 0h14.065v2.917h-5.368V24.4h-3.325V10.084h-5.372V7.152zm16.683 0h12.617v2.881h-9.335v4.263h8.387v2.882h-8.387v4.34h9.63v2.88h-12.912V7.153z" fill="#0D2F66"/></svg>`

// Line icons from the design (24px grid, 2px stroke, currentColor). The design uses these instead of emoji;
// the header, its popovers and the menus draw them so every glyph is the one in the design.
const DESIGN_ICON_PATHS = {
  link: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />`,
  copy: `<rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />`,
  clock: `<circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />`,
  download: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />`,
  plus: `<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />`,
  close: `<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />`,
  check: `<polyline points="20 6 9 17 4 12" />`,
  chevronDown: `<polyline points="6 9 12 15 18 9" />`,
  chevronUp: `<polyline points="18 15 12 9 6 15" />`,
  settings: `<line x1="21" y1="4" x2="14" y2="4" /><line x1="10" y1="4" x2="3" y2="4" /><line x1="21" y1="12" x2="12" y2="12" /><line x1="8" y1="12" x2="3" y2="12" /><line x1="21" y1="20" x2="16" y2="20" /><line x1="12" y1="20" x2="3" y2="20" /><line x1="14" y1="2" x2="14" y2="6" /><line x1="8" y1="10" x2="8" y2="14" /><line x1="16" y1="18" x2="16" y2="22" />`,
  more: `<circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" />`,
  chart: `<line x1="6" y1="20" x2="6" y2="15" /><line x1="12" y1="20" x2="12" y2="9" /><line x1="18" y1="20" x2="18" y2="4" />`,
  note: `<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" /><path d="M15 3v6h6" />`,
  comment: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />`,
  theme: `<circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />`,
  pencil: `<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />`,
  move: `<polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" />`,
  present: `<rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />`,
  lock: `<rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />`,
  user: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />`,
  users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />`,
  play: `<polygon points="7 4 20 12 7 20" fill="currentColor" />`,
  pause: `<rect x="6" y="4" width="4" height="16" fill="currentColor" /><rect x="14" y="4" width="4" height="16" fill="currentColor" />`,
  volume: `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.5 8.5a5 5 0 0 1 0 7" />`,
  mute: `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="22" y1="9" x2="16" y2="15" /><line x1="16" y1="9" x2="22" y2="15" />`,
  thumb: `<path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />`,
  smile: `<circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><circle cx="9" cy="9.5" r="0.8" fill="currentColor" /><circle cx="15" cy="9.5" r="0.8" fill="currentColor" />`,
  star: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />`,
  help: `<circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />`,
  tasks: `<rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><polyline points="9 13 11.5 15.5 15.5 10.5" />`,
  history: `<path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><polyline points="12 7 12 12 16 14" />`,
  arrowLeft: `<line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />`,
  arrowRight: `<line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />`,
  grid: `<rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />`,
} as const

export type DesignIconName = keyof typeof DESIGN_ICON_PATHS

export const designIcon = (name: DesignIconName, size = 16, fill = false): TemplateResult => html`<svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size} viewBox="0 0 24 24" fill=${fill ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="flex-shrink:0;vertical-align:-0.18em">${unsafeSVG(DESIGN_ICON_PATHS[name])}</svg>`
