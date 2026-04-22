import { describe, expect, it } from 'vitest';
import {
  clearAccountData,
  deleteTokens,
  getAccounts,
  getPersistedAccountState,
  getSeenMessages,
  getSettings,
  getTokens,
  saveAccounts,
  savePersistedAccountState,
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

  it('getPersistedAccountState returns empty object when nothing stored', async () => {
    expect(await getPersistedAccountState()).toEqual({});
  });

  it('savePersistedAccountState and retrieve round-trips correctly', async () => {
    const state = {
      'acc-1': { unreadCount: 3, messages: [{ id: 'm1' }], error: null, lastPolledAt: 12345 },
      'acc-2': { unreadCount: 0, messages: [], error: 'oops', lastPolledAt: 99999 },
    };
    await savePersistedAccountState(state);
    expect(await getPersistedAccountState()).toEqual(state);
  });

  it('savePersistedAccountState overwrites previous state', async () => {
    await savePersistedAccountState({ 'acc-1': { unreadCount: 5 } });
    await savePersistedAccountState({ 'acc-2': { unreadCount: 2 } });
    const result = await getPersistedAccountState();
    expect(result['acc-1']).toBeUndefined();
    expect(result['acc-2'].unreadCount).toBe(2);
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
