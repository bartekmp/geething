import { api, dimmedMessages, els, state } from './state.js';
import { sendMessage, showError } from './utils.js';

// Injected by popup.js via initActions() to avoid a circular dependency.
let _refresh;
let _loadState;

export function initActions({ refresh, loadState }) {
  _refresh = refresh;
  _loadState = loadState;
}

export async function performAction(accountId, messageId, action) {
  try {
    await sendMessage({ type: 'geething.action', accountId, messageId, action });
    if (action === 'markRead' && state.settings?.markReadBehavior === 'dim') {
      dimmedMessages.add(messageId);
      const li = els.list.querySelector(`[data-message-id="${messageId}"]`);
      li?.classList.add('read-dimmed');
      li?.setRead?.(true);
      document.activeElement?.blur();
    } else if (action === 'markUnread' && dimmedMessages.has(messageId)) {
      dimmedMessages.delete(messageId);
      const li = els.list.querySelector(`[data-message-id="${messageId}"]`);
      li?.classList.remove('read-dimmed');
      li?.setRead?.(false);
      document.activeElement?.blur();
    } else {
      await _refresh({ silent: true });
    }
  } catch (err) {
    showError(err.message || String(err));
  }
}

export async function performThreadAction(accountId, threadId, action) {
  try {
    await sendMessage({ type: 'geething.threadAction', accountId, threadId, action });
    await _refresh({ silent: true });
  } catch (err) {
    showError(err.message || String(err));
  }
}

export function openInGmail(account, messageId) {
  const url = `https://mail.google.com/mail/?authuser=${encodeURIComponent(account.email)}#inbox/${messageId}`;
  performAction(account.id, messageId, 'markRead').catch(() => {});
  api.tabs.create({ url });
  window.close();
}

export function openReply(account, message) {
  const to = encodeURIComponent(message.from?.email || '');
  const su = encodeURIComponent(`Re: ${message.subject || ''}`);
  const url = `https://mail.google.com/mail/?authuser=${encodeURIComponent(account.email)}&view=cm&to=${to}&su=${su}`;
  api.tabs.create({ url });
  window.close();
}

export async function downloadAttachment(accountId, messageId, attachment) {
  let base64Data;
  if (attachment.inlineData) {
    base64Data = attachment.inlineData;
  } else if (attachment.attachmentId) {
    const result = await sendMessage({
      type: 'geething.getAttachment',
      accountId,
      messageId,
      attachmentId: attachment.attachmentId,
    });
    base64Data = result.data;
  } else {
    return;
  }
  const normalized = base64Data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: attachment.mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = attachment.filename || 'attachment';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function bulkAction(action) {
  const account = state.accounts.find((a) => a.id === state.activeAccountId) || null;
  if (!account) {
    return;
  }
  const ids = [...state.selectedMessages];
  if (!ids.length) {
    return;
  }
  try {
    [els.bulkReadBtn, els.bulkArchiveBtn, els.bulkTrashBtn].forEach((b) => {
      b.disabled = true;
    });
    await Promise.all(
      ids.map((id) =>
        sendMessage({
          type: 'geething.action',
          accountId: account.id,
          messageId: id,
          action,
        }).catch(() => {}),
      ),
    );
    state.selectedMessages.clear();
    state.selectionMode = false;
    els.selectBtn.classList.remove('active');
    await _loadState();
  } catch (err) {
    showError(err.message || String(err));
  }
}
