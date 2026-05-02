import { DEFAULT_SETTINGS, STORAGE_KEYS } from './constants.js';

const api = typeof browser !== 'undefined' ? browser : globalThis.chrome;

function localArea() {
  return api.storage.local;
}

function syncArea() {
  // Fallback to local if sync is unavailable (rare in Firefox without sync account).
  return api.storage.sync || api.storage.local;
}

export async function getSettings() {
  const result = await syncArea().get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) };
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const merged = { ...current, ...partial };
  await syncArea().set({ [STORAGE_KEYS.SETTINGS]: merged });
  return merged;
}

export async function getAccounts() {
  const result = await localArea().get(STORAGE_KEYS.ACCOUNTS);
  return result[STORAGE_KEYS.ACCOUNTS] || [];
}

export async function saveAccounts(accounts) {
  await localArea().set({ [STORAGE_KEYS.ACCOUNTS]: accounts });
}

export async function getTokens(accountId) {
  const result = await localArea().get(STORAGE_KEYS.TOKENS);
  const bucket = result[STORAGE_KEYS.TOKENS] || {};
  return bucket[accountId] || null;
}

export async function saveTokens(accountId, tokens) {
  const result = await localArea().get(STORAGE_KEYS.TOKENS);
  const bucket = result[STORAGE_KEYS.TOKENS] || {};
  bucket[accountId] = tokens;
  await localArea().set({ [STORAGE_KEYS.TOKENS]: bucket });
}

export async function deleteTokens(accountId) {
  const result = await localArea().get(STORAGE_KEYS.TOKENS);
  const bucket = result[STORAGE_KEYS.TOKENS] || {};
  delete bucket[accountId];
  await localArea().set({ [STORAGE_KEYS.TOKENS]: bucket });
}

export async function getSeenMessages(accountId) {
  const result = await localArea().get(STORAGE_KEYS.SEEN_MESSAGES);
  const bucket = result[STORAGE_KEYS.SEEN_MESSAGES] || {};
  return new Set(bucket[accountId] || []);
}

export async function saveSeenMessages(accountId, seenSet) {
  const result = await localArea().get(STORAGE_KEYS.SEEN_MESSAGES);
  const bucket = result[STORAGE_KEYS.SEEN_MESSAGES] || {};
  // Cap at 500 entries per account to avoid unbounded growth.
  const arr = Array.from(seenSet).slice(-500);
  bucket[accountId] = arr;
  await localArea().set({ [STORAGE_KEYS.SEEN_MESSAGES]: bucket });
}

export async function getPersistedAccountState() {
  const result = await localArea().get(STORAGE_KEYS.ACCOUNT_STATE);
  return result[STORAGE_KEYS.ACCOUNT_STATE] || {};
}

export async function savePersistedAccountState(stateObj) {
  await localArea().set({ [STORAGE_KEYS.ACCOUNT_STATE]: stateObj });
}

export async function getCustomSound() {
  const result = await localArea().get(STORAGE_KEYS.CUSTOM_SOUND);
  return result[STORAGE_KEYS.CUSTOM_SOUND] || null;
}

export async function saveCustomSound(payload) {
  await localArea().set({ [STORAGE_KEYS.CUSTOM_SOUND]: payload });
}

export async function clearCustomSound() {
  await localArea().remove(STORAGE_KEYS.CUSTOM_SOUND);
}

export async function savePkceState(pkceState) {
  await localArea().set({ [STORAGE_KEYS.PKCE_STATE]: pkceState });
}

export async function loadPkceState() {
  const result = await localArea().get(STORAGE_KEYS.PKCE_STATE);
  return result[STORAGE_KEYS.PKCE_STATE] || null;
}

export async function clearPkceState() {
  await localArea().remove(STORAGE_KEYS.PKCE_STATE);
}

export async function clearAccountData(accountId) {
  await deleteTokens(accountId);
  const result = await localArea().get(STORAGE_KEYS.SEEN_MESSAGES);
  const bucket = result[STORAGE_KEYS.SEEN_MESSAGES] || {};
  delete bucket[accountId];
  await localArea().set({ [STORAGE_KEYS.SEEN_MESSAGES]: bucket });
}
