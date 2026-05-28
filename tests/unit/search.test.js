import { describe, expect, it } from 'vitest';
import { filterMessages, matchesQuery } from '../../src/popup/search.js';

const msg = (over = {}) => ({
  id: 'm1',
  threadId: 't1',
  from: { name: 'Jane Doe', email: 'jane@example.com' },
  subject: 'Quarterly invoice',
  snippet: 'Please find attached the report',
  internalDate: 1000,
  ...over,
});

describe('matchesQuery', () => {
  it('matches on sender name (case-insensitive)', () => {
    expect(matchesQuery(msg(), 'jane')).toBe(true);
    expect(matchesQuery(msg(), 'DOE')).toBe(true);
  });

  it('matches on sender email', () => {
    expect(matchesQuery(msg(), 'example.com')).toBe(true);
  });

  it('matches on subject', () => {
    expect(matchesQuery(msg(), 'invoice')).toBe(true);
  });

  it('matches on snippet', () => {
    expect(matchesQuery(msg(), 'report')).toBe(true);
  });

  it('returns false when no field contains the query', () => {
    expect(matchesQuery(msg(), 'zzz')).toBe(false);
  });

  it('tolerates missing fields', () => {
    expect(matchesQuery({ id: 'x' }, 'anything')).toBe(false);
  });
});

describe('filterMessages', () => {
  const messages = [
    msg({ id: 'a', subject: 'invoice due', from: { name: 'Acme', email: 'a@acme.com' } }),
    msg({
      id: 'b',
      subject: 'lunch?',
      from: { name: 'Bob', email: 'bob@x.com' },
      snippet: 'pizza',
    }),
  ];

  it('returns the input unchanged for an empty query', () => {
    expect(filterMessages(messages, '')).toBe(messages);
  });

  it('returns the input unchanged for a whitespace-only query', () => {
    expect(filterMessages(messages, '   ')).toBe(messages);
  });

  it('returns only matching messages', () => {
    const result = filterMessages(messages, 'invoice');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterMessages(messages, 'zzz')).toEqual([]);
  });

  it('keeps a thread member that matches (filter is per-message)', () => {
    const thread = [
      msg({ id: 'c', threadId: 'tX', subject: 'no match here', snippet: 'plain' }),
      msg({ id: 'd', threadId: 'tX', subject: 'has invoice', snippet: 'plain' }),
    ];
    const result = filterMessages(thread, 'invoice');
    expect(result.map((m) => m.id)).toEqual(['d']);
  });
});
