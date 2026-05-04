import { MAX_BADGE_DISPLAY } from '../shared/constants.js';

const api = typeof browser !== 'undefined' ? browser : globalThis.chrome;

export function formatBadgeText(count) {
  if (!count || count <= 0) {
    return '';
  }
  if (count > MAX_BADGE_DISPLAY) {
    return `${MAX_BADGE_DISPLAY}+`;
  }
  return String(count);
}

export async function updateBadge(totalUnread, { color = '#d93025' } = {}) {
  const text = formatBadgeText(totalUnread);
  try {
    await api.action.setBadgeText({ text });
    if (api.action.setBadgeBackgroundColor) {
      await api.action.setBadgeBackgroundColor({ color });
    }
    if (api.action.setBadgeTextColor) {
      await api.action.setBadgeTextColor({ color: '#ffffff' });
    }
  } catch (err) {
    console.warn('Failed to update badge:', err);
  }
}

export async function clearBadge() {
  await updateBadge(0);
}

// Shows the unread count in gray to signal muted state. Falls back to "Z" when
// there are no unreads so the muted state is still visible on the icon.
export async function showMutedBadge(totalUnread) {
  const text = formatBadgeText(totalUnread) || 'Z';
  try {
    await api.action.setBadgeText({ text });
    if (api.action.setBadgeBackgroundColor) {
      await api.action.setBadgeBackgroundColor({ color: '#5f6368' });
    }
    if (api.action.setBadgeTextColor) {
      await api.action.setBadgeTextColor({ color: '#ffffff' });
    }
  } catch (err) {
    console.warn('Failed to set muted badge:', err);
  }
}

export async function showAuthErrorBadge() {
  try {
    await api.action.setBadgeText({ text: '!' });
    if (api.action.setBadgeBackgroundColor) {
      await api.action.setBadgeBackgroundColor({ color: '#e37400' });
    }
    if (api.action.setBadgeTextColor) {
      await api.action.setBadgeTextColor({ color: '#ffffff' });
    }
  } catch (err) {
    console.warn('Failed to set auth error badge:', err);
  }
}
