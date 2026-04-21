import { describe, expect, it } from 'vitest';
import {
  clearAccountData,
  deleteTokens,
  getAccounts,
  getSeenMessages,
  getSettings,
  getTokens,
  saveAccounts,
  saveSeenMessages,
  saveSettings,
  saveTokens,
} from '../../src/shared/storage.js';
import { DEFAULT_SETTINGS } from '../../src/shared/constants.js';

describe('storage', () => {
  it('returns DEFAULT_SETTINGS when nothing stored', async () => {
    const s = await getSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it('merges saved settings over defaults', async () => {
    await saveSettings({ pollIntervalMinutes: 10 });
    const s = await getSettings();
    expect(s.pollIntervalMinutes).toBe(10);
    expect(s.notificationsEnabled).toBe(DEFAULT_SETTINGS.notificationsEnabled);
  });

  it('persists and returns accounts list', async () => {
    const accounts = [{ id: 'a1', email: 'a@example.com' }];
    await saveAccounts(accounts);
    expect(await getAccounts()).toEqual(accounts);
  });

  it('defaults accounts to empty array', async () => {
    expect(await getAccounts()).toEqual([]);
  });

  it('saves, reads, and deletes tokens per account', async () => {
    await saveTokens('a1', { accessToken: 'abc', expiresAt: 123 });
    expect(await getTokens('a1')).toEqual({ accessToken: 'abc', expiresAt: 123 });
    await deleteTokens('a1');
    expect(await getTokens('a1')).toBeNull();
  });

  it('caps seen messages at 500 entries per account', async () => {
    const big = new Set();
    for (let i = 0; i < 600; i++) {
      big.add(`msg-${i}`);
    }
    await saveSeenMessages('a1', big);
    const read = await getSeenMessages('a1');
    expect(read.size).toBe(500);
    // Oldest should have been dropped.
    expect(read.has('msg-0')).toBe(false);
    expect(read.has('msg-599')).toBe(true);
  });

  it('clearAccountData removes tokens and seen messages for an account', async () => {
    await saveTokens('a1', { accessToken: 'x' });
    await saveSeenMessages('a1', new Set(['m1']));
    await saveTokens('a2', { accessToken: 'y' });

    await clearAccountData('a1');

    expect(await getTokens('a1')).toBeNull();
    expect((await getSeenMessages('a1')).size).toBe(0);
    expect(await getTokens('a2')).toEqual({ accessToken: 'y' });
  });
});
