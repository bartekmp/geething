import { els } from './state.js';
export { clearNode, sendMessage } from '../shared/utils.js';

export function showError(msg) {
  if (!msg) {
    els.error.hidden = true;
    els.error.textContent = '';
    return;
  }
  els.error.hidden = false;
  els.error.textContent = msg;
}

export function setLoading(loading) {
  els.loading.hidden = !loading;
}

export function flashCopied(el) {
  el.classList.remove('copied-blink');
  void el.offsetWidth;
  el.classList.add('copied-blink');
}

export function formatRelativeTime(msEpoch) {
  if (!msEpoch) {
    return '';
  }
  const diff = Date.now() - msEpoch;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) {
    return 'just now';
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return `${hr}h ago`;
  }
  const day = Math.floor(hr / 24);
  if (day < 7) {
    return `${day}d ago`;
  }
  return new Date(msEpoch).toLocaleDateString();
}

export { formatFileSize } from '../shared/utils.js';

export function getFileIconKey(mimeType) {
  if (mimeType?.startsWith('image/')) {
    return 'fileImage';
  }
  return 'fileGeneric';
}
