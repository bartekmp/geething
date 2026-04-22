import {
  ACCOUNT_COLORS,
  DEFAULT_SETTINGS,
  SOUND_MAX_BYTES,
  SOUND_MAX_SECONDS,
} from '../shared/constants.js';
import { applyTheme, watchSystemTheme } from '../shared/theme.js';
import { getSoundDataUrl, saveSoundDataUrl, clearSoundDataUrl } from '../shared/storage.js';

const api = typeof browser !== 'undefined' ? browser : globalThis.chrome;

const els = {
  accountsList: document.getElementById('accounts-list'),
  addAccount: document.getElementById('add-account'),
  accountsStatus: document.getElementById('accounts-status'),
  notificationsEnabled: document.getElementById('notificationsEnabled'),
  notificationSound: document.getElementById('notificationSound'),
  notificationContentMode: document.getElementById('notificationContentMode'),
  pollIntervalMinutes: document.getElementById('pollIntervalMinutes'),
  pollValue: document.getElementById('pollValue'),
  maxMessagesPerAccount: document.getElementById('maxMessagesPerAccount'),
  autoMarkReadOnOpen: document.getElementById('autoMarkReadOnOpen'),
  theme: document.getElementById('theme'),
  popupWidth: document.getElementById('popupWidth'),
  popupWidthValue: document.getElementById('popupWidthValue'),
  previewSound: document.getElementById('preview-sound'),
  soundUpload: document.getElementById('sound-upload'),
  soundClear: document.getElementById('sound-clear'),
  soundStatus: document.getElementById('sound-status'),
  saveIndicator: document.getElementById('save-indicator'),
  version: document.getElementById('version'),
  changelogLink: document.getElementById('changelog-link'),
};

function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function sendMessage(payload) {
  return new Promise((resolve, reject) => {
    const handle = (response) => {
      const err = api.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      if (!response || response.ok === false) {
        reject(new Error(response?.error || 'Background error'));
        return;
      }
      resolve(response.result);
    };
    try {
      const maybePromise = api.runtime.sendMessage(payload, handle);
      if (maybePromise?.then) {
        maybePromise.then(handle).catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

const state = { accounts: [], settings: { ...DEFAULT_SETTINGS } };

async function loadState() {
  const result = await sendMessage({ type: 'geething.getState' });
  state.accounts = result.accounts || [];
  state.settings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
  populateForm();
  renderAccounts();
  applyTheme(state.settings.theme || 'auto');
}

function populateForm() {
  const s = state.settings;
  els.notificationsEnabled.checked = !!s.notificationsEnabled;
  els.notificationSound.checked = !!s.notificationSound;
  els.notificationContentMode.value = s.notificationContentMode || 'title-snippet';
  els.pollIntervalMinutes.value = s.pollIntervalMinutes || 2;
  els.pollValue.value = s.pollIntervalMinutes || 2;
  els.maxMessagesPerAccount.value = s.maxMessagesPerAccount || 20;
  els.autoMarkReadOnOpen.checked = !!s.autoMarkReadOnOpen;
  els.theme.value = s.theme || 'auto';
  els.popupWidth.value = s.popupWidth || DEFAULT_SETTINGS.popupWidth;
  els.popupWidthValue.value = els.popupWidth.value;
  const manifest = api.runtime.getManifest();
  els.version.textContent = `v${manifest.version}`;
  const repoUrl = manifest.homepage_url || 'https://github.com/bartekmp/geething';
  els.changelogLink.href = `${repoUrl}/blob/main/CHANGELOG.md`;
  getSoundDataUrl().then((url) => {
    els.soundClear.hidden = !url;
  });
}

function renderAccounts() {
  clearNode(els.accountsList);
  if (!state.accounts.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'No accounts connected yet.';
    els.accountsList.appendChild(p);
    return;
  }
  for (const account of state.accounts) {
    els.accountsList.appendChild(renderAccountRow(account));
  }
}

function buildColorPicker(account, swatch, onSelect) {
  const picker = document.createElement('div');
  picker.className = 'color-picker';
  picker.setAttribute('role', 'dialog');
  picker.setAttribute('aria-label', 'Pick a color');

  const RADIUS = 36;
  const N = ACCOUNT_COLORS.length;
  ACCOUNT_COLORS.forEach((color, i) => {
    const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
    const x = Math.round(RADIUS * Math.cos(angle));
    const y = Math.round(RADIUS * Math.sin(angle));

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `color-chip${color === account.color ? ' selected' : ''}`;
    chip.style.background = color;
    chip.style.setProperty('--tx', `${x}px`);
    chip.style.setProperty('--ty', `${y}px`);
    chip.style.transitionDelay = `${i * 18}ms`;
    chip.setAttribute('aria-label', `Color ${color}`);

    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      picker.querySelectorAll('.color-chip').forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
      closePicker(picker, swatch);
      onSelect(color);
    });

    picker.appendChild(chip);
  });
  return picker;
}

function openPicker(picker, swatch) {
  document.querySelectorAll('.color-picker.open').forEach((p) => {
    if (p !== picker) {
      const sw = p.closest('.color-picker-wrap')?.querySelector('.color-swatch');
      p.classList.remove('open');
      sw?.classList.remove('open');
    }
  });
  swatch.classList.add('open');
  picker.classList.add('open');

  const handler = (e) => {
    if (!picker.contains(e.target) && e.target !== swatch) {
      closePicker(picker, swatch);
      document.removeEventListener('click', handler, true);
    }
  };
  setTimeout(() => document.addEventListener('click', handler, true), 0);
}

function closePicker(picker, swatch) {
  swatch.classList.remove('open');
  picker.classList.remove('open');
}

function renderAccountRow(account) {
  const row = document.createElement('div');
  row.className = 'account-row';

  const swatchWrap = document.createElement('div');
  swatchWrap.className = 'color-picker-wrap';

  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'color-swatch';
  swatch.style.background = account.color || ACCOUNT_COLORS[0];
  swatch.title = 'Pick color';
  swatch.setAttribute('aria-label', 'Pick color');

  const picker = buildColorPicker(account, swatch, async (color) => {
    await sendMessage({
      type: 'geething.updateAccount',
      accountId: account.id,
      patch: { color },
    });
    account.color = color;
    swatch.style.background = color;
    flashSaved();
  });

  swatch.addEventListener('click', (e) => {
    e.stopPropagation();
    if (picker.classList.contains('open')) {
      closePicker(picker, swatch);
    } else {
      openPicker(picker, swatch);
    }
  });

  swatchWrap.append(swatch, picker);

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.value = account.label || account.email;
  labelInput.setAttribute('aria-label', `Label for ${account.email}`);
  let debounceHandle = null;
  labelInput.addEventListener('input', () => {
    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(async () => {
      await sendMessage({
        type: 'geething.updateAccount',
        accountId: account.id,
        patch: { label: labelInput.value },
      });
      account.label = labelInput.value;
      flashSaved();
    }, 400);
  });

  const email = document.createElement('span');
  email.className = 'email';
  email.textContent = account.email;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn-danger';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', async () => {
    const confirmed = window.confirm(`Remove ${account.email}?`);
    if (!confirmed) {
      return;
    }
    removeBtn.disabled = true;
    try {
      await sendMessage({ type: 'geething.removeAccount', accountId: account.id });
      await loadState();
    } catch (err) {
      showStatus(err.message || String(err));
      removeBtn.disabled = false;
    }
  });

  const muteLabel = document.createElement('label');
  muteLabel.className = 'mute-toggle';
  muteLabel.title = 'Mute notifications for this account';
  const muteInput = document.createElement('input');
  muteInput.type = 'checkbox';
  muteInput.checked = !!account.muted;
  muteInput.setAttribute('aria-label', `Mute notifications for ${account.email}`);
  muteInput.addEventListener('change', async () => {
    await sendMessage({
      type: 'geething.updateAccount',
      accountId: account.id,
      patch: { muted: muteInput.checked },
    });
    account.muted = muteInput.checked;
    flashSaved();
  });
  const muteText = document.createElement('span');
  muteText.textContent = 'Mute';
  muteLabel.append(muteInput, muteText);

  row.append(swatchWrap, labelInput, email, muteLabel, removeBtn);

  const labelsRow = document.createElement('div');
  labelsRow.className = 'account-labels-row';
  const labelsCaption = document.createElement('span');
  labelsCaption.className = 'labels-caption';
  labelsCaption.textContent = 'Watch:';
  labelsRow.appendChild(labelsCaption);

  const WATCH_LABELS = [
    { id: 'INBOX', name: 'Inbox' },
    { id: 'STARRED', name: 'Starred' },
    { id: 'IMPORTANT', name: 'Important' },
  ];
  const currentLabels = account.watchedLabels?.length ? account.watchedLabels : ['INBOX'];

  for (const { id: labelId, name: labelName } of WATCH_LABELS) {
    const chip = document.createElement('label');
    chip.className = 'label-chip';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = currentLabels.includes(labelId);
    cb.addEventListener('change', async () => {
      const allCbs = labelsRow.querySelectorAll('input[type=checkbox]');
      const selected = Array.from(allCbs)
        .filter((c) => c.checked)
        .map((c) => c.dataset.labelId);
      if (!selected.length) {
        cb.checked = true;
        return;
      }
      await sendMessage({
        type: 'geething.updateAccount',
        accountId: account.id,
        patch: { watchedLabels: selected },
      });
      account.watchedLabels = selected;
      flashSaved();
    });
    cb.dataset.labelId = labelId;
    const chipText = document.createElement('span');
    chipText.textContent = labelName;
    chip.append(cb, chipText);
    labelsRow.appendChild(chip);
  }

  const wrap = document.createElement('div');
  wrap.className = 'account-row-wrap';
  wrap.append(row, labelsRow);
  return wrap;
}

function showStatus(msg) {
  if (!msg) {
    els.accountsStatus.hidden = true;
    els.accountsStatus.textContent = '';
    return;
  }
  els.accountsStatus.hidden = false;
  els.accountsStatus.textContent = msg;
}

let saveTimer = null;
function flashSaved() {
  els.saveIndicator.hidden = false;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    els.saveIndicator.hidden = true;
  }, 1200);
}

async function saveSettings(patch) {
  const result = await api.storage.sync.get('settings');
  const current = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
  const merged = { ...current, ...patch };
  await api.storage.sync.set({ settings: merged });
  state.settings = merged;
  await sendMessage({ type: 'geething.settingsChanged' }).catch(() => {});
  flashSaved();
}

// Wire settings inputs.
els.notificationsEnabled.addEventListener('change', () =>
  saveSettings({ notificationsEnabled: els.notificationsEnabled.checked }),
);
els.notificationSound.addEventListener('change', () =>
  saveSettings({ notificationSound: els.notificationSound.checked }),
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
els.maxMessagesPerAccount.addEventListener('change', () =>
  saveSettings({ maxMessagesPerAccount: Number(els.maxMessagesPerAccount.value) }),
);
els.autoMarkReadOnOpen.addEventListener('change', () =>
  saveSettings({ autoMarkReadOnOpen: els.autoMarkReadOnOpen.checked }),
);
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

els.previewSound.addEventListener('click', async () => {
  try {
    const customUrl = await getSoundDataUrl();
    if (customUrl) {
      const audio = new Audio(customUrl);
      audio.play().catch(() => {});
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => ctx.close(), 500);
  } catch {
    // ignore
  }
});

els.soundUpload.addEventListener('change', async () => {
  const file = els.soundUpload.files[0];
  if (!file) {
    return;
  }
  els.soundUpload.value = '';
  if (file.size > SOUND_MAX_BYTES) {
    showSoundStatus(`File too large (max ${SOUND_MAX_BYTES / 1000} KB).`);
    return;
  }
  const dataUrl = await readFileAsDataUrl(file);
  const duration = await getAudioDuration(dataUrl);
  if (duration > SOUND_MAX_SECONDS) {
    showSoundStatus(`Audio too long (max ${SOUND_MAX_SECONDS} s, got ${Math.ceil(duration)} s).`);
    return;
  }
  await saveSoundDataUrl(dataUrl);
  els.soundClear.hidden = false;
  showSoundStatus(null);
  flashSaved();
});

els.soundClear.addEventListener('click', async () => {
  await clearSoundDataUrl();
  els.soundClear.hidden = true;
  flashSaved();
});

function showSoundStatus(msg) {
  if (!msg) {
    els.soundStatus.hidden = true;
    els.soundStatus.textContent = '';
    return;
  }
  els.soundStatus.hidden = false;
  els.soundStatus.textContent = msg;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getAudioDuration(dataUrl) {
  return new Promise((resolve) => {
    const audio = new Audio(dataUrl);
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration));
    audio.addEventListener('error', () => resolve(0));
  });
}

watchSystemTheme(() => {
  if (state.settings?.theme === 'auto') {
    applyTheme('auto');
  }
});

loadState().catch((err) => showStatus(err.message || String(err)));
