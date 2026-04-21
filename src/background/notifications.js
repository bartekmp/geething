import { setPendingSound } from '../shared/storage.js';

const api = typeof browser !== 'undefined' ? browser : globalThis.chrome;

const NOTIFICATION_PREFIX = 'geething:';

// accountId|messageId -> notificationId for click handling.
const notificationRegistry = new Map();

function encodeId(accountId, messageId) {
  return `${NOTIFICATION_PREFIX}${accountId}|${messageId}`;
}

function decodeId(notificationId) {
  if (!notificationId.startsWith(NOTIFICATION_PREFIX)) {
    return null;
  }
  const [accountId, messageId] = notificationId.slice(NOTIFICATION_PREFIX.length).split('|');
  return { accountId, messageId };
}

function buildNotificationContent(message, account, settings) {
  const sender = message.from?.name || message.from?.email || 'Unknown sender';
  const title = `${sender} → ${account.label || account.email}`;
  let body = message.subject || '(no subject)';
  if (settings.notificationContentMode === 'title-snippet' && message.snippet) {
    body = `${message.subject}\n${message.snippet.slice(0, 140)}`;
  }
  return { title, body };
}

export async function showNewMailNotification(message, account, settings) {
  if (!settings.notificationsEnabled) {
    return null;
  }
  const { title, body } = buildNotificationContent(message, account, settings);
  const notificationId = encodeId(account.id, message.id);
  const options = {
    type: 'basic',
    iconUrl: api.runtime.getURL('icons/icon-96.png'),
    title,
    message: body,
    buttons: [{ title: 'Mark as Read' }, { title: 'Archive' }],
  };
  try {
    await api.notifications.create(notificationId, options);
    notificationRegistry.set(notificationId, { accountId: account.id, messageId: message.id });
  } catch (err) {
    // Retry without buttons (some platforms reject the buttons field).
    try {
      delete options.buttons;
      await api.notifications.create(notificationId, options);
      notificationRegistry.set(notificationId, { accountId: account.id, messageId: message.id });
    } catch (err2) {
      console.warn('Notification create failed:', err2);
    }
  }
  return notificationId;
}

export function registerNotificationButtonHandler(handler) {
  if (!api.notifications?.onButtonClicked) {
    return;
  }
  api.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    const decoded = decodeId(notificationId);
    if (!decoded) {
      return;
    }
    const action = buttonIndex === 0 ? 'markRead' : 'archive';
    try {
      await handler({ ...decoded, action });
    } finally {
      try {
        await api.notifications.clear(notificationId);
      } catch {
        // ignore
      }
      notificationRegistry.delete(notificationId);
    }
  });
}

export function registerNotificationClickHandler(handler) {
  if (!api.notifications?.onClicked) {
    return;
  }
  api.notifications.onClicked.addListener(async (notificationId) => {
    const decoded = decodeId(notificationId);
    if (!decoded) {
      return;
    }
    try {
      await handler(decoded);
    } finally {
      try {
        await api.notifications.clear(notificationId);
      } catch {
        // ignore
      }
      notificationRegistry.delete(notificationId);
    }
  });
}

// Service workers can't use Web Audio. We set a pending-sound flag in storage
// so the popup plays it when open (immediately via message) or on next open.
export async function playNotificationSound() {
  await setPendingSound();
  try {
    api.runtime.sendMessage({ type: 'geething.playSound' }).catch(() => {
      // Popup not open — sound will play when it next opens.
    });
  } catch {
    // ignore
  }
}

export function __testing__() {
  return { encodeId, decodeId, buildNotificationContent, notificationRegistry };
}
