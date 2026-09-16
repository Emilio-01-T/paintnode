export function isApplePlatform(platform = typeof navigator === 'undefined' ? '' : navigator.platform): boolean {
  return /^(Mac|iPhone|iPad|iPod)/i.test(platform);
}

/** Convert the compact macOS shortcut notation used by the UI to host-native labels. */
export function displayShortcut(shortcut: string, platform?: string): string {
  if (isApplePlatform(platform)) return shortcut;

  const modifiers = [
    shortcut.includes('⌘') ? 'Ctrl' : null,
    shortcut.includes('⌥') ? 'Alt' : null,
    shortcut.includes('⇧') ? 'Shift' : null,
  ].filter((value): value is string => value !== null);
  const key = shortcut.replace(/[⌘⌥⇧]/g, '');
  return modifiers.length && key ? [...modifiers, key].join('+') : shortcut;
}
