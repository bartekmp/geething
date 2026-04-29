import { describe, expect, it } from 'vitest';
import {
  registerNotificationClickHandler,
  showGroupedMailNotification,
  showNewMailNotification,
  __testing__,
} from '../../src/background/notifications.js';

const { encodeId, decodeId, buildNotificationContent } = __testing__();

describe('notifications / encoding', () => {
  it('round-trips account and message ids', () => {
    const id = encodeId('acc-1', 'msg-2');
    expect(id.startsWith('geething:')).toBe(true);
    expect(decodeId(id)).toEqual({ accountId: 'acc-1', messageId: 'msg-2' });
  });

  it('returns null for foreign notification ids', () => {
    expect(decodeId('some-other-id')).toBeNull();
  });
});

describe('notifications / content', () => {
  const account = { id: 'a', email: 'me@x.com', label: 'Work' };
  const message = {
    id: 'm1',
    subject: 'Hello',
    snippet: 'This is the body snippet.',
    from: { name: 'Alice', email: 'alice@x.com' },
  };

  it('title-only mode omits snippet', () => {
    const { title, body } = buildNotificationContent(message, account, {
      notificationContentMode: 'title',
    });
    expect(title).toContain('Alice');
    expect(title).toContain('Work');
    expect(body).toBe('Hello');
  });

  it('title-snippet mode includes snippet', () => {
    const { body } = buildNotificationContent(message, account, {
      notificationContentMode: 'title-snippet',
    });
    expect(body).toContain('This is the body snippet.');
  });
});

describe('notifications / showNewMailNotification', () => {
  const account = { id: 'a', email: 'me@x.com', label: 'Me' };
  const message = {
    id: 'm1',
    subject: 'Hi',
    snippet: 'snip',
    from: { name: 'Bob', email: 'b@x' },
  };

  it('skips when notifications disabled', async () => {
    const id = await showNewMailNotification(message, account, { notificationsEnabled: false });
    expect(id).toBeNull();
    expect(browser.notifications.create).not.toHaveBeenCalled();
  });

  it('creates a notification when enabled', async () => {
    await showNewMailNotification(message, account, {
      notificationsEnabled: true,
      notificationContentMode: 'title',
    });
    expect(browser.notifications.create).toHaveBeenCalled();
    const [notificationId, options] = browser.notifications.create.mock.calls[0];
    expect(notificationId.startsWith('geething:')).toBe(true);
    expect(options.type).toBe('basic');
    expect(options.title).toContain('Bob');
  });
});

describe('notifications / showGroupedMailNotification', () => {
  const account = { id: 'a', email: 'me@x.com', label: 'Me' };
  const messages = [
    { id: 'm1', subject: 'First', from: { name: 'A', email: 'a@x' } },
    { id: 'm2', subject: 'Second', from: { name: 'B', email: 'b@x' } },
    { id: 'm3', subject: 'Third', from: { name: 'C', email: 'c@x' } },
  ];

  it('skips when notifications disabled', async () => {
    const id = await showGroupedMailNotification(messages, account, {
      notificationsEnabled: false,
    });
    expect(id).toBeNull();
    expect(browser.notifications.create).not.toHaveBeenCalled();
  });

  it('creates one notification mentioning message count', async () => {
    await showGroupedMailNotification(messages, account, { notificationsEnabled: true });
    expect(browser.notifications.create).toHaveBeenCalledOnce();
    const [, options] = browser.notifications.create.mock.calls[0];
    expect(options.title).toContain('3');
    expect(options.message).toContain('First');
    expect(options.message).toContain('Second');
  });

  it('caps body at 3 subjects even with more messages', async () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, subject: `Msg ${i}` }));
    await showGroupedMailNotification(many, account, { notificationsEnabled: true });
    const [, options] = browser.notifications.create.mock.calls[0];
    // Body is subjects joined by \n — only first 3 lines
    expect(options.message.split('\n')).toHaveLength(3);
  });
});

describe('notifications / showGroupedMailNotification clears individual notifications', () => {
  const account = { id: 'acc1', email: 'me@x.com', label: 'Me' };
  const messages = [
    { id: 'm1', subject: 'First' },
    { id: 'm2', subject: 'Second' },
  ];

  it('clears per-message notifications for the same account before creating grouped', async () => {
    const { notificationRegistry } = __testing__();
    // Simulate two individual notifications already created for this account.
    notificationRegistry.set('geething:acc1|msg-a', { accountId: 'acc1', messageId: 'msg-a' });
    notificationRegistry.set('geething:acc1|msg-b', { accountId: 'acc1', messageId: 'msg-b' });
    // A notification for a different account should not be touched.
    notificationRegistry.set('geething:acc2|msg-c', { accountId: 'acc2', messageId: 'msg-c' });

    await showGroupedMailNotification(messages, account, { notificationsEnabled: true });

    expect(browser.notifications.clear).toHaveBeenCalledWith('geething:acc1|msg-a');
    expect(browser.notifications.clear).toHaveBeenCalledWith('geething:acc1|msg-b');
    expect(browser.notifications.clear).not.toHaveBeenCalledWith('geething:acc2|msg-c');
    expect(notificationRegistry.has('geething:acc1|msg-a')).toBe(false);
    expect(notificationRegistry.has('geething:acc1|msg-b')).toBe(false);
    expect(notificationRegistry.has('geething:acc2|msg-c')).toBe(true);

    // The grouped notification itself should still be created.
    expect(browser.notifications.create).toHaveBeenCalledOnce();
  });
});

describe('notifications / click handler', () => {
  it('subscribes to onClicked', () => {
    registerNotificationClickHandler(() => {});
    expect(browser.notifications.onClicked.addListener).toHaveBeenCalled();
  });
});
