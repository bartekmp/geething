import { describe, expect, it, vi } from 'vitest';
import { MUTE_OPTIONS, isGloballyMuted } from '../../src/shared/mute.js';

describe('isGloballyMuted', () => {
  it('returns false for null', () => {
    expect(isGloballyMuted(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isGloballyMuted(undefined)).toBe(false);
  });

  it('returns false for an object with no muteUntil', () => {
    expect(isGloballyMuted({})).toBe(false);
  });

  it('returns true when muteUntil is -1 (indefinite)', () => {
    expect(isGloballyMuted({ muteUntil: -1 })).toBe(true);
  });

  it('returns false when muteUntil is in the past', () => {
    const past = Date.now() - 1000;
    expect(isGloballyMuted({ muteUntil: past })).toBe(false);
  });

  it('returns true when muteUntil is in the future', () => {
    const future = Date.now() + 60_000;
    expect(isGloballyMuted({ muteUntil: future })).toBe(true);
  });

  it('returns false exactly at expiry (not strictly less)', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(isGloballyMuted({ muteUntil: now })).toBe(false);
    vi.restoreAllMocks();
  });
});

describe('MUTE_OPTIONS', () => {
  it('has 7 entries', () => {
    expect(MUTE_OPTIONS).toHaveLength(7);
  });

  it('last entry is indefinite (-1)', () => {
    expect(MUTE_OPTIONS.at(-1).duration).toBe(-1);
  });

  it('all finite durations are positive millisecond values', () => {
    const finite = MUTE_OPTIONS.filter((o) => o.duration !== -1);
    for (const opt of finite) {
      expect(opt.duration).toBeGreaterThan(0);
    }
  });
});
