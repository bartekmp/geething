import { gmailFetch } from './gmail-api.js';

export async function markAsRead(accessToken, messageId) {
  return gmailFetch(accessToken, `/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    body: { removeLabelIds: ['UNREAD'] },
  });
}

export async function markAsUnread(accessToken, messageId) {
  return gmailFetch(accessToken, `/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    body: { addLabelIds: ['UNREAD'] },
  });
}

export async function moveToTrash(accessToken, messageId) {
  return gmailFetch(accessToken, `/users/me/messages/${messageId}/trash`, { method: 'POST' });
}

export async function markAsSpam(accessToken, messageId) {
  return gmailFetch(accessToken, `/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    body: { addLabelIds: ['SPAM'], removeLabelIds: ['INBOX'] },
  });
}

export async function archiveMessage(accessToken, messageId) {
  return gmailFetch(accessToken, `/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    body: { removeLabelIds: ['INBOX'] },
  });
}

export async function starMessage(accessToken, messageId) {
  return gmailFetch(accessToken, `/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    body: { addLabelIds: ['STARRED'] },
  });
}

export async function unstarMessage(accessToken, messageId) {
  return gmailFetch(accessToken, `/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    body: { removeLabelIds: ['STARRED'] },
  });
}

export async function archiveThread(accessToken, threadId) {
  return gmailFetch(accessToken, `/users/me/threads/${threadId}/modify`, {
    method: 'POST',
    body: { removeLabelIds: ['INBOX'] },
  });
}

export async function trashThread(accessToken, threadId) {
  return gmailFetch(accessToken, `/users/me/threads/${threadId}/trash`, { method: 'POST' });
}

export async function spamThread(accessToken, threadId) {
  return gmailFetch(accessToken, `/users/me/threads/${threadId}/modify`, {
    method: 'POST',
    body: { addLabelIds: ['SPAM'], removeLabelIds: ['INBOX'] },
  });
}

export async function markThreadRead(accessToken, threadId) {
  return gmailFetch(accessToken, `/users/me/threads/${threadId}/modify`, {
    method: 'POST',
    body: { removeLabelIds: ['UNREAD'] },
  });
}
