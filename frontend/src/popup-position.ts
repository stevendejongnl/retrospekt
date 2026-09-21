export interface PopupPosition {
  top: number
  left: number
}

/**
 * Anchors a popup to a trigger's real screen position, flipping above/below
 * and clamping left/right so it always stays fully within the viewport,
 * regardless of where the trigger sits on the page. Shared by every
 * anchored popup (emoji-picker, gif-picker, ...) so they all clamp the
 * same way — a static anchored `position: absolute` previously escaped
 * off-screen (above the viewport, or past the right edge) depending on
 * where the trigger sat, growing the document's scrollable area into
 * spurious horizontal/vertical scrollbars.
 */
export function computePopupPosition(
  triggerRect: DOMRect,
  viewportWidth: number,
  viewportHeight: number,
  popupWidth: number,
  popupHeight: number,
  margin = 8,
): PopupPosition {
  let left = triggerRect.left
  left = Math.min(left, viewportWidth - popupWidth - margin)
  left = Math.max(margin, left)

  const spaceBelow = viewportHeight - triggerRect.bottom
  const openBelow = spaceBelow >= popupHeight + margin || spaceBelow >= triggerRect.top
  let top = openBelow ? triggerRect.bottom + margin : triggerRect.top - popupHeight - margin
  top = Math.min(top, viewportHeight - popupHeight - margin)
  top = Math.max(margin, top)

  return { top, left }
}
