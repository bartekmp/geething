import { describe, expect, it } from 'vitest';
import {
  clearBadge,
  formatBadgeText,
  showAuthErrorBadge,
  showMutedBadge,
  updateBadge,
} from '../../src/background/badge.js';

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

describe('badge / showMutedBadge', () => {
  it('shows unread count in gray when there are unreads', async () => {
    await showMutedBadge(3);
    expect(browser.action.setBadgeText).toHaveBeenCalledWith({ text: '3' });
    expect(browser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#5f6368' });
  });

  it('shows Z when there are no unreads', async () => {
    await showMutedBadge(0);
    expect(browser.action.setBadgeText).toHaveBeenCalledWith({ text: 'Z' });
    expect(browser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#5f6368' });
  });
});

describe('badge / showAuthErrorBadge', () => {
  it('shows ! in amber', async () => {
    await showAuthErrorBadge();
    expect(browser.action.setBadgeText).toHaveBeenCalledWith({ text: '!' });
    expect(browser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#e37400' });
    expect(browser.action.setBadgeTextColor).toHaveBeenCalledWith({ color: '#ffffff' });
  });
});
