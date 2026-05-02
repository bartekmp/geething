import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------- Mocks must be declared before the module imports they intercept ----------

vi.mock('../../src/background/dev-seed.js', () => ({
  DEV_MESSAGE_DETAILS: new Map(),
}));

vi.mock('../../src/background/accounts.js', () => {
  class AuthError extends Error {
    constructor(msg) {
      super(msg);
      this.name = 'AuthError';
      this.isAuthError = true;
    }
  }
  return {
    AuthError,
    getAccounts: vi.fn().mockResolvedValue([]),
    getAccountById: vi.fn(),
    addAccount: vi.fn(),
    removeAccount: vi.fn(),
    updateAccount: vi.fn(),
    reorderAccounts: vi.fn(),
    getValidAccessToken: vi.fn(),
  };
});

vi.mock('../../src/background/gmail-api.js', () => ({
  fetchUnreadMessageIds: vi.fn(),
  fetchMessageMetadata: vi.fn(),
  fetchMessageDetail: vi.fn(),
  fetchAttachment: vi.fn(),
  fetchLabels: vi.fn(),
  markAsRead: vi.fn(),
  markAsUnread: vi.fn(),
  archiveMessage: vi.fn(),
  markAsSpam: vi.fn(),
  moveToTrash: vi.fn(),
  starMessage: vi.fn(),
  unstarMessage: vi.fn(),
}));

vi.mock('../../src/background/notifications.js', () => ({
  showNewMailNotification: vi.fn(),
  showGroupedMailNotification: vi.fn(),
  registerNotificationClickHandler: vi.fn(),
  registerNotificationButtonHandler: vi.fn(),
}));

vi.mock('../../src/background/sound.js', () => ({
  playNotificationSound: vi.fn(),
}));

vi.mock('../../src/background/badge.js', () => ({
  updateBadge: vi.fn(),
  clearBadge: vi.fn(),
  showAuthErrorBadge: vi.fn(),
}));

vi.mock('../../src/shared/storage.js', () => ({
  getPersistedAccountState: vi.fn().mockResolvedValue({}),
  savePersistedAccountState: vi.fn(),
  getSeenMessages: vi.fn().mockResolvedValue(new Set()),
  saveSeenMessages: vi.fn(),
  getSettings: vi.fn().mockResolvedValue({ notificationsEnabled: true, pollIntervalMinutes: 2 }),
  saveCustomSound: vi.fn(),
  clearCustomSound: vi.fn(),
  savePkceState: vi.fn(),
  loadPkceState: vi.fn().mockResolvedValue(null),
  clearPkceState: vi.fn(),
}));

import {
  getAccounts,
  getAccountById,
  removeAccount,
  updateAccount,
  reorderAccounts,
  getValidAccessToken,
} from '../../src/background/accounts.js';
import {
  fetchUnreadMessageIds,
  fetchMessageMetadata,
  fetchMessageDetail,
  fetchAttachment,
  fetchLabels,
  markAsRead,
  markAsUnread,
  archiveMessage,
  markAsSpam,
  moveToTrash,
  starMessage,
  unstarMessage,
} from '../../src/background/gmail-api.js';
import {
  showNewMailNotification,
  showGroupedMailNotification,
} from '../../src/background/notifications.js';
import { playNotificationSound } from '../../src/background/sound.js';
import { updateBadge, clearBadge, showAuthErrorBadge } from '../../src/background/badge.js';
import {
  getPersistedAccountState,
  savePersistedAccountState,
  getSeenMessages,
  saveSeenMessages,
  getSettings,
  saveCustomSound,
  clearCustomSound,
} from '../../src/shared/storage.js';
import { __testing__ } from '../../src/background/service-worker.js';

const { handleMessage, performAction, pollAllAccounts, accountState } = __testing__();

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACCOUNT_A = { id: 'acc-a', email: 'a@test.com', label: 'Work', color: '#ff0000' };
const ACCOUNT_B = { id: 'acc-b', email: 'b@test.com', label: 'Personal', color: '#00ff00' };

const MSG_1 = {
  id: 'msg-1',
  subject: 'Hello',
  snippet: 'Hi there',
  from: { name: 'Alice', email: 'alice@test.com' },
  internalDate: 1_000_000,
};
const MSG_2 = {
  id: 'msg-2',
  subject: 'World',
  snippet: 'Bye',
  from: { name: 'Bob', email: 'bob@test.com' },
  internalDate: 2_000_000,
};

// ── Shared setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  accountState.clear();

  // Storage
  getPersistedAccountState.mockResolvedValue({});
  savePersistedAccountState.mockResolvedValue(undefined);
  getSeenMessages.mockResolvedValue(new Set());
  saveSeenMessages.mockResolvedValue(undefined);
  getSettings.mockResolvedValue({ notificationsEnabled: true, pollIntervalMinutes: 2 });
  saveCustomSound.mockResolvedValue(undefined);
  clearCustomSound.mockResolvedValue(undefined);

  // Accounts / API
  getAccounts.mockResolvedValue([]);
  getAccountById.mockResolvedValue(null);
  getValidAccessToken.mockResolvedValue('mock-token');
  removeAccount.mockResolvedValue({ ok: true, revokeOk: true });
  updateAccount.mockResolvedValue(ACCOUNT_A);
  reorderAccounts.mockResolvedValue([]);
  fetchLabels.mockResolvedValue([]);

  // Gmail API
  fetchUnreadMessageIds.mockResolvedValue([]);
  fetchMessageMetadata.mockResolvedValue(MSG_1);
  fetchMessageDetail.mockResolvedValue({ ...MSG_1, bodyText: 'Hi there' });
  fetchAttachment.mockResolvedValue({ data: 'base64data' });
  markAsRead.mockResolvedValue(undefined);
  markAsUnread.mockResolvedValue(undefined);
  archiveMessage.mockResolvedValue(undefined);
  markAsSpam.mockResolvedValue(undefined);
  moveToTrash.mockResolvedValue(undefined);
  starMessage.mockResolvedValue(undefined);
  unstarMessage.mockResolvedValue(undefined);

  // Notifications / badge / sound
  showNewMailNotification.mockResolvedValue('notif-id');
  showGroupedMailNotification.mockResolvedValue('notif-id');
  playNotificationSound.mockReturnValue(undefined);
  updateBadge.mockResolvedValue(undefined);
  clearBadge.mockResolvedValue(undefined);
  showAuthErrorBadge.mockResolvedValue(undefined);
});

// ── pollAllAccounts ───────────────────────────────────────────────────────────

describe('pollAllAccounts', () => {
  it('returns 0 and clears badge when there are no accounts', async () => {
    const total = await pollAllAccounts();

    expect(total).toBe(0);
    expect(clearBadge).toHaveBeenCalled();
    expect(savePersistedAccountState).toHaveBeenCalled();
  });

  it('shows amber ! badge when an account needs re-auth and total unread is 0', async () => {
    getAccounts.mockResolvedValue([ACCOUNT_A]);
    fetchUnreadMessageIds.mockResolvedValue([]);
    // Simulate a prior poll having set needsReauth.
    accountState.set('acc-a', { needsReauth: true, unreadCount: 0, messages: [] });

    await pollAllAccounts({ isInitial: true });

    expect(showAuthErrorBadge).toHaveBeenCalled();
    expect(clearBadge).not.toHaveBeenCalled();
  });

  it('returns total unread count across all accounts and updates badge', async () => {
    getAccounts.mockResolvedValue([ACCOUNT_A, ACCOUNT_B]);
    getValidAccessToken.mockResolvedValueOnce('token-a').mockResolvedValueOnce('token-b');
    fetchUnreadMessageIds.mockResolvedValueOnce(['msg-1']).mockResolvedValueOnce(['msg-2']);
    fetchMessageMetadata.mockResolvedValueOnce(MSG_1).mockResolvedValueOnce(MSG_2);

    const total = await pollAllAccounts({ isInitial: true });

    expect(total).toBe(2);
    expect(updateBadge).toHaveBeenCalledWith(2);
  });

  it('blocks a concurrent poll while one is already in progress', async () => {
    // Make the first poll hang until we release it.
    let resolveGetAccounts;
    getAccounts.mockReturnValueOnce(new Promise((r) => (resolveGetAccounts = r)));

    const firstPoll = pollAllAccounts();
    const secondResult = await pollAllAccounts(); // should return immediately

    expect(secondResult).toBe(0);

    resolveGetAccounts([]); // let first poll finish
    await firstPoll;
  });

  it('does not fire notifications on the initial poll (baseline)', async () => {
    getAccounts.mockResolvedValue([ACCOUNT_A]);
    fetchUnreadMessageIds.mockResolvedValue(['msg-1']);
    fetchMessageMetadata.mockResolvedValue(MSG_1);

    await pollAllAccounts({ isInitial: true });

    expect(showNewMailNotification).not.toHaveBeenCalled();
    expect(showGroupedMailNotification).not.toHaveBeenCalled();
  });

  it('fires a single notification for one genuinely new message', async () => {
    getAccounts.mockResolvedValue([ACCOUNT_A]);
    fetchUnreadMessageIds.mockResolvedValue(['msg-1']);
    fetchMessageMetadata.mockResolvedValue(MSG_1);
    // msg-1 has NOT been seen yet (getSeenMessages returns empty set)

    await pollAllAccounts();

    expect(showNewMailNotification).toHaveBeenCalledWith(MSG_1, ACCOUNT_A, expect.any(Object));
    expect(showGroupedMailNotification).not.toHaveBeenCalled();
  });

  it('fires a grouped notification for multiple new messages', async () => {
    getAccounts.mockResolvedValue([ACCOUNT_A]);
    fetchUnreadMessageIds.mockResolvedValue(['msg-1', 'msg-2']);
    fetchMessageMetadata.mockResolvedValueOnce(MSG_1).mockResolvedValueOnce(MSG_2);

    await pollAllAccounts();

    expect(showGroupedMailNotification).toHaveBeenCalled();
    expect(showNewMailNotification).not.toHaveBeenCalled();
  });

  it('skips notifications for messages already in the seen set', async () => {
    getAccounts.mockResolvedValue([ACCOUNT_A]);
    fetchUnreadMessageIds.mockResolvedValue(['msg-1']);
    fetchMessageMetadata.mockResolvedValue(MSG_1);
    getSeenMessages.mockResolvedValue(new Set(['msg-1']));

    await pollAllAccounts();

    expect(showNewMailNotification).not.toHaveBeenCalled();
  });

  it('persists account state with correct unread count after polling', async () => {
    getAccounts.mockResolvedValue([ACCOUNT_A]);
    fetchUnreadMessageIds.mockResolvedValue(['msg-1']);
    fetchMessageMetadata.mockResolvedValue(MSG_1);

    await pollAllAccounts({ isInitial: true });

    expect(savePersistedAccountState).toHaveBeenCalledWith(
      expect.objectContaining({
        'acc-a': expect.objectContaining({ unreadCount: 1 }),
      }),
    );
  });

  it('continues polling remaining accounts when one account fetch fails', async () => {
    getAccounts.mockResolvedValue([ACCOUNT_A, ACCOUNT_B]);
    getValidAccessToken.mockResolvedValueOnce('token-a').mockResolvedValueOnce('token-b');
    fetchUnreadMessageIds.mockResolvedValueOnce(['msg-1']).mockResolvedValueOnce(['msg-2']);
    // Account A's message metadata fetch fails; Account B succeeds.
    fetchMessageMetadata
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(MSG_2);

    // The poll must not throw; total reflects raw ID counts so the badge stays accurate.
    const total = await pollAllAccounts({ isInitial: true });

    expect(total).toBe(2); // both accounts still report their unread ID count
    // No notification for Account A (metadata missing), Account B is initial so also silent.
    expect(showNewMailNotification).not.toHaveBeenCalled();
    expect(showGroupedMailNotification).not.toHaveBeenCalled();
  });
});

// ── handleMessage / geething.getState ────────────────────────────────────────

describe('handleMessage / geething.getState', () => {
  it('merges in-memory state into account data and returns settings', async () => {
    getAccounts.mockResolvedValue([ACCOUNT_A]);
    getSettings.mockResolvedValue({ pollIntervalMinutes: 5 });
    accountState.set('acc-a', { unreadCount: 3, messages: [MSG_1], error: null });

    const result = await handleMessage({ type: 'geething.getState' });

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].unreadCount).toBe(3);
    expect(result.accounts[0].messages).toEqual([MSG_1]);
    expect(result.settings.pollIntervalMinutes).toBe(5);
  });

  it('defaults unreadCount to 0 for accounts not yet in memory', async () => {
    getAccounts.mockResolvedValue([ACCOUNT_A]);
    getSettings.mockResolvedValue({});

    const result = await handleMessage({ type: 'geething.getState' });

    expect(result.accounts[0].unreadCount).toBe(0);
    expect(result.accounts[0].messages).toEqual([]);
  });
});

// ── handleMessage / geething.getMessageDetail ─────────────────────────────────

describe('handleMessage / geething.getMessageDetail', () => {
  it('returns message detail for a known account and message', async () => {
    getAccountById.mockResolvedValue(ACCOUNT_A);
    getValidAccessToken.mockResolvedValue('token-a');
    fetchMessageDetail.mockResolvedValue({ ...MSG_1, bodyText: 'Hi' });
    accountState.set('acc-a', { messages: [MSG_1], unreadCount: 1 });

    const result = await handleMessage({
      type: 'geething.getMessageDetail',
      accountId: 'acc-a',
      messageId: 'msg-1',
    });

    expect(result.id).toBe('msg-1');
    expect(fetchMessageDetail).toHaveBeenCalledWith('token-a', 'msg-1');
  });

  it('throws when the account does not exist', async () => {
    getAccountById.mockResolvedValue(null);

    await expect(
      handleMessage({ type: 'geething.getMessageDetail', accountId: 'ghost', messageId: 'x' }),
    ).rejects.toThrow('Account not found');
  });

  it('throws when the message does not belong to the account (cross-account access)', async () => {
    getAccountById.mockResolvedValue(ACCOUNT_A);
    // acc-a has msg-1 but the popup asks for msg-99 (different account's message)
    accountState.set('acc-a', { messages: [MSG_1], unreadCount: 1 });

    await expect(
      handleMessage({
        type: 'geething.getMessageDetail',
        accountId: 'acc-a',
        messageId: 'msg-99',
      }),
    ).rejects.toThrow('Message not found for this account');
  });

  it('allows the request when account state has not been loaded yet', async () => {
    getAccountById.mockResolvedValue(ACCOUNT_A);
    getValidAccessToken.mockResolvedValue('token-a');
    fetchMessageDetail.mockResolvedValue({ ...MSG_1, bodyText: 'Hi' });
    // accountState has no entry for 'acc-a' — worker just restarted

    const result = await handleMessage({
      type: 'geething.getMessageDetail',
      accountId: 'acc-a',
      messageId: 'msg-1',
    });

    expect(result).toBeDefined();
  });
});

// ── handleMessage / geething.getAttachment ────────────────────────────────────

describe('handleMessage / geething.getAttachment', () => {
  it('returns attachment data for a known account and message', async () => {
    getAccountById.mockResolvedValue(ACCOUNT_A);
    getValidAccessToken.mockResolvedValue('token-a');
    fetchAttachment.mockResolvedValue({ data: 'base64data' });
    accountState.set('acc-a', { messages: [MSG_1], unreadCount: 1 });

    const result = await handleMessage({
      type: 'geething.getAttachment',
      accountId: 'acc-a',
      messageId: 'msg-1',
      attachmentId: 'att-1',
    });

    expect(result.data).toBe('base64data');
    expect(fetchAttachment).toHaveBeenCalledWith('token-a', 'msg-1', 'att-1');
  });

  it('throws when the message does not belong to the account', async () => {
    getAccountById.mockResolvedValue(ACCOUNT_A);
    accountState.set('acc-a', { messages: [MSG_1], unreadCount: 1 });

    await expect(
      handleMessage({
        type: 'geething.getAttachment',
        accountId: 'acc-a',
        messageId: 'msg-99',
        attachmentId: 'att-1',
      }),
    ).rejects.toThrow('Message not found for this account');
  });

  it('throws when the account does not exist', async () => {
    getAccountById.mockResolvedValue(null);

    await expect(
      handleMessage({
        type: 'geething.getAttachment',
        accountId: 'ghost',
        messageId: 'msg-1',
        attachmentId: 'att-1',
      }),
    ).rejects.toThrow('Account not found');
  });
});

// ── handleMessage / geething.markAllRead ──────────────────────────────────────

describe('handleMessage / geething.markAllRead', () => {
  it('marks every message as read and clears local state', async () => {
    getValidAccessToken.mockResolvedValue('token-a');
    accountState.set('acc-a', { messages: [MSG_1, MSG_2], unreadCount: 2 });

    const result = await handleMessage({ type: 'geething.markAllRead', accountId: 'acc-a' });

    expect(result.ok).toBe(true);
    expect(markAsRead).toHaveBeenCalledWith('token-a', 'msg-1');
    expect(markAsRead).toHaveBeenCalledWith('token-a', 'msg-2');
    expect(accountState.get('acc-a').unreadCount).toBe(0);
    expect(accountState.get('acc-a').messages).toEqual([]);
    expect(clearBadge).toHaveBeenCalled();
  });
});

// ── handleMessage / geething.action ───────────────────────────────────────────

describe('handleMessage / geething.action', () => {
  it('delegates to performAction and returns ok', async () => {
    getValidAccessToken.mockResolvedValue('token-a');
    accountState.set('acc-a', { messages: [MSG_1], unreadCount: 1 });

    const result = await handleMessage({
      type: 'geething.action',
      accountId: 'acc-a',
      messageId: 'msg-1',
      action: 'markRead',
    });

    expect(result.ok).toBe(true);
    expect(markAsRead).toHaveBeenCalledWith('token-a', 'msg-1');
  });
});

// ── handleMessage / unknown / guard ───────────────────────────────────────────

describe('handleMessage / edge cases', () => {
  it('returns undefined for an unrecognized message type', async () => {
    const result = await handleMessage({ type: 'geething.doesNotExist' });
    expect(result).toBeUndefined();
  });

  it('returns undefined and does not throw for null input', async () => {
    await expect(handleMessage(null)).resolves.toBeUndefined();
  });

  it('returns undefined and does not throw for a non-object input', async () => {
    await expect(handleMessage('bad')).resolves.toBeUndefined();
  });
});

// ── performAction ─────────────────────────────────────────────────────────────

describe('performAction', () => {
  beforeEach(() => {
    getValidAccessToken.mockResolvedValue('token-a');
    accountState.set('acc-a', { messages: [MSG_1, MSG_2], unreadCount: 2 });
  });

  it('markRead calls markAsRead and removes the message from local state', async () => {
    await performAction({ accountId: 'acc-a', messageId: 'msg-1', action: 'markRead' });

    expect(markAsRead).toHaveBeenCalledWith('token-a', 'msg-1');
    expect(accountState.get('acc-a').messages.map((m) => m.id)).not.toContain('msg-1');
    expect(accountState.get('acc-a').unreadCount).toBe(1);
  });

  it('archive calls archiveMessage and removes the message from local state', async () => {
    await performAction({ accountId: 'acc-a', messageId: 'msg-1', action: 'archive' });

    expect(archiveMessage).toHaveBeenCalledWith('token-a', 'msg-1');
    expect(accountState.get('acc-a').messages.map((m) => m.id)).not.toContain('msg-1');
  });

  it('trash calls moveToTrash and removes the message from local state', async () => {
    await performAction({ accountId: 'acc-a', messageId: 'msg-1', action: 'trash' });

    expect(moveToTrash).toHaveBeenCalledWith('token-a', 'msg-1');
    expect(accountState.get('acc-a').messages.map((m) => m.id)).not.toContain('msg-1');
  });

  it('spam calls markAsSpam and removes the message from local state', async () => {
    await performAction({ accountId: 'acc-a', messageId: 'msg-1', action: 'spam' });

    expect(markAsSpam).toHaveBeenCalledWith('token-a', 'msg-1');
    expect(accountState.get('acc-a').messages.map((m) => m.id)).not.toContain('msg-1');
  });

  it('star calls starMessage and adds STARRED to the message labelIds', async () => {
    accountState.set('acc-a', {
      messages: [{ ...MSG_1, labelIds: ['INBOX'] }],
      unreadCount: 1,
    });

    await performAction({ accountId: 'acc-a', messageId: 'msg-1', action: 'star' });

    expect(starMessage).toHaveBeenCalledWith('token-a', 'msg-1');
    const msg = accountState.get('acc-a').messages.find((m) => m.id === 'msg-1');
    expect(msg.labelIds).toContain('STARRED');
  });

  it('unstar calls unstarMessage and removes STARRED from the message labelIds', async () => {
    accountState.set('acc-a', {
      messages: [{ ...MSG_1, labelIds: ['INBOX', 'STARRED'] }],
      unreadCount: 1,
    });

    await performAction({ accountId: 'acc-a', messageId: 'msg-1', action: 'unstar' });

    expect(unstarMessage).toHaveBeenCalledWith('token-a', 'msg-1');
    const msg = accountState.get('acc-a').messages.find((m) => m.id === 'msg-1');
    expect(msg.labelIds).not.toContain('STARRED');
  });

  it('star is idempotent — does not add STARRED twice', async () => {
    accountState.set('acc-a', {
      messages: [{ ...MSG_1, labelIds: ['INBOX', 'STARRED'] }],
      unreadCount: 1,
    });

    await performAction({ accountId: 'acc-a', messageId: 'msg-1', action: 'star' });

    const msg = accountState.get('acc-a').messages.find((m) => m.id === 'msg-1');
    expect(msg.labelIds.filter((l) => l === 'STARRED')).toHaveLength(1);
  });

  it('throws for an unknown action', async () => {
    await expect(
      performAction({ accountId: 'acc-a', messageId: 'msg-1', action: 'teleport' }),
    ).rejects.toThrow('Unknown action: teleport');
  });
});
