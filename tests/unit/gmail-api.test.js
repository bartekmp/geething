import { describe, expect, it } from 'vitest';
import {
  archiveMessage,
  extractBody,
  fetchMessageDetail,
  fetchUnreadMessageIds,
  HttpError,
  markAsRead,
  markAsSpam,
  moveToTrash,
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
    expect(init.headers.Authorization).toBe('Bearer token');
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

  it('markAsRead sends modify with removeLabelIds UNREAD', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 204 });
    await markAsRead('tok', 'mid');
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/users/me/messages/mid/modify');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body).toEqual({ removeLabelIds: ['UNREAD'] });
  });

  it('moveToTrash hits the trash endpoint', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await moveToTrash('tok', 'mid');
    expect(globalThis.fetch.mock.calls[0][0]).toContain('/users/me/messages/mid/trash');
  });

  it('markAsSpam adds SPAM and removes INBOX', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await markAsSpam('tok', 'mid');
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.addLabelIds).toEqual(['SPAM']);
    expect(body.removeLabelIds).toEqual(['INBOX']);
  });

  it('archiveMessage removes INBOX', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await archiveMessage('tok', 'mid');
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.removeLabelIds).toEqual(['INBOX']);
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
});
