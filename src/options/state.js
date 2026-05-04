import { DEFAULT_SETTINGS } from '../shared/constants.js';

export const api = typeof browser !== 'undefined' ? browser : globalThis.chrome;

export const els = {
  accountsList: document.getElementById('accounts-list'),
  addAccount: document.getElementById('add-account'),
  accountsStatus: document.getElementById('accounts-status'),
  notificationsEnabled: document.getElementById('notificationsEnabled'),
  notificationContentMode: document.getElementById('notificationContentMode'),
  notificationSoundEnabled: document.getElementById('notificationSoundEnabled'),
  notificationSoundType: document.getElementById('notificationSoundType'),
  notificationSoundVolume: document.getElementById('notificationSoundVolume'),
  notificationSoundVolumeValue: document.getElementById('notificationSoundVolumeValue'),
  soundControls: document.getElementById('sound-controls'),
  customSoundRow: document.getElementById('custom-sound-row'),
  customSoundHint: document.getElementById('custom-sound-hint'),
  customSoundError: document.getElementById('custom-sound-error'),
  customSoundMeta: document.getElementById('custom-sound-meta'),
  customSoundFile: document.getElementById('custom-sound-file'),
  customSoundUpload: document.getElementById('custom-sound-upload'),
  customSoundRemove: document.getElementById('custom-sound-remove'),
  testSoundBtn: document.getElementById('test-sound-btn'),
  pollIntervalMinutes: document.getElementById('pollIntervalMinutes'),
  pollValue: document.getElementById('pollValue'),
  maxMessagesPerAccount: document.getElementById('maxMessagesPerAccount'),
  maxMessagesPerAccountValue: document.getElementById('maxMessagesPerAccountValue'),
  autoMarkReadOnOpen: document.getElementById('autoMarkReadOnOpen'),
  markReadBehavior: document.getElementById('markReadBehavior'),
  groupThreads: document.getElementById('groupThreads'),
  blockExternalImages: document.getElementById('blockExternalImages'),
  keyboardShortcutsEnabled: document.getElementById('keyboardShortcutsEnabled'),
  shortcutsDetail: document.getElementById('shortcuts-detail'),
  theme: document.getElementById('theme'),
  popupWidth: document.getElementById('popupWidth'),
  popupWidthValue: document.getElementById('popupWidthValue'),
  popupHeight: document.getElementById('popupHeight'),
  popupHeightValue: document.getElementById('popupHeightValue'),
  globalMuteRow: document.getElementById('global-mute-row'),
  saveIndicator: document.getElementById('save-indicator'),
  version: document.getElementById('version'),
  changelogLink: document.getElementById('changelog-link'),
};

export const state = {
  accounts: [],
  settings: { ...DEFAULT_SETTINGS },
  globalMute: null,
};

export { clearNode, sendMessage } from '../shared/utils.js';

let saveTimer = null;

export function flashSaved() {
  els.saveIndicator.hidden = false;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    els.saveIndicator.hidden = true;
  }, 1200);
}

export function showStatus(msg) {
  if (!msg) {
    els.accountsStatus.hidden = true;
    els.accountsStatus.textContent = '';
    return;
  }
  els.accountsStatus.hidden = false;
  els.accountsStatus.textContent = msg;
}
