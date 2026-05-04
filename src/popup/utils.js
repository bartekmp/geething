import { api, els } from './state.js';

export function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

export function sendMessage(payload) {
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

export function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)}M`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)}K`;
  }
  return `${bytes} B`;
}

export function getFileIconKey(mimeType) {
  if (mimeType?.startsWith('image/')) {
    return 'fileImage';
  }
  return 'fileGeneric';
}
