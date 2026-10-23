/**
 * Sheets and dialogs mount into the app frame (`#app-main`) so they stay inside
 * the phone-shaped card on desktop. When a page-level modal (e.g. the note
 * editor) is open, that modal is higher in the stack, so overlays opened from
 * inside it must mount there instead — otherwise they'd paint behind it.
 *
 * A modal opts in by marking its container with `data-overlay-root`.
 */
export function getOverlayPortalTarget(): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const modalRoots = document.querySelectorAll<HTMLElement>('[data-overlay-root]');
  const topmostModal = modalRoots[modalRoots.length - 1];

  return topmostModal || document.getElementById('app-main') || document.body;
}
