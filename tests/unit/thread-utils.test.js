import { describe, expect, it } from 'vitest';
import { groupByThread } from '../../src/popup/thread-utils.js';

describe('groupByThread', () => {
  it('returns empty array for empty input', () => {
    expect(groupByThread([])).toEqual([]);
  });

  it('groups messages sharing a threadId into one group', () => {
    const msgs = [
      { id: 'a', threadId: 't1', internalDate: 1000 },
      { id: 'b', threadId: 't2', internalDate: 2000 },
      { id: 'c', threadId: 't1', internalDate: 3000 },
    ];
    const threads = groupByThread(msgs);
    expect(threads).toHaveLength(2);
    const t1 = threads.find((t) => t[0].threadId === 't1');
    expect(t1).toHaveLength(2);
    // newest first within thread
    expect(t1[0].id).toBe('c');
    expect(t1[1].id).toBe('a');
  });

  it('sorts threads by their newest message descending', () => {
    const msgs = [
      { id: 'a', threadId: 't1', internalDate: 1000 },
      { id: 'b', threadId: 't2', internalDate: 3000 },
    ];
    const threads = groupByThread(msgs);
    expect(threads[0][0].threadId).toBe('t2');
    expect(threads[1][0].threadId).toBe('t1');
  });

  it('falls back to message id when threadId is absent', () => {
    const msgs = [
      { id: 'a', internalDate: 1000 },
      { id: 'b', internalDate: 2000 },
    ];
    const threads = groupByThread(msgs);
    expect(threads).toHaveLength(2);
    expect(threads[0][0].id).toBe('b');
    expect(threads[1][0].id).toBe('a');
  });

  it('returns single-message threads as length-1 arrays', () => {
    const msgs = [{ id: 'a', threadId: 't1', internalDate: 500 }];
    const threads = groupByThread(msgs);
    expect(threads).toHaveLength(1);
    expect(threads[0]).toHaveLength(1);
  });

  it('handles messages with internalDate 0 or missing', () => {
    const msgs = [
      { id: 'a', threadId: 't1' },
      { id: 'b', threadId: 't1', internalDate: 0 },
    ];
    const threads = groupByThread(msgs);
    expect(threads).toHaveLength(1);
    expect(threads[0]).toHaveLength(2);
  });
});
