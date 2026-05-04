import { describe, expect, it } from 'vitest';
import {
  extractAttachments,
  extractBody,
  fetchAttachment,
  fetchLabels,
  fetchMessageDetail,
  fetchUnreadMessageIds,
  getProfile,
  HttpError,
  parseAddress,
  parseMessage,
} from '../../src/background/gmail-api.js';

function mockOk(data) {
  globalThis.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

describe('gmail-api / parseAddress', () => {
  it('parses "Name <email>" form', () => {
    expect(parseAddress('John Doe <john@example.com>')).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
    });
  });

  it('parses quoted names', () => {
    expect(parseAddress('"Doe, John" <john@example.com>')).toEqual({
      name: 'Doe, John',
      email: 'john@example.com',
    });
  });

  it('handles bare email', () => {
    expect(parseAddress('john@example.com')).toEqual({ name: '', email: 'john@example.com' });
  });

  it('handles empty input', () => {
    expect(parseAddress('')).toEqual({ name: '', email: '' });
  });
});

describe('gmail-api / parseMessage', () => {
  it('extracts headers, snippet, and labels', () => {
    const raw = {
      id: '123',
      threadId: 't',
      snippet: 'Hello &amp; welcome',
      internalDate: '1700000000000',
      labelIds: ['INBOX', 'UNREAD'],
      payload: {
        headers: [
          { name: 'From', value: 'Alice <alice@example.com>' },
          { name: 'Subject', value: 'Hi there' },
          { name: 'Date', value: 'Mon, 1 Jan 2024 00:00:00 +0000' },
        ],
      },
    };
    const parsed = parseMessage(raw);
    expect(parsed.id).toBe('123');
    expect(parsed.snippet).toBe('Hello & welcome');
    expect(parsed.internalDate).toBe(1700000000000);
    expect(parsed.from).toEqual({ name: 'Alice', email: 'alice@example.com' });
    expect(parsed.subject).toBe('Hi there');
    expect(parsed.labelIds).toEqual(['INBOX', 'UNREAD']);
  });

  it('falls back to (no subject) when missing', () => {
    const parsed = parseMessage({ id: '1', payload: { headers: [] } });
    expect(parsed.subject).toBe('(no subject)');
  });
});

describe('gmail-api / extractBody', () => {
  function b64(s) {
    const b = Buffer.from(s, 'utf-8').toString('base64');
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  it('picks html and plain bodies from multipart payload', () => {
    const payload = {
      parts: [
        { mimeType: 'text/plain', body: { data: b64('plain body') } },
        { mimeType: 'text/html', body: { data: b64('<b>html</b>') } },
      ],
    };
    const { html, text } = extractBody(payload);
    expect(text).toBe('plain body');
    expect(html).toBe('<b>html</b>');
  });

  it('returns empty strings for empty payload', () => {
    expect(extractBody(null)).toEqual({ html: '', text: '' });
  });
});

describe('gmail-api / HTTP helpers', () => {
  it('fetches unread message ids with correct query', async () => {
    mockOk({ messages: [{ id: 'a' }, { id: 'b' }] });
    const ids = await fetchUnreadMessageIds('token', { maxResults: 5 });
    expect(ids).toEqual(['a', 'b']);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/users/me/messages');
    expect(url).toContain('q=is%3Aunread');
    expect(url).toContain('maxResults=5');
    expect(url).toContain('labelIds=INBOX');
    expect(init.headers.Authorization).toBe('Bearer token');
  });

  it('fetchUnreadMessageIds sends custom labelIds as repeated params', async () => {
    mockOk({ messages: [{ id: 'x' }] });
    await fetchUnreadMessageIds('token', { labelIds: ['STARRED', 'IMPORTANT'] });
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('labelIds=STARRED');
    expect(url).toContain('labelIds=IMPORTANT');
    expect(url).not.toContain('labelIds=INBOX');
  });

  it('fetchUnreadMessageIds returns empty array when no messages', async () => {
    mockOk({});
    const ids = await fetchUnreadMessageIds('token');
    expect(ids).toEqual([]);
  });

  it('fetches full message detail', async () => {
    mockOk({
      id: '1',
      payload: { headers: [{ name: 'From', value: 'x@y' }] },
      snippet: '',
    });
    const result = await fetchMessageDetail('token', '1');
    expect(result.id).toBe('1');
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('format=full');
  });

  it('throws HttpError on non-ok response with status and message', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    });
    const err = await fetchUnreadMessageIds('tok').catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(401);
  });

  it('fetchAttachment calls the attachments endpoint', async () => {
    mockOk({ data: 'base64data==' });
    const result = await fetchAttachment('tok', 'msg1', 'att1');
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/users/me/messages/msg1/attachments/att1');
    expect(result.data).toBe('base64data==');
  });

  it('getProfile returns profile data', async () => {
    mockOk({ emailAddress: 'me@example.com', messagesTotal: 10 });
    const result = await getProfile('tok');
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/users/me/profile');
    expect(result.emailAddress).toBe('me@example.com');
  });

  it('fetchLabels returns sorted system then user labels', async () => {
    mockOk({
      labels: [
        { id: 'INBOX', type: 'system', labelListVisibility: 'labelShow' },
        { id: 'STARRED', type: 'system', labelListVisibility: 'labelShow' },
        { id: 'Label_123', name: 'work', type: 'user', labelListVisibility: 'labelShow' },
        { id: 'Label_456', name: 'archive', type: 'user', labelListVisibility: 'labelHide' },
        { id: 'DRAFTS', type: 'system' }, // not in SYSTEM_LABEL_NAMES — should be excluded
      ],
    });
    const labels = await fetchLabels('tok');
    expect(labels[0].id).toBe('INBOX');
    expect(labels[1].id).toBe('STARRED');
    // Hidden user label excluded
    expect(labels.find((l) => l.id === 'Label_456')).toBeUndefined();
    // Visible user label included
    expect(labels.find((l) => l.id === 'Label_123')).toBeDefined();
  });

  it('fetchMessageDetail throws when email exceeds size limit', async () => {
    mockOk({
      id: '1',
      sizeEstimate: 6 * 1024 * 1024,
      payload: { headers: [] },
      snippet: '',
    });
    await expect(fetchMessageDetail('tok', '1')).rejects.toThrow('too large');
  });
});

// ── extractAttachments ────────────────────────────────────────────────────

describe('gmail-api / extractAttachments', () => {
  it('extracts named attachments from parts', () => {
    const payload = {
      parts: [
        {
          filename: 'report.pdf',
          mimeType: 'application/pdf',
          body: { size: 1024, attachmentId: 'att1' },
        },
        {
          filename: '',
          mimeType: 'text/plain',
          body: { data: 'abc' },
        },
      ],
    };
    const atts = extractAttachments(payload);
    expect(atts).toHaveLength(1);
    expect(atts[0].filename).toBe('report.pdf');
    expect(atts[0].attachmentId).toBe('att1');
    expect(atts[0].size).toBe(1024);
  });

  it('returns empty array for null payload', () => {
    expect(extractAttachments(null)).toEqual([]);
  });

  it('includes inlineData when includeInlineData is true', () => {
    const payload = {
      parts: [
        {
          filename: 'image.png',
          mimeType: 'image/png',
          body: { size: 200, attachmentId: null, data: 'base64==' },
        },
      ],
    };
    const atts = extractAttachments(payload, { includeInlineData: true });
    expect(atts[0].inlineData).toBe('base64==');
  });

  it('omits inlineData by default', () => {
    const payload = {
      parts: [
        {
          filename: 'image.png',
          mimeType: 'image/png',
          body: { size: 200, attachmentId: null, data: 'base64==' },
        },
      ],
    };
    const atts = extractAttachments(payload);
    expect(atts[0].inlineData).toBeNull();
  });
});
