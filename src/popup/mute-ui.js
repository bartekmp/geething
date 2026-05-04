import { isGloballyMuted, MUTE_OPTIONS } from '../shared/mute.js';
import { els, state } from './state.js';
import { clearNode, sendMessage } from './utils.js';

// Injected by popup.js via initMuteUi() to avoid a circular dependency.
let _loadState;

export function initMuteUi({ loadState }) {
  _loadState = loadState;
}

function makeBellSvg({ slashed = false } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'currentColor');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S10.5 3.17 10.5 4v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  );
  svg.appendChild(path);
  if (slashed) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '3');
    line.setAttribute('y1', '3');
    line.setAttribute('x2', '21');
    line.setAttribute('y2', '21');
    line.setAttribute('stroke', 'currentColor');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);
  }
  return svg;
}

export function closeMuteDropdown() {
  els.muteDropdown.hidden = true;
  els.muteBtn.setAttribute('aria-expanded', 'false');
}

export function openMuteDropdown() {
  clearNode(els.muteDropdown);
  const muted = isGloballyMuted(state.globalMute);

  if (muted) {
    const status = document.createElement('div');
    status.className = 'mute-dropdown-status';
    const { muteUntil } = state.globalMute;
    if (muteUntil === -1) {
      status.textContent = 'Muted indefinitely';
    } else {
      const timeStr = new Date(muteUntil).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
      status.textContent = `Muted until ${timeStr}`;
    }
    els.muteDropdown.appendChild(status);

    const unmuteBtn = document.createElement('button');
    unmuteBtn.type = 'button';
    unmuteBtn.className = 'mute-dropdown-item unmute';
    unmuteBtn.setAttribute('role', 'menuitem');
    unmuteBtn.textContent = 'Turn off mute';
    unmuteBtn.addEventListener('click', async () => {
      closeMuteDropdown();
      await sendMessage({ type: 'geething.clearGlobalMute' });
      await _loadState();
    });
    els.muteDropdown.appendChild(unmuteBtn);
  } else {
    const header = document.createElement('div');
    header.className = 'mute-dropdown-header';
    header.textContent = 'Mute for';
    els.muteDropdown.appendChild(header);

    for (const opt of MUTE_OPTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mute-dropdown-item';
      btn.setAttribute('role', 'menuitem');
      btn.textContent = opt.label;
      btn.addEventListener('click', async () => {
        closeMuteDropdown();
        await sendMessage({ type: 'geething.setGlobalMute', duration: opt.duration });
        await _loadState();
      });
      els.muteDropdown.appendChild(btn);
    }
  }

  els.muteDropdown.hidden = false;
  els.muteBtn.setAttribute('aria-expanded', 'true');
}

export function updateMuteBtn() {
  const hasAccounts = state.accounts.length > 0;
  els.muteBtn.hidden = !hasAccounts;
  if (!hasAccounts) {
    return;
  }

  const muted = isGloballyMuted(state.globalMute);
  clearNode(els.muteBtn);
  els.muteBtn.appendChild(makeBellSvg({ slashed: muted }));

  if (muted) {
    els.muteBtn.classList.add('muted');
    els.muteBtn.title = 'Notifications muted — click to change';
    els.muteBtn.setAttribute('aria-label', 'Notifications muted — click to change');
  } else {
    els.muteBtn.classList.remove('muted');
    els.muteBtn.title = 'Mute notifications';
    els.muteBtn.setAttribute('aria-label', 'Mute notifications');
  }
}

export function registerMuteListeners() {
  els.muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (els.muteDropdown.hidden) {
      openMuteDropdown();
    } else {
      closeMuteDropdown();
    }
  });

  document.addEventListener(
    'click',
    (e) => {
      if (!els.muteDropdown.hidden && !els.muteBtnWrapper.contains(e.target)) {
        closeMuteDropdown();
      }
    },
    true,
  );
}
