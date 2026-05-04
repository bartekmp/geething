import { clearNode } from './utils.js';

export const ICONS = Object.freeze({
  reply: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-10z',
  markRead: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  markUnread:
    'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z',
  archive:
    'M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z',
  spam: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
  trash: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  open: 'M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
  star: 'M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zm-10 6.91l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.28 4.38.38-3.32 2.88 1 4.28L12 16.15z',
  starFilled:
    'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  paperclip:
    'M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z',
  fileGeneric:
    'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  fileImage:
    'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
});

export function makeSvgIcon(pathD, size = 16) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'currentColor');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathD);
  svg.appendChild(path);
  return svg;
}

export function makeIconBtn(iconKey, label, handler, { danger = false } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `action-icon-btn${danger ? ' danger' : ''}`;
  btn.setAttribute('aria-label', label);
  btn.title = label;
  btn.appendChild(makeSvgIcon(ICONS[iconKey]));
  const labelEl = document.createElement('span');
  labelEl.className = 'action-icon-label';
  labelEl.textContent = label;
  btn.appendChild(labelEl);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    handler();
  });
  return btn;
}

// onAction(accountId, messageId, action) — injected by the caller so this
// module stays free of a direct dependency on actions.js.
export function makeStarBtn(accountId, messageId, isStarred, onAction) {
  const btn = document.createElement('button');
  btn.type = 'button';
  let starred = isStarred;

  function update() {
    clearNode(btn);
    btn.className = `action-icon-btn${starred ? ' starred' : ''}`;
    btn.title = starred ? 'Remove star' : 'Star';
    btn.setAttribute('aria-label', starred ? 'Remove star' : 'Star');
    btn.appendChild(makeSvgIcon(starred ? ICONS.starFilled : ICONS.star));
    const labelEl = document.createElement('span');
    labelEl.className = 'action-icon-label';
    labelEl.textContent = starred ? 'Unstar' : 'Star';
    btn.appendChild(labelEl);
  }

  update();
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    starred = !starred;
    update();
    onAction(accountId, messageId, starred ? 'star' : 'unstar');
  });
  return btn;
}

// onAction(accountId, messageId, action) — same injection pattern as makeStarBtn.
export function makeMarkReadToggleBtn(accountId, messageId, isRead, { onMarkRead, onAction } = {}) {
  let read = isRead;
  const btn = document.createElement('button');
  btn.type = 'button';

  function update() {
    clearNode(btn);
    btn.className = 'action-icon-btn';
    btn.title = read ? 'Mark as unread' : 'Mark as read';
    btn.setAttribute('aria-label', read ? 'Mark as unread' : 'Mark as read');
    btn.appendChild(makeSvgIcon(read ? ICONS.markUnread : ICONS.markRead));
    const labelEl = document.createElement('span');
    labelEl.className = 'action-icon-label';
    labelEl.textContent = read ? 'Mark unread' : 'Mark read';
    btn.appendChild(labelEl);
  }

  btn.setRead = (val) => {
    if (read !== val) {
      read = val;
      update();
    }
  };

  update();
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    read = !read;
    update();
    if (read) {
      onAction?.(accountId, messageId, 'markRead');
      onMarkRead?.();
    } else {
      onAction?.(accountId, messageId, 'markUnread');
    }
  });
  return btn;
}
