import { MAX_CUSTOM_SOUND_BYTES, MAX_CUSTOM_SOUND_SECONDS } from '../shared/constants.js';
import { els, sendMessage, showStatus, state } from './state.js';
import { formatFileSize } from '../shared/utils.js';

// Injected via initSoundUi() to break the circular dependency with options.js entry point.
let _saveSettings;

export function initSoundUi({ saveSettings }) {
  _saveSettings = saveSettings;
}

export { formatFileSize };

export function refreshSoundUi() {
  const s = state.settings;
  const enabled = !!s.notificationSoundEnabled;
  els.soundControls.hidden = !enabled;
  const isCustom = (s.notificationSoundType || 'default') === 'custom';
  els.customSoundRow.hidden = !isCustom;
  els.customSoundHint.hidden = !isCustom;
  if (isCustom && s.customSoundName) {
    els.customSoundMeta.textContent = ` — ${s.customSoundName}`;
    els.customSoundRemove.hidden = false;
    els.customSoundUpload.textContent = 'Replace…';
  } else {
    els.customSoundMeta.textContent = isCustom ? ' — none uploaded (using default)' : '';
    els.customSoundRemove.hidden = true;
    els.customSoundUpload.textContent = 'Upload…';
  }
  els.customSoundError.hidden = true;
}

function showSoundError(msg) {
  els.customSoundError.textContent = msg;
  els.customSoundError.hidden = false;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getAudioDuration(src) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(audio.duration);
    audio.onerror = () => reject(new Error('decode failed'));
    audio.src = src;
  });
}

export function registerSoundListeners() {
  els.notificationSoundEnabled.addEventListener('change', async () => {
    await _saveSettings({ notificationSoundEnabled: els.notificationSoundEnabled.checked });
    refreshSoundUi();
  });
  els.notificationSoundType.addEventListener('change', async () => {
    await _saveSettings({ notificationSoundType: els.notificationSoundType.value });
    refreshSoundUi();
  });
  els.notificationSoundVolume.addEventListener('input', () => {
    els.notificationSoundVolumeValue.value = els.notificationSoundVolume.value;
  });
  els.notificationSoundVolume.addEventListener('change', () =>
    _saveSettings({
      notificationSoundVolume: Number(els.notificationSoundVolume.value) / 100,
    }),
  );
  els.testSoundBtn.addEventListener('click', async () => {
    els.testSoundBtn.disabled = true;
    try {
      await sendMessage({ type: 'geething.testSound' });
    } catch (err) {
      showStatus(err.message || String(err));
    } finally {
      setTimeout(() => {
        els.testSoundBtn.disabled = false;
      }, 800);
    }
  });
  els.customSoundUpload.addEventListener('click', () => els.customSoundFile.click());
  els.customSoundFile.addEventListener('change', async () => {
    const file = els.customSoundFile.files?.[0];
    els.customSoundFile.value = '';
    if (!file) {
      return;
    }
    els.customSoundError.hidden = true;

    if (file.size > MAX_CUSTOM_SOUND_BYTES) {
      showSoundError(
        `File is ${formatFileSize(file.size)} — max ${formatFileSize(MAX_CUSTOM_SOUND_BYTES)}.`,
      );
      return;
    }

    let dataUrl;
    try {
      dataUrl = await readFileAsDataUrl(file);
    } catch {
      showSoundError('Could not read the file.');
      return;
    }

    let duration;
    try {
      duration = await getAudioDuration(dataUrl);
    } catch {
      showSoundError('Could not decode the audio file.');
      return;
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      showSoundError('Could not determine audio duration.');
      return;
    }
    if (duration > MAX_CUSTOM_SOUND_SECONDS) {
      showSoundError(`Audio is ${duration.toFixed(1)}s — max ${MAX_CUSTOM_SOUND_SECONDS}s.`);
      return;
    }

    try {
      await sendMessage({
        type: 'geething.uploadCustomSound',
        dataUrl,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        duration,
      });
      await _saveSettings({
        notificationSoundType: 'custom',
        customSoundName: `${file.name} (${formatFileSize(file.size)}, ${duration.toFixed(1)}s)`,
        customSoundDuration: duration,
      });
      refreshSoundUi();
    } catch (err) {
      showSoundError(err.message || String(err));
    }
  });
  els.customSoundRemove.addEventListener('click', async () => {
    try {
      await sendMessage({ type: 'geething.clearCustomSound' });
      await _saveSettings({ customSoundName: '', customSoundDuration: 0 });
      refreshSoundUi();
    } catch (err) {
      showSoundError(err.message || String(err));
    }
  });
}
