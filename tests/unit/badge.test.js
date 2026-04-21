import { describe, expect, it } from 'vitest';
import { clearBadge, formatBadgeText, updateBadge } from '../../src/background/badge.js';

describe('badge / formatBadgeText', () => {
  it('returns empty string for 0 or undefined', () => {
    expect(formatBadgeText(0)).toBe('');
    expect(formatBadgeText(undefined)).toBe('');
    expect(formatBadgeText(null)).toBe('');
  });

  it('returns stringified count for 1–99', () => {
    expect(formatBadgeText(3)).toBe('3');
    expect(formatBadgeText(99)).toBe('99');
  });

  it('returns 99+ for counts over 99', () => {
    expect(formatBadgeText(100)).toBe('99+');
    expect(formatBadgeText(9999)).toBe('99+');
  });
});

describe('badge / updateBadge', () => {
  it('sets badge text and colors', async () => {
    await updateBadge(5);
    expect(browser.action.setBadgeText).toHaveBeenCalledWith({ text: '5' });
    expect(browser.action.setBadgeBackgroundColor).toHaveBeenCalled();
  });

  it('clears badge via clearBadge', async () => {
    await clearBadge();
    expect(browser.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
  });
});
