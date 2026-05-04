import { describe, expect, it } from 'vitest';
import { formatFileSize } from '../../src/options/sound-ui.js';

// ── formatFileSize (options variant — uses KB/MB with space) ───────────────

describe('formatFileSize', () => {
  it('formats bytes when < 1024', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('handles 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formats KB when < 1 MB', () => {
    expect(formatFileSize(2048)).toBe('2 KB');
  });

  it('formats KB with rounding', () => {
    expect(formatFileSize(1536)).toBe('2 KB');
  });

  it('formats MB when >= 1 MB', () => {
    expect(formatFileSize(1_048_576)).toBe('1.0 MB');
  });

  it('formats large MB value', () => {
    expect(formatFileSize(5 * 1_048_576)).toBe('5.0 MB');
  });
});
