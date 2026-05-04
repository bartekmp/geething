import { describe, expect, it } from 'vitest';
import {
  archiveMessage,
  archiveThread,
  markAsRead,
  markAsSpam,
  markAsUnread,
  markThreadRead,
  moveToTrash,
  spamThread,
  starMessage,
  trashThread,
  unstarMessage,
} from '../../src/background/gmail-actions.js';

function mockOk(data = {}) {
  globalThis.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

function mockNoContent() {
  globalThis.fetch.mockResolvedValue({ ok: true, status: 204 });
}

describe('gmail-actions / message actions', () => {
  it('markAsRead sends modify with removeLabelIds UNREAD', async () => {
    mockNoContent();
    await markAsRead('tok', 'mid');
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/users/me/messages/mid/modify');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ removeLabelIds: ['UNREAD'] });
  });

  it('markAsUnread sends modify with addLabelIds UNREAD', async () => {
    mockOk();
    await markAsUnread('tok', 'mid');
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/users/me/messages/mid/modify');
    expect(JSON.parse(init.body)).toEqual({ addLabelIds: ['UNREAD'] });
  });

  it('moveToTrash hits the trash endpoint', async () => {
    mockOk();
    await moveToTrash('tok', 'mid');
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/users/me/messages/mid/trash');
    expect(init.method).toBe('POST');
  });

  it('markAsSpam adds SPAM and removes INBOX', async () => {
    mockOk();
    await markAsSpam('tok', 'mid');
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.addLabelIds).toEqual(['SPAM']);
    expect(body.removeLabelIds).toEqual(['INBOX']);
  });

  it('archiveMessage removes INBOX', async () => {
    mockOk();
    await archiveMessage('tok', 'mid');
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.removeLabelIds).toEqual(['INBOX']);
  });

  it('starMessage adds STARRED', async () => {
    mockOk();
    await starMessage('tok', 'mid');
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.addLabelIds).toEqual(['STARRED']);
  });

  it('unstarMessage removes STARRED', async () => {
    mockOk();
    await unstarMessage('tok', 'mid');
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.removeLabelIds).toEqual(['STARRED']);
  });
});

describe('gmail-actions / thread actions', () => {
  it('archiveThread removes INBOX from the thread', async () => {
    mockOk();
    await archiveThread('tok', 'tid1');
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/users/me/threads/tid1/modify');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ removeLabelIds: ['INBOX'] });
  });

  it('trashThread hits the thread trash endpoint', async () => {
    mockOk();
    await trashThread('tok', 'tid2');
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/users/me/threads/tid2/trash');
    expect(init.method).toBe('POST');
  });

  it('spamThread adds SPAM and removes INBOX from the thread', async () => {
    mockOk();
    await spamThread('tok', 'tid3');
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/users/me/threads/tid3/modify');
    const body = JSON.parse(init.body);
    expect(body.addLabelIds).toEqual(['SPAM']);
    expect(body.removeLabelIds).toEqual(['INBOX']);
  });

  it('markThreadRead removes UNREAD from the thread', async () => {
    mockOk();
    await markThreadRead('tok', 'tid4');
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/users/me/threads/tid4/modify');
    expect(JSON.parse(init.body)).toEqual({ removeLabelIds: ['UNREAD'] });
  });
});
