import { DEFAULT_SETTINGS } from '../shared/constants.js';
import { isGloballyMuted, MUTE_OPTIONS } from '../shared/mute.js';
import { applyTheme, watchSystemTheme } from '../shared/theme.js';
import { initAccountsUi, renderAccounts } from './accounts-ui.js';
import { initSoundUi, refreshSoundUi, registerSoundListeners } from './sound-ui.js';
import { api, clearNode, els, flashSaved, sendMessage, showStatus, state } from './state.js';

// ── Global mute row ────────────────────────────────────────────────────────

function renderGlobalMuteRow() {
  clearNode(els.globalMuteRow);
  const muted = isGloballyMuted(state.globalMute);

  const labelSpan = document.createElement('span');

  if (muted) {
    const { muteUntil } = state.globalMute;
    if (muteUntil === -1) {
      labelSpan.textContent = 'Notifications paused indefinitely';
    } else {
      const timeStr = new Date(muteUntil).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
      labelSpan.textContent = `Notifications paused until ${timeStr}`;
    }
    labelSpan.className = 'mute-status-active';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost';
    btn.textContent = 'Turn off';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await sendMessage({ type: 'geething.clearGlobalMute' });
      state.globalMute = null;
      renderGlobalMuteRow();
      flashSaved();
    });
    els.globalMuteRow.append(labelSpan, btn);
  } else {
    labelSpan.textContent = 'Pause all notifications';

    const controls = document.createElement('span');
    controls.className = 'mute-controls';

    const select = document.createElement('select');
    for (const opt of MUTE_OPTIONS) {
      const option = document.createElement('option');
      option.value = String(opt.duration);
      option.textContent = opt.label;
      select.appendChild(option);
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost';
    btn.textContent = 'Pause';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const duration = Number(select.value);
      await sendMessage({ type: 'geething.setGlobalMute', duration });
      state.globalMute = { muteUntil: duration === -1 ? -1 : Date.now() + duration };
      renderGlobalMuteRow();
      flashSaved();
    });

    controls.append(select, btn);
    els.globalMuteRow.append(labelSpan, controls);
  }
}

// ── Form ↔ settings ────────────────────────────────────────────────────────

function populateForm() {
  const s = state.settings;
  els.notificationsEnabled.checked = !!s.notificationsEnabled;
  els.notificationContentMode.value = s.notificationContentMode || 'title-snippet';
  els.notificationSoundEnabled.checked = !!s.notificationSoundEnabled;
  els.notificationSoundType.value = s.notificationSoundType || 'default';
  const volPct = Math.round((s.notificationSoundVolume ?? 0.7) * 100);
  els.notificationSoundVolume.value = volPct;
  els.notificationSoundVolumeValue.value = volPct;
  refreshSoundUi();
  els.pollIntervalMinutes.value = s.pollIntervalMinutes || 2;
  els.pollValue.value = s.pollIntervalMinutes || 2;
  els.maxMessagesPerAccount.value = s.maxMessagesPerAccount || 20;
  els.maxMessagesPerAccountValue.value = s.maxMessagesPerAccount || 20;
  els.autoMarkReadOnOpen.checked = !!s.autoMarkReadOnOpen;
  els.markReadBehavior.checked = (s.markReadBehavior || 'remove') === 'dim';
  els.groupThreads.checked = s.groupThreads !== false;
  els.blockExternalImages.checked = !!s.blockExternalImages;
  els.keyboardShortcutsEnabled.checked = s.keyboardShortcutsEnabled !== false;
  els.shortcutsDetail.hidden = !els.keyboardShortcutsEnabled.checked;
  els.theme.value = s.theme || 'auto';
  els.popupWidth.value = s.popupWidth || DEFAULT_SETTINGS.popupWidth;
  els.popupWidthValue.value = els.popupWidth.value;
  els.popupHeight.value = s.popupHeight || DEFAULT_SETTINGS.popupHeight;
  els.popupHeightValue.value = els.popupHeight.value;
  const manifest = api.runtime.getManifest();
  els.version.textContent = `v${manifest.version}`;
  const repoUrl = manifest.homepage_url || 'https://github.com/bartekmp/geething';
  els.changelogLink.href = `${repoUrl}/blob/main/CHANGELOG.md`;
}

export async function loadState() {
  const result = await sendMessage({ type: 'geething.getState' });
  state.accounts = result.accounts || [];
  state.settings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
  state.globalMute = result.globalMute || null;
  populateForm();
  renderAccounts();
  renderGlobalMuteRow();
  applyTheme(state.settings.theme || 'auto');
}

export async function saveSettings(patch) {
  const result = await api.storage.sync.get('settings');
  const current = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
  const merged = { ...current, ...patch };
  await api.storage.sync.set({ settings: merged });
  state.settings = merged;
  await sendMessage({ type: 'geething.settingsChanged' }).catch(() => {});
  flashSaved();
}

// Wire up cross-module dependencies that cannot be resolved at import time.
initAccountsUi({ loadState });
initSoundUi({ saveSettings });
registerSoundListeners();

// ── Non-sound settings listeners ──────────────────────────────────────────

els.notificationsEnabled.addEventListener('change', () =>
  saveSettings({ notificationsEnabled: els.notificationsEnabled.checked }),
);
els.notificationContentMode.addEventListener('change', () =>
  saveSettings({ notificationContentMode: els.notificationContentMode.value }),
);
els.pollIntervalMinutes.addEventListener('input', () => {
  els.pollValue.value = els.pollIntervalMinutes.value;
});
els.pollIntervalMinutes.addEventListener('change', () =>
  saveSettings({ pollIntervalMinutes: Number(els.pollIntervalMinutes.value) }),
);
els.maxMessagesPerAccount.addEventListener('input', () => {
  els.maxMessagesPerAccountValue.value = els.maxMessagesPerAccount.value;
});
els.maxMessagesPerAccount.addEventListener('change', () =>
  saveSettings({ maxMessagesPerAccount: Number(els.maxMessagesPerAccount.value) }),
);
els.autoMarkReadOnOpen.addEventListener('change', () =>
  saveSettings({ autoMarkReadOnOpen: els.autoMarkReadOnOpen.checked }),
);
els.markReadBehavior.addEventListener('change', () =>
  saveSettings({ markReadBehavior: els.markReadBehavior.checked ? 'dim' : 'remove' }),
);
els.groupThreads.addEventListener('change', () =>
  saveSettings({ groupThreads: els.groupThreads.checked }),
);
els.blockExternalImages.addEventListener('change', () =>
  saveSettings({ blockExternalImages: els.blockExternalImages.checked }),
);
els.keyboardShortcutsEnabled.addEventListener('change', () => {
  els.shortcutsDetail.hidden = !els.keyboardShortcutsEnabled.checked;
  saveSettings({ keyboardShortcutsEnabled: els.keyboardShortcutsEnabled.checked });
});
els.theme.addEventListener('change', async () => {
  await saveSettings({ theme: els.theme.value });
  applyTheme(els.theme.value);
});
els.popupWidth.addEventListener('input', () => {
  els.popupWidthValue.value = els.popupWidth.value;
});
els.popupWidth.addEventListener('change', () =>
  saveSettings({ popupWidth: Number(els.popupWidth.value) }),
);
els.popupHeight.addEventListener('input', () => {
  els.popupHeightValue.value = els.popupHeight.value;
});
els.popupHeight.addEventListener('change', () =>
  saveSettings({ popupHeight: Number(els.popupHeight.value) }),
);
els.addAccount.addEventListener('click', async () => {
  els.addAccount.disabled = true;
  showStatus(null);
  try {
    await sendMessage({ type: 'geething.addAccount' });
    await loadState();
  } catch (err) {
    showStatus(err.message || String(err));
  } finally {
    els.addAccount.disabled = false;
  }
});

// ── System theme + background messages ────────────────────────────────────

watchSystemTheme(() => {
  if (state.settings?.theme === 'auto') {
    applyTheme('auto');
  }
});

api.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'geething.muteChanged') {
    sendMessage({ type: 'geething.getState' })
      .then((result) => {
        state.globalMute = result.globalMute || null;
        renderGlobalMuteRow();
      })
      .catch(() => {});
  }
});

// ── Boot ───────────────────────────────────────────────────────────────────

loadState().catch((err) => showStatus(err.message || String(err)));
