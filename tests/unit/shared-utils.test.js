import { describe, expect, it } from 'vitest';
import { clearNode, formatFileSize, sendMessage } from '../../src/shared/utils.js';

// ── clearNode ─────────────────────────────────────────────────────────────

describe('clearNode', () => {
  it('removes all children', () => {
    const node = document.createElement('div');
    node.appendChild(document.createElement('span'));
    node.appendChild(document.createElement('p'));
    clearNode(node);
    expect(node.childNodes.length).toBe(0);
  });

  it('is a no-op on an already-empty node', () => {
    const node = document.createElement('div');
    expect(() => clearNode(node)).not.toThrow();
    expect(node.childNodes.length).toBe(0);
  });
});

// ── formatFileSize ────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('returns bytes for values under 1 KB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('rounds to KB for values in the kilobyte range', () => {
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(1500)).toBe('1 KB');
  });

  it('formats MB with one decimal for values >= 1 MB', () => {
    expect(formatFileSize(1_048_576)).toBe('1.0 MB');
    expect(formatFileSize(2_621_440)).toBe('2.5 MB');
  });
});

// ── sendMessage ───────────────────────────────────────────────────────────

describe('sendMessage', () => {
  it('resolves with response.result on success', async () => {
    browser.runtime.sendMessage.mockImplementation((payload, cb) => {
      cb({ ok: true, result: 42 });
    });
    await expect(sendMessage({ type: 'test' })).resolves.toBe(42);
  });

  it('rejects with response.error when ok is false', async () => {
    browser.runtime.sendMessage.mockImplementation((payload, cb) => {
      cb({ ok: false, error: 'something went wrong' });
    });
    await expect(sendMessage({ type: 'test' })).rejects.toThrow('something went wrong');
  });

  it('rejects with generic message when response is null', async () => {
    browser.runtime.sendMessage.mockImplementation((payload, cb) => {
      cb(null);
    });
    await expect(sendMessage({ type: 'test' })).rejects.toThrow('Background error');
  });

  it('rejects when lastError is set', async () => {
    browser.runtime.sendMessage.mockImplementation((payload, cb) => {
      browser.runtime.lastError = { message: 'extension context invalidated' };
      cb(null);
      browser.runtime.lastError = null;
    });
    await expect(sendMessage({ type: 'test' })).rejects.toThrow('extension context invalidated');
  });

  it('rejects when sendMessage throws synchronously', async () => {
    browser.runtime.sendMessage.mockImplementation(() => {
      throw new Error('no background page');
    });
    await expect(sendMessage({ type: 'test' })).rejects.toThrow('no background page');
  });
});
