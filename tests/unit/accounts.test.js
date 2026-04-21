import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub auth.js before importing accounts.
vi.mock('../../src/background/auth.js', () => {
  return {
    launchOAuth: vi.fn(),
    refreshAccessToken: vi.fn(),
    revokeToken: vi.fn(async () => {}),
  };
});

import {
  addAccount,
  getAccounts,
  getValidAccessToken,
  removeAccount,
  reorderAccounts,
  updateAccount,
} from '../../src/background/accounts.js';
import * as authMod from '../../src/background/auth.js';
import { getTokens, saveAccounts, saveTokens } from '../../src/shared/storage.js';

describe('accounts', () => {
  beforeEach(() => {
    authMod.launchOAuth.mockReset();
    authMod.refreshAccessToken.mockReset();
    authMod.revokeToken.mockReset();
  });

  it('addAccount stores a new account with unique color', async () => {
    authMod.launchOAuth.mockResolvedValue({
      tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600_000 },
      userInfo: { email: 'alice@example.com' },
    });
    const acc = await addAccount();
    expect(acc.email).toBe('alice@example.com');
    expect(acc.color).toBeTruthy();
    const all = await getAccounts();
    expect(all).toHaveLength(1);
    expect(await getTokens(acc.id)).toBeTruthy();
  });

  it('addAccount re-adding the same email updates tokens, not count', async () => {
    authMod.launchOAuth.mockResolvedValue({
      tokens: { accessToken: 'a1', refreshToken: 'r', expiresAt: Date.now() + 3600_000 },
      userInfo: { email: 'bob@example.com' },
    });
    const first = await addAccount();
    authMod.launchOAuth.mockResolvedValue({
      tokens: { accessToken: 'a2', refreshToken: 'r2', expiresAt: Date.now() + 3600_000 },
      userInfo: { email: 'bob@example.com' },
    });
    const second = await addAccount();
    expect(first.id).toBe(second.id);
    expect((await getAccounts()).length).toBe(1);
    expect((await getTokens(first.id)).accessToken).toBe('a2');
  });

  it('removeAccount revokes tokens and clears data', async () => {
    authMod.launchOAuth.mockResolvedValue({
      tokens: { accessToken: 'a', refreshToken: 'rr', expiresAt: Date.now() + 3600_000 },
      userInfo: { email: 'c@example.com' },
    });
    const acc = await addAccount();
    const ok = await removeAccount(acc.id);
    expect(ok).toBe(true);
    expect(authMod.revokeToken).toHaveBeenCalledWith('rr');
    expect(await getAccounts()).toHaveLength(0);
    expect(await getTokens(acc.id)).toBeNull();
  });

  it('updateAccount only mutates allowed fields', async () => {
    await saveAccounts([{ id: 'a1', email: 'x@y', color: '#111', label: 'x' }]);
    const updated = await updateAccount('a1', {
      label: 'work',
      color: '#222',
      email: 'evil@z',
    });
    expect(updated.label).toBe('work');
    expect(updated.color).toBe('#222');
    expect(updated.email).toBe('x@y');
  });

  it('reorderAccounts reflects the new order', async () => {
    await saveAccounts([
      { id: 'a', email: 'a@x', color: '#1' },
      { id: 'b', email: 'b@x', color: '#2' },
      { id: 'c', email: 'c@x', color: '#3' },
    ]);
    const reordered = await reorderAccounts(['c', 'a', 'b']);
    expect(reordered.map((a) => a.id)).toEqual(['c', 'a', 'b']);
  });

  it('getValidAccessToken returns cached token when not expired', async () => {
    await saveAccounts([{ id: 'a1', email: 'x@y' }]);
    await saveTokens('a1', {
      accessToken: 'cached',
      refreshToken: 'rr',
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    const token = await getValidAccessToken('a1');
    expect(token).toBe('cached');
    expect(authMod.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('getValidAccessToken refreshes when expired', async () => {
    await saveAccounts([{ id: 'a1', email: 'x@y' }]);
    await saveTokens('a1', {
      accessToken: 'stale',
      refreshToken: 'rr',
      expiresAt: Date.now() - 1000,
    });
    authMod.refreshAccessToken.mockResolvedValue({
      accessToken: 'fresh',
      expiresAt: Date.now() + 3600_000,
    });
    const token = await getValidAccessToken('a1');
    expect(token).toBe('fresh');
    expect(authMod.refreshAccessToken).toHaveBeenCalled();
    const stored = await getTokens('a1');
    expect(stored.refreshToken).toBe('rr'); // preserved
    expect(stored.accessToken).toBe('fresh');
  });
});
