import { describe, expect, it } from 'vitest';
import { displayShortcut, isApplePlatform } from './platform';

describe('platform presentation', () => {
  it('recognizes Apple browser platform names', () => {
    expect(isApplePlatform('MacIntel')).toBe(true);
    expect(isApplePlatform('iPhone')).toBe(true);
    expect(isApplePlatform('Linux x86_64')).toBe(false);
    expect(isApplePlatform('Win32')).toBe(false);
  });

  it('keeps Apple shortcut glyphs on macOS', () => {
    expect(displayShortcut('⌥⇧⌘L', 'MacIntel')).toBe('⌥⇧⌘L');
  });

  it('shows Linux and Windows users familiar shortcut names', () => {
    expect(displayShortcut('⌘N', 'Linux x86_64')).toBe('Ctrl+N');
    expect(displayShortcut('⇧⌘S', 'Linux x86_64')).toBe('Ctrl+Shift+S');
    expect(displayShortcut('⌥⇧⌘L', 'Win32')).toBe('Ctrl+Alt+Shift+L');
    expect(displayShortcut('Del', 'Linux x86_64')).toBe('Del');
  });
});
