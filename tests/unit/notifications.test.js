import { describe, expect, it } from 'vitest';
import {
  registerNotificationClickHandler,
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
      notificationSound: false,
      notificationContentMode: 'title',
    });
    expect(browser.notifications.create).toHaveBeenCalled();
    const [notificationId, options] = browser.notifications.create.mock.calls[0];
    expect(notificationId.startsWith('geething:')).toBe(true);
    expect(options.type).toBe('basic');
    expect(options.title).toContain('Bob');
  });
});

describe('notifications / click handler', () => {
  it('subscribes to onClicked', () => {
    registerNotificationClickHandler(() => {});
    expect(browser.notifications.onClicked.addListener).toHaveBeenCalled();
  });
});
