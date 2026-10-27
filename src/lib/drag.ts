/**
 * Creates a lifted clone of the dragged card and sets it as the native drag
 * image, so the card itself travels under the cursor instead of a flat
 * browser snapshot. Colors come from the live element, so it works in both
 * themes.
 */
export function setupDragCardGhost(e: React.DragEvent<any>) {
  const target = e.currentTarget as HTMLElement | null;
  if (!target || !e.dataTransfer) return;

  const rect = target.getBoundingClientRect();
  const ghost = target.cloneNode(true) as HTMLElement;

  // Preserve exact layout and styling of the original card.
  ghost.style.position = 'fixed';
  ghost.style.top = `${rect.top}px`;
  ghost.style.left = `${rect.left}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.boxSizing = 'border-box';
  ghost.style.margin = '0';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '99999';
  ghost.style.transform = 'scale(1.02)';
  ghost.style.transformOrigin = 'center';
  ghost.style.opacity = '0.98';
  // Only elevation is added; surface, border and radius stay as rendered.
  ghost.style.boxShadow = `
    0 20px 38px -10px rgba(0, 0, 0, 0.45),
    0 8px 16px -6px rgba(0, 0, 0, 0.25),
    0 0 0 1px hsl(var(--border))
  `;

  document.body.appendChild(ghost);

  // Exact cursor offset so the card stays directly under the mouse cursor.
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;
  e.dataTransfer.setDragImage(ghost, offsetX, offsetY);

  // Clean up ghost from DOM after browser snapshots it.
  setTimeout(() => {
    ghost.remove();
  }, 0);
}
