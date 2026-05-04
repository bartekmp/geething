export const MUTE_OPTIONS = [
  { label: '5 minutes', duration: 5 * 60 * 1000 },
  { label: '15 minutes', duration: 15 * 60 * 1000 },
  { label: '30 minutes', duration: 30 * 60 * 1000 },
  { label: '1 hour', duration: 60 * 60 * 1000 },
  { label: '2 hours', duration: 2 * 60 * 60 * 1000 },
  { label: '6 hours', duration: 6 * 60 * 60 * 1000 },
  { label: 'Indefinitely', duration: -1 },
];

export function isGloballyMuted(mute) {
  if (!mute) {
    return false;
  }
  if (mute.muteUntil === -1) {
    return true;
  }
  if (!mute.muteUntil) {
    return false;
  }
  return Date.now() < mute.muteUntil;
}
