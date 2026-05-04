import { ACCOUNT_COLORS, TOKEN_SKEW_MS } from '../shared/constants.js';
import {
  clearAccountData,
  getAccounts as readAccounts,
  getTokens,
  saveAccounts,
  saveTokens,
} from '../shared/storage.js';
import { launchOAuth, refreshAccessToken, revokeToken } from './auth.js';

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    this.isAuthError = true;
  }
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `acc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pickColor(existing) {
  const used = new Set(existing.map((a) => a.color));
  return (
    ACCOUNT_COLORS.find((c) => !used.has(c)) ||
    ACCOUNT_COLORS[existing.length % ACCOUNT_COLORS.length]
  );
}

export async function getAccounts() {
  return readAccounts();
}

export async function getAccountById(id) {
  const list = await readAccounts();
  return list.find((a) => a.id === id) || null;
}

export async function addAccount({ loginHint } = {}) {
  const { tokens, userInfo } = await launchOAuth({ loginHint });
  const accounts = await readAccounts();
  const existing = accounts.find((a) => a.email === userInfo.email);
  if (existing) {
    await saveTokens(existing.id, tokens);
    return existing;
  }
  const account = {
    id: generateId(),
    email: userInfo.email,
    label: userInfo.email,
    color: pickColor(accounts),
    addedAt: Date.now(),
  };
  accounts.push(account);
  await saveAccounts(accounts);
  await saveTokens(account.id, tokens);
  return account;
}

export async function removeAccount(accountId) {
  const accounts = await readAccounts();
  const target = accounts.find((a) => a.id === accountId);
  if (!target) {
    return false;
  }
  const tokens = await getTokens(accountId);
  let revokeOk = true;
  if (tokens?.refreshToken) {
    revokeOk = await revokeToken(tokens.refreshToken);
  } else if (tokens?.accessToken) {
    revokeOk = await revokeToken(tokens.accessToken);
  }
  const remaining = accounts.filter((a) => a.id !== accountId);
  await saveAccounts(remaining);
  await clearAccountData(accountId);
  return { ok: true, revokeOk };
}

export async function updateAccount(accountId, patch) {
  const accounts = await readAccounts();
  const idx = accounts.findIndex((a) => a.id === accountId);
  if (idx === -1) {
    return null;
  }
  const allowed = {};
  if (patch.label !== undefined) {
    allowed.label = String(patch.label).slice(0, 80);
  }
  if (patch.color !== undefined) {
    allowed.color = String(patch.color);
  }
  if (patch.muted !== undefined) {
    allowed.muted = Boolean(patch.muted);
  }
  if (Array.isArray(patch.watchedLabels)) {
    const valid = patch.watchedLabels.filter(
      (l) => typeof l === 'string' && l.length > 0 && l.length <= 100,
    );
    if (valid.length > 0) {
      allowed.watchedLabels = valid;
    }
  }
  accounts[idx] = { ...accounts[idx], ...allowed };
  await saveAccounts(accounts);
  return accounts[idx];
}

export async function reorderAccounts(orderedIds) {
  const accounts = await readAccounts();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const reordered = [];
  for (const id of orderedIds) {
    const acc = byId.get(id);
    if (acc) {
      reordered.push(acc);
      byId.delete(id);
    }
  }
  // Preserve any not included at the end (shouldn't happen, but safe).
  for (const acc of byId.values()) {
    reordered.push(acc);
  }
  await saveAccounts(reordered);
  return reordered;
}

export async function getValidAccessToken(accountId) {
  const tokens = await getTokens(accountId);
  if (!tokens) {
    throw new Error(`No tokens for account ${accountId}`);
  }
  if (tokens.accessToken && tokens.expiresAt - TOKEN_SKEW_MS > Date.now()) {
    return tokens.accessToken;
  }
  if (!tokens.refreshToken) {
    throw new Error(`Access token expired and no refresh token available for ${accountId}`);
  }
  let refreshed;
  try {
    refreshed = await refreshAccessToken({
      refreshToken: tokens.refreshToken,
      clientId: (await import('../shared/constants.js')).CLIENT_ID,
    });
  } catch (err) {
    // Google rejected the token (invalid_grant, revoked, etc.) — needs re-auth.
    if (err.message?.startsWith('Token refresh failed:')) {
      throw new AuthError(`Authorization expired for account ${accountId}. Please re-authorize.`);
    }
    throw err;
  }
  // Preserve refresh token if not returned.
  const merged = {
    ...tokens,
    ...refreshed,
    refreshToken: refreshed.refreshToken || tokens.refreshToken,
  };
  await saveTokens(accountId, merged);
  return merged.accessToken;
}
