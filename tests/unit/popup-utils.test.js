import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatFileSize, formatRelativeTime, getFileIconKey } from '../../src/popup/utils.js';

// ── formatRelativeTime ──────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  const FIXED = 1_700_000_000_000;

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty string for null', () => {
    expect(formatRelativeTime(null)).toBe('');
  });

  it('returns empty string for 0', () => {
    expect(formatRelativeTime(0)).toBe('');
  });

  it('returns "just now" for a timestamp 30 seconds ago', () => {
    expect(formatRelativeTime(FIXED - 30_000)).toBe('just now');
  });

  it('returns Xm ago for a timestamp 5 minutes ago', () => {
    expect(formatRelativeTime(FIXED - 5 * 60_000)).toBe('5m ago');
  });

  it('returns Xh ago for a timestamp 3 hours ago', () => {
    expect(formatRelativeTime(FIXED - 3 * 3_600_000)).toBe('3h ago');
  });

  it('returns Xd ago for a timestamp 2 days ago', () => {
    expect(formatRelativeTime(FIXED - 2 * 86_400_000)).toBe('2d ago');
  });

  it('returns a locale date string for timestamps >= 7 days ago', () => {
    const ts = FIXED - 8 * 86_400_000;
    const result = formatRelativeTime(ts);
    expect(result).toBeTruthy();
    expect(result).not.toMatch(/just now|m ago|h ago|d ago/);
  });
});

// ── formatFileSize ────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('formats bytes when < 1024', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats K when < 1 MB', () => {
    expect(formatFileSize(2048)).toBe('2K');
  });

  it('formats M when >= 1 MB', () => {
    expect(formatFileSize(1_048_576)).toBe('1.0M');
  });

  it('handles 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });
});

// ── getFileIconKey ────────────────────────────────────────────────────────

describe('getFileIconKey', () => {
  it('returns "fileImage" for image/* MIME types', () => {
    expect(getFileIconKey('image/png')).toBe('fileImage');
    expect(getFileIconKey('image/jpeg')).toBe('fileImage');
    expect(getFileIconKey('image/gif')).toBe('fileImage');
  });

  it('returns "fileGeneric" for other MIME types', () => {
    expect(getFileIconKey('application/pdf')).toBe('fileGeneric');
    expect(getFileIconKey('text/plain')).toBe('fileGeneric');
    expect(getFileIconKey('video/mp4')).toBe('fileGeneric');
  });

  it('returns "fileGeneric" for null/undefined', () => {
    expect(getFileIconKey(null)).toBe('fileGeneric');
    expect(getFileIconKey(undefined)).toBe('fileGeneric');
  });
});
