import { describe, expect, it, vi } from 'vitest';
import { applyTheme, getEffectiveTheme, watchSystemTheme } from '../../src/shared/theme.js';

describe('theme / getEffectiveTheme', () => {
  it('returns explicit light/dark', () => {
    expect(getEffectiveTheme('light')).toBe('light');
    expect(getEffectiveTheme('dark')).toBe('dark');
  });

  it('returns dark when system prefers dark', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({
      matches: q.includes('dark'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    expect(getEffectiveTheme('auto')).toBe('dark');
  });
});

describe('theme / applyTheme', () => {
  it('sets the theme class and data attribute on the root', () => {
    const root = document.createElement('html');
    const effective = applyTheme('dark', root);
    expect(effective).toBe('dark');
    expect(root.classList.contains('theme-dark')).toBe(true);
    expect(root.classList.contains('theme-light')).toBe(false);
    expect(root.dataset.themeMode).toBe('dark');
  });

  it('replaces existing theme class', () => {
    const root = document.createElement('html');
    applyTheme('light', root);
    applyTheme('dark', root);
    expect(root.classList.contains('theme-light')).toBe(false);
    expect(root.classList.contains('theme-dark')).toBe(true);
  });
});

describe('theme / watchSystemTheme', () => {
  it('registers a change listener and returns an unsubscribe fn', () => {
    const addSpy = vi.fn();
    const removeSpy = vi.fn();
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener: addSpy,
      removeEventListener: removeSpy,
    });
    const unsub = watchSystemTheme(() => {});
    expect(addSpy).toHaveBeenCalled();
    unsub();
    expect(removeSpy).toHaveBeenCalled();
  });
});
