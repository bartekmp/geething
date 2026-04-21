import { GMAIL_API_BASE } from '../shared/constants.js';

class HttpError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export { HttpError };

async function gmailFetch(accessToken, path, { method = 'GET', body, query } = {}) {
  const url = new URL(`${GMAIL_API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const v of value) {
          url.searchParams.append(key, v);
        }
      } else {
        url.searchParams.set(key, value);
      }
    }
  }
  const headers = { Authorization: `Bearer ${accessToken}` };
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(url.toString(), { method, headers, body: payload });
  if (!response.ok) {
    let text = '';
    try {
      text = await response.text();
    } catch {
      // ignore
    }
    throw new HttpError(response.status, `Gmail API ${method} ${path} → ${response.status}`, text);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export async function fetchUnreadMessageIds(accessToken, { maxResults = 20 } = {}) {
  const data = await gmailFetch(accessToken, '/users/me/messages', {
    query: { q: 'is:unread in:inbox -category:promotions -category:social', maxResults },
  });
  return (data.messages || []).map((m) => m.id);
}

export async function fetchMessageMetadata(accessToken, messageId) {
  const data = await gmailFetch(accessToken, `/users/me/messages/${messageId}`, {
    query: {
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    },
  });
  return parseMessage(data);
}

export async function fetchMessageDetail(accessToken, messageId) {
  const data = await gmailFetch(accessToken, `/users/me/messages/${messageId}`, {
    query: { format: 'full' },
  });
  return parseMessage(data, { includeBody: true });
}

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

export async function getProfile(accessToken) {
  return gmailFetch(accessToken, '/users/me/profile');
}

export function parseMessage(raw, { includeBody = false } = {}) {
  const headers = indexHeaders(raw.payload?.headers || []);
  const parsed = {
    id: raw.id,
    threadId: raw.threadId,
    snippet: decodeSnippet(raw.snippet || ''),
    internalDate: Number(raw.internalDate) || 0,
    labelIds: raw.labelIds || [],
    from: parseAddress(headers.from),
    subject: headers.subject || '(no subject)',
    date: headers.date || null,
  };
  if (includeBody) {
    const { html, text } = extractBody(raw.payload);
    parsed.bodyHtml = html;
    parsed.bodyText = text;
  }
  return parsed;
}

function indexHeaders(headers) {
  const out = {};
  for (const h of headers) {
    out[h.name.toLowerCase()] = h.value;
  }
  return out;
}

export function parseAddress(raw) {
  if (!raw) {
    return { name: '', email: '' };
  }
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: '', email: raw.trim() };
}

function decodeSnippet(snippet) {
  return snippet
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function extractBody(payload) {
  const out = { html: '', text: '' };
  if (!payload) {
    return out;
  }
  const stack = [payload];
  while (stack.length) {
    const part = stack.shift();
    if (part.parts && part.parts.length) {
      stack.push(...part.parts);
      continue;
    }
    const data = part.body?.data;
    if (!data) {
      continue;
    }
    const decoded = decodeBase64Url(data);
    if (part.mimeType === 'text/html' && !out.html) {
      out.html = decoded;
    } else if (part.mimeType === 'text/plain' && !out.text) {
      out.text = decoded;
    }
  }
  return out;
}

function decodeBase64Url(str) {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}
