/**
 * Creates an elevated clone of the dragged card with realistic depth shadow
 * and sets it as the native drag image.
 */
export function setupDragCardGhost(e: React.DragEvent<any>) {
  const target = e.currentTarget as HTMLElement | null;
  if (!target || !e.dataTransfer) return;

  const rect = target.getBoundingClientRect();
  const ghost = target.cloneNode(true) as HTMLElement;

  // Preserve exact layout and styling of the original card
  ghost.style.position = 'fixed';
  ghost.style.top = `${rect.top}px`;
  ghost.style.left = `${rect.left}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.boxSizing = 'border-box';
  ghost.style.backgroundColor = '#ffffff';
  ghost.style.borderRadius = '12px';
  ghost.style.border = '1px solid rgba(0, 0, 0, 0.06)';
  // Elegant elevated shadow
  ghost.style.boxShadow = `
    0 16px 32px -6px rgba(0, 0, 0, 0.14),
    0 8px 16px -4px rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.04)
  `;
  ghost.style.opacity = '0.98';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '99999';

  document.body.appendChild(ghost);

  // Exact cursor offset so the card stays directly under the mouse cursor
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;
  e.dataTransfer.setDragImage(ghost, offsetX, offsetY);

  // Clean up ghost from DOM after browser snapshots it
  setTimeout(() => {
    ghost.remove();
  }, 0);
}
