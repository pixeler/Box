/**
 * Platform labels for keyboard hints. The actual shortcuts accept both Ctrl
 * and Meta; this only decides what the interface shows.
 */
export const isMacPlatform =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

export function shortcutLabel(key: string): string {
  return isMacPlatform ? `⌘${key}` : `Ctrl+${key}`;
}

export function shortcutAria(key: string): string {
  return isMacPlatform ? `Meta+${key}` : `Control+${key}`;
}
