import { ALARM_NAMES, MAX_FETCH_MESSAGES } from '../shared/constants.js';
import { DEV_MESSAGE_DETAILS } from './dev-seed.js';
import {
  clearCustomSound,
  getPersistedAccountState,
  getSeenMessages,
  getSettings,
  saveCustomSound,
  savePersistedAccountState,
  saveSeenMessages,
} from '../shared/storage.js';
import { playNotificationSound } from './sound.js';
import {
  AuthError,
  addAccount,
  getAccountById,
  getAccounts,
  getValidAccessToken,
  removeAccount,
  reorderAccounts,
  updateAccount,
} from './accounts.js';
import { clearBadge, updateBadge } from './badge.js';
import {
  registerNotificationButtonHandler,
  registerNotificationClickHandler,
  showGroupedMailNotification,
  showNewMailNotification,
} from './notifications.js';
import {
  archiveMessage,
  fetchAttachment,
  fetchLabels,
  fetchMessageDetail,
  fetchMessageMetadata,
  fetchUnreadMessageIds,
  markAsRead,
  markAsSpam,
  markAsUnread,
  moveToTrash,
  starMessage,
  unstarMessage,
} from './gmail-api.js';

const api = typeof browser !== 'undefined' ? browser : globalThis.chrome;

// In-memory cache of last-known unread counts/messages per account.
const accountState = new Map();

// Guard against concurrent polls that would cause duplicate notifications.
// A safety timer releases the lock if a poll hangs beyond POLL_GUARD_TIMEOUT_MS
// so a single stuck fetch cannot freeze the extension indefinitely.
const POLL_GUARD_TIMEOUT_MS = 5 * 60 * 1000;
let pollRunning = false;
let pollGuardTimer = null;

function setAccountState(accountId, patch) {
  const prev = accountState.get(accountId) || {};
  const next = { ...prev, ...patch };
  accountState.set(accountId, next);
  return next;
}

async function pollAccount(account, { isInitial = false } = {}) {
  try {
    const token = await getValidAccessToken(account.id);
    const labels = account.watchedLabels?.length ? account.watchedLabels : ['INBOX'];
    const idSets = await Promise.all(
      labels.map((label) =>
        fetchUnreadMessageIds(token, { maxResults: MAX_FETCH_MESSAGES, labelIds: [label] }),
      ),
    );
    const ids = [...new Set(idSets.flat())];
    const seen = await getSeenMessages(account.id);

    const messages = [];
    const newMessages = [];
    for (const id of ids) {
      try {
        const meta = await fetchMessageMetadata(token, id);
        messages.push(meta);
        if (!seen.has(id) && !isInitial) {
          newMessages.push(meta);
        }
      } catch (err) {
        console.warn(`Failed to fetch message ${id} for ${account.email}:`, err);
      }
    }

    // Persist seen BEFORE showing notifications so a service-worker death
    // between the two steps cannot cause the same messages to re-notify.
    const nextSeen = new Set([...seen, ...ids]);
    await saveSeenMessages(account.id, nextSeen);

    const settings = await getSettings();
    if (!account.muted && newMessages.length > 0) {
      // Fire sound first, synchronously, so the Audio element keeps the event
      // page alive even if the notification step is slow or rejects.
      playNotificationSound(settings);
      if (newMessages.length === 1) {
        await showNewMailNotification(newMessages[0], account, settings);
      } else {
        await showGroupedMailNotification(newMessages, account, settings);
      }
    }

    setAccountState(account.id, {
      unreadCount: ids.length,
      messages,
      error: null,
      lastPolledAt: Date.now(),
    });
    return { count: ids.length, new: newMessages.length };
  } catch (err) {
    console.warn(`Poll failed for account ${account.email}:`, err);
    setAccountState(account.id, {
      error: err.message || String(err),
      needsReauth: err instanceof AuthError,
      lastPolledAt: Date.now(),
    });
    return { count: 0, new: 0, error: err.message };
  }
}

async function pollAllAccounts({ isInitial = false } = {}) {
  if (pollRunning) {
    return 0;
  }
  pollRunning = true;
  pollGuardTimer = setTimeout(() => {
    console.warn('Poll guard timeout — releasing lock after', POLL_GUARD_TIMEOUT_MS / 1000, 's');
    pollRunning = false;
    pollGuardTimer = null;
  }, POLL_GUARD_TIMEOUT_MS);
  try {
    const accounts = await getAccounts();
    let total = 0;
    for (const account of accounts) {
      const result = await pollAccount(account, { isInitial });
      total += result.count || 0;
    }
    // Remove stale entries for deleted accounts.
    const ids = new Set(accounts.map((a) => a.id));
    for (const id of accountState.keys()) {
      if (!ids.has(id)) {
        accountState.delete(id);
      }
    }
    if (total > 0) {
      await updateBadge(total);
    } else {
      await clearBadge();
    }
    // Persist so the popup sees correct state immediately after SW restart.
    await savePersistedAccountState(Object.fromEntries(accountState));
    return total;
  } finally {
    clearTimeout(pollGuardTimer);
    pollGuardTimer = null;
    pollRunning = false;
  }
}

async function rescheduleAlarm() {
  const settings = await getSettings();
  const minutes = Math.max(1, Math.min(30, Number(settings.pollIntervalMinutes) || 2));
  await api.alarms.clear(ALARM_NAMES.POLL).catch(() => {});
  api.alarms.create(ALARM_NAMES.POLL, {
    periodInMinutes: minutes,
    delayInMinutes: minutes,
  });
}

function openGmailForMessage(account, messageId) {
  const url = `https://mail.google.com/mail/?authuser=${encodeURIComponent(
    account.email,
  )}#inbox/${messageId}`;
  return api.tabs.create({ url });
}

async function handleMessage(msg, _sender) {
  if (!msg || typeof msg !== 'object') {
    return;
  }
  switch (msg.type) {
    case 'geething.getState': {
      const accounts = await getAccounts();
      const settings = await getSettings();
      const perAccount = accounts.map((acc) => ({
        ...acc,
        ...(accountState.get(acc.id) || { unreadCount: 0, messages: [] }),
      }));
      return { accounts: perAccount, settings };
    }
    case 'geething.refresh': {
      const total = await pollAllAccounts();
      return { total };
    }
    case 'geething.addAccount': {
      const acc = await addAccount();
      await pollAccount(acc, { isInitial: true });
      return { account: acc };
    }
    case 'geething.reauthorizeAccount': {
      const existing = await getAccountById(msg.accountId);
      const acc = await addAccount({ loginHint: existing?.email });
      setAccountState(acc.id, {
        ...(accountState.get(acc.id) || {}),
        needsReauth: false,
        error: null,
      });
      await pollAccount(acc, { isInitial: true });
      return { account: acc };
    }
    case 'geething.removeAccount': {
      const ok = await removeAccount(msg.accountId);
      accountState.delete(msg.accountId);
      await pollAllAccounts();
      return { ok };
    }
    case 'geething.updateAccount': {
      const acc = await updateAccount(msg.accountId, msg.patch || {});
      return { account: acc };
    }
    case 'geething.reorderAccounts': {
      const accs = await reorderAccounts(msg.orderedIds || []);
      return { accounts: accs };
    }
    case 'geething.getMessageDetail': {
      if (DEV_MESSAGE_DETAILS.has(msg.messageId)) {
        return DEV_MESSAGE_DETAILS.get(msg.messageId);
      }
      const account = await getAccountById(msg.accountId);
      if (!account) {
        throw new Error('Account not found');
      }
      // Validate message belongs to this account when state is available.
      // Skipped when state hasn't loaded yet (empty messages list) to avoid
      // blocking legitimate requests on first boot.
      const acctStateDetail = accountState.get(msg.accountId);
      if (
        acctStateDetail?.messages?.length > 0 &&
        !acctStateDetail.messages.some((m) => m.id === msg.messageId)
      ) {
        throw new Error('Message not found for this account');
      }
      const token = await getValidAccessToken(msg.accountId);
      return fetchMessageDetail(token, msg.messageId);
    }
    case 'geething.getAttachment': {
      const account = await getAccountById(msg.accountId);
      if (!account) {
        throw new Error('Account not found');
      }
      // Same ownership check as getMessageDetail.
      const acctStateAtt = accountState.get(msg.accountId);
      if (
        acctStateAtt?.messages?.length > 0 &&
        !acctStateAtt.messages.some((m) => m.id === msg.messageId)
      ) {
        throw new Error('Message not found for this account');
      }
      const token = await getValidAccessToken(msg.accountId);
      return fetchAttachment(token, msg.messageId, msg.attachmentId);
    }
    case 'geething.action': {
      return performAction(msg);
    }
    case 'geething.markAllRead': {
      const token = await getValidAccessToken(msg.accountId);
      const acctState = accountState.get(msg.accountId);
      const messages = acctState?.messages || [];
      await Promise.all(messages.map((m) => markAsRead(token, m.id).catch(() => {})));
      setAccountState(msg.accountId, { messages: [], unreadCount: 0 });
      const total = Array.from(accountState.values()).reduce(
        (sum, s) => sum + (s.unreadCount || 0),
        0,
      );
      if (total > 0) {
        await updateBadge(total);
      } else {
        await clearBadge();
      }
      return { ok: true };
    }
    case 'geething.getLabels': {
      const token = await getValidAccessToken(msg.accountId);
      return fetchLabels(token);
    }
    case 'geething.settingsChanged': {
      await rescheduleAlarm();
      return { ok: true };
    }
    case 'geething.testNotification': {
      const settings = await getSettings();
      await showNewMailNotification(
        {
          id: 'test',
          subject: 'Test notification from Geething',
          snippet: 'If you see this, desktop notifications are working.',
          from: { name: 'Geething', email: 'geething@test' },
          internalDate: Date.now(),
        },
        { id: 'test', email: 'test@geething', label: 'Test' },
        { ...settings, notificationsEnabled: true },
      );
      return { ok: true };
    }
    case 'geething.testSound': {
      const settings = await getSettings();
      await playNotificationSound({ ...settings, notificationSoundEnabled: true });
      return { ok: true };
    }
    case 'geething.uploadCustomSound': {
      await saveCustomSound({
        dataUrl: msg.dataUrl,
        name: msg.name,
        mimeType: msg.mimeType,
        size: msg.size,
        duration: msg.duration,
      });
      return { ok: true };
    }
    case 'geething.clearCustomSound': {
      await clearCustomSound();
      return { ok: true };
    }
    default:
      return undefined;
  }
}

async function performAction({ accountId, messageId, action }) {
  const token = await getValidAccessToken(accountId);
  switch (action) {
    case 'markRead':
      await markAsRead(token, messageId);
      break;
    case 'markUnread':
      await markAsUnread(token, messageId);
      break;
    case 'trash':
      await moveToTrash(token, messageId);
      break;
    case 'spam':
      await markAsSpam(token, messageId);
      break;
    case 'archive':
      await archiveMessage(token, messageId);
      break;
    case 'star':
      await starMessage(token, messageId);
      break;
    case 'unstar':
      await unstarMessage(token, messageId);
      break;
    default:
      throw new Error(`Unknown action: ${action}`);
  }
  // Update local state immediately.
  const acctState = accountState.get(accountId);
  if (acctState?.messages) {
    if (action === 'star' || action === 'unstar') {
      const messages = acctState.messages.map((m) => {
        if (m.id !== messageId) {
          return m;
        }
        const labels = m.labelIds || [];
        return {
          ...m,
          labelIds:
            action === 'star'
              ? [...new Set([...labels, 'STARRED'])]
              : labels.filter((l) => l !== 'STARRED'),
        };
      });
      setAccountState(accountId, { messages });
    } else {
      const filtered = acctState.messages.filter((m) => m.id !== messageId);
      setAccountState(accountId, { messages: filtered, unreadCount: filtered.length });
      const total = Array.from(accountState.values()).reduce(
        (sum, s) => sum + (s.unreadCount || 0),
        0,
      );
      await updateBadge(total);
    }
  }
  return { ok: true };
}

function attachListeners() {
  api.runtime.onInstalled.addListener(async () => {
    await rescheduleAlarm();
    await pollAllAccounts({ isInitial: true });
  });

  api.runtime.onStartup?.addListener?.(async () => {
    await rescheduleAlarm();
    await pollAllAccounts();
  });

  api.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAMES.POLL) {
      pollAllAccounts();
    }
  });

  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    Promise.resolve(handleMessage(msg, sender))
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => {
        console.error('Background message handler error:', err);
        sendResponse({ ok: false, error: err.message || String(err) });
      });
    return true; // keep channel open for async response
  });

  registerNotificationClickHandler(async ({ accountId, messageId }) => {
    const account = await getAccountById(accountId);
    if (!account) {
      return;
    }
    await openGmailForMessage(account, messageId);
  });

  registerNotificationButtonHandler(async ({ accountId, messageId, action }) => {
    const token = await getValidAccessToken(accountId);
    if (action === 'markRead') {
      await markAsRead(token, messageId);
    } else if (action === 'archive') {
      await archiveMessage(token, messageId);
    }
    const acctState = accountState.get(accountId);
    if (acctState?.messages) {
      const filtered = acctState.messages.filter((m) => m.id !== messageId);
      setAccountState(accountId, { messages: filtered, unreadCount: filtered.length });
    }
    const total = Array.from(accountState.values()).reduce(
      (sum, s) => sum + (s.unreadCount || 0),
      0,
    );
    if (total > 0) {
      await updateBadge(total);
    } else {
      await clearBadge();
    }
  });

  if (api.storage?.onChanged) {
    api.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.settings) {
        rescheduleAlarm();
      }
    });
  }
}

attachListeners();

// Exported only for unit tests — not part of the public API.
export function __testing__() {
  return { handleMessage, performAction, pollAllAccounts, pollAccount, accountState };
}

// Kick off an initial poll shortly after worker boot.
(async () => {
  try {
    // Restore last-known state so the popup responds before the first poll completes.
    const persisted = await getPersistedAccountState();
    for (const [id, state] of Object.entries(persisted)) {
      accountState.set(id, state);
    }
    await rescheduleAlarm();
    await pollAllAccounts();
  } catch (err) {
    console.warn('Initial poll failed:', err);
  }
})();
