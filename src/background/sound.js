import { DEFAULT_SOUND_PATH } from '../shared/constants.js';
import { getCustomSound } from '../shared/storage.js';

const api = typeof browser !== 'undefined' ? browser : globalThis.chrome;

// Firefox MV3 background = event page (has DOM), so `Audio` works directly.
// Chrome MV3 background = service worker (no DOM), where this would need
// chrome.offscreen — out of scope for this Firefox-only build.
export async function playNotificationSound(settings) {
  if (!settings?.notificationSoundEnabled) {
    return;
  }

  let src;
  if (settings.notificationSoundType === 'custom') {
    const custom = await getCustomSound();
    src = custom?.dataUrl;
    if (!src) {
      src = api.runtime.getURL(DEFAULT_SOUND_PATH);
    }
  } else {
    src = api.runtime.getURL(DEFAULT_SOUND_PATH);
  }

  const volume = Math.max(0, Math.min(1, Number(settings.notificationSoundVolume ?? 0.7)));

  try {
    const audio = new Audio(src);
    audio.volume = volume;
    await audio.play();
  } catch (err) {
    console.warn('[geething] sound playback failed:', err?.name || err);
  }
}
