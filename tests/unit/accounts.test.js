import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub auth.js before importing accounts.
vi.mock('../../src/background/auth.js', () => {
  return {
    launchOAuth: vi.fn(),
    refreshAccessToken: vi.fn(),
    revokeToken: vi.fn(async () => true),
  };
});

import {
  AuthError,
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
    const result = await removeAccount(acc.id);
    expect(result.ok).toBe(true);
    expect(result.revokeOk).toBe(true);
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

  it('updateAccount persists muted flag', async () => {
    await saveAccounts([{ id: 'a1', email: 'x@y', muted: false }]);
    const updated = await updateAccount('a1', { muted: true });
    expect(updated.muted).toBe(true);
    const [stored] = await getAccounts();
    expect(stored.muted).toBe(true);
  });

  it('updateAccount persists watchedLabels and rejects empty array', async () => {
    await saveAccounts([{ id: 'a1', email: 'x@y' }]);
    const updated = await updateAccount('a1', { watchedLabels: ['INBOX', 'STARRED'] });
    expect(updated.watchedLabels).toEqual(['INBOX', 'STARRED']);
    const noChange = await updateAccount('a1', { watchedLabels: [] });
    expect(noChange.watchedLabels).toEqual(['INBOX', 'STARRED']);
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

  it('getValidAccessToken throws AuthError when token refresh is rejected by Google', async () => {
    await saveTokens('a1', {
      accessToken: 'stale',
      refreshToken: 'bad-refresh',
      expiresAt: Date.now() - 1000,
    });
    authMod.refreshAccessToken.mockRejectedValue(
      new Error('Token refresh failed: 400 {"error":"invalid_grant"}'),
    );
    await expect(getValidAccessToken('a1')).rejects.toThrow(AuthError);
    await expect(getValidAccessToken('a1')).rejects.toMatchObject({ isAuthError: true });
  });

  it('getValidAccessToken re-throws non-auth errors (e.g. network failure)', async () => {
    await saveTokens('a1', {
      accessToken: 'stale',
      refreshToken: 'rr',
      expiresAt: Date.now() - 1000,
    });
    authMod.refreshAccessToken.mockRejectedValue(new Error('Failed to fetch'));
    await expect(getValidAccessToken('a1')).rejects.toThrow('Failed to fetch');
    await expect(getValidAccessToken('a1')).rejects.not.toThrow(AuthError);
  });

  it('addAccount passes loginHint to launchOAuth', async () => {
    authMod.launchOAuth.mockResolvedValue({
      tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600_000 },
      userInfo: { email: 'hint@example.com' },
    });
    await addAccount({ loginHint: 'hint@example.com' });
    expect(authMod.launchOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ loginHint: 'hint@example.com' }),
    );
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
