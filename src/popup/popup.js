import { applyTheme, watchSystemTheme } from '../shared/theme.js';
import { buildPlainTextDoc, formatPlainTextEmail, processEmailHtml } from './email-format.js';

const api = typeof browser !== 'undefined' ? browser : globalThis.chrome;

// ── SVG icon paths (Material Design) ──────────────────────────────────────
const ICONS = Object.freeze({
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

const els = {
  tabs: document.getElementById('account-tabs'),
  list: document.getElementById('email-list'),
  empty: document.getElementById('empty-state'),
  error: document.getElementById('error-banner'),
  loading: document.getElementById('loading'),
  detail: document.getElementById('email-detail'),
  detailContent: document.getElementById('detail-content'),
  detailActions: document.getElementById('detail-actions'),
  backBtn: document.getElementById('back-btn'),
  refreshBtn: document.getElementById('refresh-btn'),
  gmailBtn: document.getElementById('gmail-btn'),
  composeBtn: document.getElementById('compose-btn'),
  markAllBtn: document.getElementById('mark-all-btn'),
  addBtn: document.getElementById('add-account-btn'),
  selectBtn: document.getElementById('select-btn'),
  onboardingAddBtn: document.getElementById('onboarding-add-btn'),
  optionsBtn: document.getElementById('options-btn'),
  pagination: document.getElementById('pagination'),
  paginationPrev: document.getElementById('pagination-prev'),
  paginationNext: document.getElementById('pagination-next'),
  paginationInfo: document.getElementById('pagination-info'),
  bulkBar: document.getElementById('bulk-bar'),
  bulkCount: document.getElementById('bulk-count'),
  bulkReadBtn: document.getElementById('bulk-read-btn'),
  bulkArchiveBtn: document.getElementById('bulk-archive-btn'),
  bulkTrashBtn: document.getElementById('bulk-trash-btn'),
  bulkCancelBtn: document.getElementById('bulk-cancel-btn'),
};

const state = {
  accounts: [],
  settings: null,
  activeAccountId: null,
  pageByAccount: {},
  selectionMode: false,
  selectedMessages: new Set(),
  expandedThreads: new Set(),
};

// Message IDs marked read in 'dim' mode — cleared on every loadState().
const dimmedMessages = new Set();

// ── Utilities ──────────────────────────────────────────────────────────────
function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function makeSvgIcon(pathD, size = 16) {
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

function makeIconBtn(iconKey, label, handler, { danger = false } = {}) {
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

function makeStarBtn(accountId, messageId, isStarred) {
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
    performAction(accountId, messageId, starred ? 'star' : 'unstar');
  });
  return btn;
}

// Reference to the mark-read toggle rendered in the detail view, so openDetail
// can flip it to "read" after autoMarkReadOnOpen fires.
let detailMarkReadBtn = null;

function makeMarkReadToggleBtn(accountId, messageId, isRead, { onMarkRead } = {}) {
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
      performAction(accountId, messageId, 'markRead');
      onMarkRead?.();
    } else {
      performAction(accountId, messageId, 'markUnread');
    }
  });
  return btn;
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

function showError(msg) {
  if (!msg) {
    els.error.hidden = true;
    els.error.textContent = '';
    return;
  }
  els.error.hidden = false;
  els.error.textContent = msg;
}

function setLoading(loading) {
  els.loading.hidden = !loading;
}

function flashCopied(el) {
  el.classList.remove('copied-blink');
  void el.offsetWidth;
  el.classList.add('copied-blink');
}

function formatRelativeTime(msEpoch) {
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

function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)}M`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)}K`;
  }
  return `${bytes} B`;
}

function getFileIconKey(mimeType) {
  if (mimeType?.startsWith('image/')) {
    return 'fileImage';
  }
  return 'fileGeneric';
}

async function downloadAttachment(accountId, messageId, attachment) {
  let base64Data;
  if (attachment.inlineData) {
    base64Data = attachment.inlineData;
  } else if (attachment.attachmentId) {
    const result = await sendMessage({
      type: 'geething.getAttachment',
      accountId,
      messageId,
      attachmentId: attachment.attachmentId,
    });
    base64Data = result.data;
  } else {
    return;
  }
  const normalized = base64Data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: attachment.mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = attachment.filename || 'attachment';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Threading ──────────────────────────────────────────────────────────────

// Groups a flat message list into threads (arrays of messages sharing a threadId).
// Each thread is sorted newest-first; threads are sorted by their newest message.
function groupByThread(messages) {
  const threads = new Map();
  for (const msg of messages) {
    const tid = msg.threadId || msg.id;
    if (!threads.has(tid)) {
      threads.set(tid, []);
    }
    threads.get(tid).push(msg);
  }
  for (const msgs of threads.values()) {
    msgs.sort((a, b) => (b.internalDate || 0) - (a.internalDate || 0));
  }
  return Array.from(threads.values()).sort(
    (a, b) => (b[0].internalDate || 0) - (a[0].internalDate || 0),
  );
}

function renderThreadSubItem(account, message) {
  const li = document.createElement('li');
  li.className = 'thread-sub-item';
  li.tabIndex = 0;
  li.dataset.accountId = account.id;
  li.dataset.messageId = message.id;

  const row = document.createElement('div');
  row.className = 'email-row';

  if (state.selectionMode) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'email-checkbox';
    cb.checked = state.selectedMessages.has(message.id);
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      if (cb.checked) {
        state.selectedMessages.add(message.id);
      } else {
        state.selectedMessages.delete(message.id);
      }
      updateBulkBar();
    });
    li._checkbox = cb;
    row.appendChild(cb);
  }

  const sender = document.createElement('span');
  sender.className = 'thread-sub-sender';
  sender.textContent = message.from?.name || message.from?.email || 'Unknown';

  const time = document.createElement('span');
  time.className = 'email-time';
  time.textContent = formatRelativeTime(message.internalDate);

  row.append(sender, time);

  const snippet = document.createElement('div');
  snippet.className = 'thread-sub-snippet';
  snippet.textContent = message.snippet || '';

  const actions = document.createElement('div');
  actions.className = 'email-actions';
  actions.append(
    makeMarkReadToggleBtn(account.id, message.id, dimmedMessages.has(message.id)),
    makeIconBtn('archive', 'Archive', () => performAction(account.id, message.id, 'archive')),
    makeIconBtn('trash', 'Delete', () => performAction(account.id, message.id, 'trash'), {
      danger: true,
    }),
    makeIconBtn('open', 'Open in Gmail™', () => openInGmail(account, message.id)),
  );

  li.append(row, snippet, actions);

  li.addEventListener('click', (e) => {
    if (e.target.closest('.email-actions') || e.target.type === 'checkbox') {
      return;
    }
    if (state.selectionMode) {
      if (li._checkbox) {
        li._checkbox.checked = !li._checkbox.checked;
        li._checkbox.dispatchEvent(new Event('change'));
      }
      return;
    }
    openDetail(account, message);
  });

  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (state.selectionMode) {
        li._checkbox?.click();
      } else {
        openDetail(account, message);
      }
    }
  });

  return li;
}

function renderThreadItem(account, messages) {
  const latest = messages[0];
  const threadId = latest.threadId || latest.id;
  const isExpanded = state.expandedThreads.has(threadId);

  const li = document.createElement('li');
  li.className = 'email-item thread-item';
  li.style.borderLeftColor = account.color || 'transparent';
  li.tabIndex = 0;

  const row = document.createElement('div');
  row.className = 'email-row';

  // Thread-level checkbox (selects/deselects all messages in the thread).
  // Built first so sub-item refs are available in its change handler.
  const subList = document.createElement('ul');
  subList.className = 'thread-messages';
  subList.setAttribute('role', 'list');
  subList.hidden = !isExpanded;

  const subItems = [];
  for (const msg of messages) {
    const subItem = renderThreadSubItem(account, msg);
    subItems.push(subItem);
    subList.appendChild(subItem);
  }

  if (state.selectionMode) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'email-checkbox';
    cb.checked = messages.every((m) => state.selectedMessages.has(m.id));
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      for (let i = 0; i < messages.length; i++) {
        if (cb.checked) {
          state.selectedMessages.add(messages[i].id);
        } else {
          state.selectedMessages.delete(messages[i].id);
        }
        if (subItems[i]?._checkbox) {
          subItems[i]._checkbox.checked = cb.checked;
        }
      }
      updateBulkBar();
    });
    li._checkbox = cb;
    subList.hidden = false;
    row.appendChild(cb);
  }

  const uniqueSenders = [
    ...new Set(messages.map((m) => m.from?.name || m.from?.email || 'Unknown')),
  ];
  const senderLabel =
    uniqueSenders.slice(0, 2).join(', ') +
    (uniqueSenders.length > 2 ? ` +${uniqueSenders.length - 2}` : '');

  const senders = document.createElement('span');
  senders.className = 'email-sender';
  senders.textContent = senderLabel;

  const rowRight = document.createElement('span');
  rowRight.className = 'email-row-right';

  const countPill = document.createElement('span');
  countPill.className = 'thread-count-pill';
  countPill.textContent = String(messages.length);

  const time = document.createElement('span');
  time.className = 'email-time';
  time.textContent = formatRelativeTime(latest.internalDate);

  rowRight.append(countPill, time);
  row.append(senders, rowRight);

  const subject = document.createElement('div');
  subject.className = 'email-subject';
  subject.textContent = latest.subject || '(no subject)';

  const snippet = document.createElement('div');
  snippet.className = 'email-snippet';
  snippet.textContent = latest.snippet || '';

  // Thread-level actions: operate on all messages in the thread.
  const actions = document.createElement('div');
  actions.className = 'email-actions';
  actions.append(
    makeIconBtn('markRead', 'Mark all read', () => {
      for (const m of messages) {
        performAction(account.id, m.id, 'markRead').catch(() => {});
      }
    }),
    makeIconBtn('archive', 'Archive all', () => {
      for (const m of messages) {
        performAction(account.id, m.id, 'archive').catch(() => {});
      }
    }),
    makeIconBtn(
      'trash',
      'Delete all',
      () => {
        for (const m of messages) {
          performAction(account.id, m.id, 'trash').catch(() => {});
        }
      },
      { danger: true },
    ),
  );

  li.append(row, subject, snippet, actions, subList);

  li.addEventListener('click', (e) => {
    if (
      e.target.closest('.email-actions') ||
      e.target.closest('.thread-messages') ||
      e.target.type === 'checkbox'
    ) {
      return;
    }
    if (state.selectionMode) {
      if (li._checkbox) {
        li._checkbox.checked = !li._checkbox.checked;
        li._checkbox.dispatchEvent(new Event('change'));
      }
      return;
    }
    const nowExpanded = !subList.hidden;
    if (nowExpanded) {
      state.expandedThreads.delete(threadId);
      subList.hidden = true;
    } else {
      state.expandedThreads.add(threadId);
      subList.hidden = false;
    }
  });

  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (state.selectionMode) {
        li._checkbox?.click();
      } else {
        li.click();
      }
    }
  });

  return li;
}

// ── Render ─────────────────────────────────────────────────────────────────
function updateGmailBtn() {
  const account = getActiveAccount();
  if (account) {
    els.gmailBtn.hidden = false;
    els.gmailBtn.onclick = () => {
      api.tabs.create({
        url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(account.email)}`,
      });
    };
    els.composeBtn.hidden = false;
    els.composeBtn.onclick = () => {
      api.tabs.create({
        url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(account.email)}&view=cm`,
      });
      window.close();
    };
  } else {
    els.gmailBtn.hidden = true;
    els.composeBtn.hidden = true;
  }
}

function updateMarkAllBtn() {
  const account = getActiveAccount();
  const hasMessages = (account?.messages?.length || 0) > 0;
  els.markAllBtn.hidden = !hasMessages;
}

function updateSelectBtn() {
  const account = getActiveAccount();
  const hasMessages = (account?.messages?.length || 0) > 0;
  els.selectBtn.hidden = !hasMessages;
  if (!hasMessages && state.selectionMode) {
    state.selectionMode = false;
    state.selectedMessages.clear();
    els.selectBtn.classList.remove('active');
    updateBulkBar();
  }
}

function updateBulkBar() {
  els.bulkBar.hidden = !state.selectionMode;
  if (!state.selectionMode) {
    return;
  }
  const count = state.selectedMessages.size;
  els.bulkCount.textContent =
    count === 0 ? 'No messages selected' : `${count} message${count !== 1 ? 's' : ''} selected`;
  els.bulkReadBtn.disabled = count === 0;
  els.bulkArchiveBtn.disabled = count === 0;
  els.bulkTrashBtn.disabled = count === 0;
}

function toggleSelectMode() {
  state.selectionMode = !state.selectionMode;
  if (!state.selectionMode) {
    state.selectedMessages.clear();
  }
  els.selectBtn.classList.toggle('active', state.selectionMode);
  updateBulkBar();
  renderList();
}

async function bulkAction(action) {
  const account = getActiveAccount();
  if (!account) {
    return;
  }
  const ids = [...state.selectedMessages];
  if (!ids.length) {
    return;
  }
  try {
    [els.bulkReadBtn, els.bulkArchiveBtn, els.bulkTrashBtn].forEach((b) => {
      b.disabled = true;
    });
    await Promise.all(
      ids.map((id) =>
        sendMessage({
          type: 'geething.action',
          accountId: account.id,
          messageId: id,
          action,
        }).catch(() => {}),
      ),
    );
    state.selectedMessages.clear();
    state.selectionMode = false;
    els.selectBtn.classList.remove('active');
    await loadState();
  } catch (err) {
    showError(err.message || String(err));
  }
}

function renderTabs() {
  clearNode(els.tabs);
  for (const account of state.accounts) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `account-tab${account.id === state.activeAccountId ? ' active' : ''}`;
    tab.role = 'tab';
    tab.setAttribute('aria-selected', account.id === state.activeAccountId ? 'true' : 'false');
    tab.dataset.accountId = account.id;

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = account.color || '#888';

    const label = document.createElement('span');
    label.textContent = account.label || account.email;

    const count = document.createElement('span');
    count.className = 'count';
    count.hidden = !account.unreadCount;
    count.textContent = String(account.unreadCount || 0);

    tab.append(dot, label, count);
    tab.addEventListener('click', () => {
      state.activeAccountId = account.id;
      state.pageByAccount[account.id] = 0;
      if (state.selectionMode) {
        state.selectedMessages.clear();
        updateBulkBar();
      }
      renderTabs();
      renderList();
      updateGmailBtn();
      updateMarkAllBtn();
      updateSelectBtn();
    });
    els.tabs.appendChild(tab);
  }
}

function getActiveAccount() {
  return state.accounts.find((a) => a.id === state.activeAccountId) || null;
}

function showReauthBanner(account) {
  clearNode(els.error);
  els.error.hidden = false;
  const msg = document.createElement('span');
  msg.textContent = `${account.email}: authorization expired. `;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Re-authorize';
  btn.addEventListener('click', async () => {
    try {
      setLoading(true);
      await sendMessage({ type: 'geething.reauthorizeAccount', accountId: account.id });
      await loadState();
    } catch (err) {
      showError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  });
  els.error.append(msg, btn);
}

function renderPagination(total, page, totalPages) {
  if (totalPages <= 1) {
    els.pagination.hidden = true;
    return;
  }
  els.pagination.hidden = false;
  els.paginationPrev.disabled = page === 0;
  els.paginationNext.disabled = page >= totalPages - 1;
  els.paginationInfo.textContent = `${page + 1} / ${totalPages}`;
}

function renderList() {
  clearNode(els.list);
  const account = getActiveAccount();
  if (!state.accounts.length) {
    els.empty.hidden = false;
    els.pagination.hidden = true;
    return;
  }
  els.empty.hidden = true;
  if (!account) {
    els.pagination.hidden = true;
    return;
  }
  if (account.needsReauth) {
    showError(null);
    showReauthBanner(account);
  } else if (account.error) {
    showError(`${account.email}: ${account.error}`);
  } else {
    showError(null);
  }
  const messages = account.messages || [];
  const threads = groupByThread(messages);
  const perPage = state.settings?.maxMessagesPerAccount || 20;
  const totalPages = Math.max(1, Math.ceil(threads.length / perPage));
  const page = Math.min(state.pageByAccount[account.id] || 0, totalPages - 1);
  state.pageByAccount[account.id] = page;

  if (!threads.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    const p = document.createElement('p');
    p.textContent = 'No unread messages.';
    empty.appendChild(p);
    els.list.appendChild(empty);
    els.pagination.hidden = true;
    return;
  }
  const pageThreads = threads.slice(page * perPage, (page + 1) * perPage);
  for (const group of pageThreads) {
    if (group.length === 1) {
      els.list.appendChild(renderEmailItem(account, group[0]));
    } else {
      els.list.appendChild(renderThreadItem(account, group));
    }
  }
  renderPagination(threads.length, page, totalPages);
}

function renderEmailItem(account, message) {
  const li = document.createElement('li');
  li.className = `email-item${dimmedMessages.has(message.id) ? ' read-dimmed' : ''}`;
  li.style.borderLeftColor = account.color || 'transparent';
  li.tabIndex = 0;
  li.dataset.accountId = account.id;
  li.dataset.messageId = message.id;

  const row = document.createElement('div');
  row.className = 'email-row';
  const sender = document.createElement('span');
  sender.className = 'email-sender';
  sender.textContent = message.from?.name || message.from?.email || 'Unknown';
  const time = document.createElement('span');
  time.className = 'email-time';
  time.textContent = formatRelativeTime(message.internalDate);
  const rowRight = document.createElement('span');
  rowRight.className = 'email-row-right';
  rowRight.appendChild(time);
  if (message.attachments?.length > 0) {
    const pill = document.createElement('span');
    pill.className = 'email-attachment-hint';
    pill.title = `${message.attachments.length} attachment${message.attachments.length > 1 ? 's' : ''}`;
    pill.appendChild(makeSvgIcon(ICONS.paperclip, 11));
    if (message.attachments.length > 1) {
      const count = document.createElement('span');
      count.textContent = message.attachments.length;
      pill.appendChild(count);
    }
    rowRight.appendChild(pill);
  }
  row.append(sender, rowRight);

  if (state.selectionMode) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'email-checkbox';
    cb.checked = state.selectedMessages.has(message.id);
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      if (cb.checked) {
        state.selectedMessages.add(message.id);
      } else {
        state.selectedMessages.delete(message.id);
      }
      updateBulkBar();
    });
    li._checkbox = cb;
    row.insertBefore(cb, row.firstChild);
  }

  const subject = document.createElement('div');
  subject.className = 'email-subject';
  subject.textContent = message.subject || '(no subject)';

  const snippet = document.createElement('div');
  snippet.className = 'email-snippet';
  snippet.textContent = message.snippet || '';

  const actions = document.createElement('div');
  actions.className = 'email-actions';
  const markReadBtn = makeMarkReadToggleBtn(account.id, message.id, dimmedMessages.has(message.id));
  li.setRead = (val) => markReadBtn.setRead(val);
  actions.append(
    makeIconBtn('reply', 'Reply', () => openReply(account, message)),
    makeStarBtn(account.id, message.id, (message.labelIds || []).includes('STARRED')),
    markReadBtn,
    makeIconBtn('archive', 'Archive', () => performAction(account.id, message.id, 'archive')),
    makeIconBtn('spam', 'Spam', () => performAction(account.id, message.id, 'spam'), {
      danger: true,
    }),
    makeIconBtn('trash', 'Delete', () => performAction(account.id, message.id, 'trash'), {
      danger: true,
    }),
    makeIconBtn('open', 'Open in Gmail™', () => openInGmail(account, message.id)),
  );

  li.append(row, subject, snippet, actions);
  li.addEventListener('click', (e) => {
    if (e.target.closest('.email-actions')) {
      return;
    }
    if (e.target.type === 'checkbox') {
      return;
    }
    if (state.selectionMode) {
      if (li._checkbox) {
        li._checkbox.checked = !li._checkbox.checked;
        li._checkbox.dispatchEvent(new Event('change'));
      }
      return;
    }
    openDetail(account, message);
  });
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (state.selectionMode) {
        li._checkbox?.click();
      } else {
        openDetail(account, message);
      }
    }
  });
  return li;
}

function openInGmail(account, messageId) {
  const url = `https://mail.google.com/mail/?authuser=${encodeURIComponent(account.email)}#inbox/${messageId}`;
  performAction(account.id, messageId, 'markRead').catch(() => {});
  api.tabs.create({ url });
  window.close();
}

function openReply(account, message) {
  const to = encodeURIComponent(message.from?.email || '');
  const su = encodeURIComponent(`Re: ${message.subject || ''}`);
  const url = `https://mail.google.com/mail/?authuser=${encodeURIComponent(account.email)}&view=cm&to=${to}&su=${su}`;
  api.tabs.create({ url });
  window.close();
}

async function performAction(accountId, messageId, action) {
  try {
    await sendMessage({ type: 'geething.action', accountId, messageId, action });
    if (action === 'markRead' && state.settings?.markReadBehavior === 'dim') {
      dimmedMessages.add(messageId);
      const li = els.list.querySelector(`[data-message-id="${messageId}"]`);
      li?.classList.add('read-dimmed');
      li?.setRead?.(true);
      document.activeElement?.blur();
    } else if (action === 'markUnread' && dimmedMessages.has(messageId)) {
      dimmedMessages.delete(messageId);
      const li = els.list.querySelector(`[data-message-id="${messageId}"]`);
      li?.classList.remove('read-dimmed');
      li?.setRead?.(false);
      document.activeElement?.blur();
    } else {
      await refresh({ silent: true });
    }
  } catch (err) {
    showError(err.message || String(err));
  }
}

// ── Detail view ────────────────────────────────────────────────────────────
function renderLoadingInto(node) {
  clearNode(node);
  const wrap = document.createElement('div');
  wrap.className = 'loading';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  const text = document.createElement('span');
  text.textContent = 'Loading…';
  wrap.append(spinner, text);
  node.appendChild(wrap);
}

async function openDetail(account, message) {
  els.detail.hidden = false;
  clearNode(els.detailActions);
  renderLoadingInto(els.detailContent);
  try {
    const detail = await sendMessage({
      type: 'geething.getMessageDetail',
      accountId: account.id,
      messageId: message.id,
    });
    renderDetail(account, detail);
    if (state.settings?.autoMarkReadOnOpen) {
      performAction(account.id, message.id, 'markRead');
      detailMarkReadBtn?.setRead(true);
    }
  } catch (err) {
    clearNode(els.detailContent);
    const p = document.createElement('p');
    p.className = 'error-banner';
    p.textContent = err.message || String(err);
    els.detailContent.appendChild(p);
  }
}

// ── Detail rendering ───────────────────────────────────────────────────────

function makeEmailIframe(srcdoc) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-popups');
  iframe.srcdoc = srcdoc;
  return iframe;
}

// ── Detail rendering ───────────────────────────────────────────────────────

function renderAttachmentList(accountId, messageId, attachments) {
  const section = document.createElement('div');
  section.className = 'attachment-list';
  for (const att of attachments) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'attachment-item';
    item.title = `Download ${att.filename}`;

    const icon = makeSvgIcon(ICONS[getFileIconKey(att.mimeType)], 16);
    icon.setAttribute('class', 'attachment-icon');

    const info = document.createElement('span');
    info.className = 'attachment-info';

    const name = document.createElement('span');
    name.className = 'attachment-name';
    name.textContent = att.filename;

    const size = document.createElement('span');
    size.className = 'attachment-size';
    size.textContent = att.size ? formatFileSize(att.size) : '';

    info.append(name, size);
    item.append(icon, info);

    item.addEventListener('click', async () => {
      item.disabled = true;
      try {
        await downloadAttachment(accountId, messageId, att);
      } catch (err) {
        showError(err.message || String(err));
      } finally {
        item.disabled = false;
      }
    });

    section.appendChild(item);
  }
  return section;
}

function renderDetail(account, detail) {
  clearNode(els.detailContent);
  clearNode(els.detailActions);

  detailMarkReadBtn = makeMarkReadToggleBtn(account.id, detail.id, dimmedMessages.has(detail.id), {
    onMarkRead: () => {
      els.detail.hidden = true;
    },
  });

  // Action buttons in the topbar of the detail view.
  els.detailActions.append(
    makeIconBtn('reply', 'Reply', () => openReply(account, detail)),
    makeStarBtn(account.id, detail.id, (detail.labelIds || []).includes('STARRED')),
    detailMarkReadBtn,
    makeIconBtn('archive', 'Archive', () =>
      performAction(account.id, detail.id, 'archive').then(() => {
        els.detail.hidden = true;
      }),
    ),
    makeIconBtn(
      'spam',
      'Spam',
      () =>
        performAction(account.id, detail.id, 'spam').then(() => {
          els.detail.hidden = true;
        }),
      { danger: true },
    ),
    makeIconBtn(
      'trash',
      'Delete',
      () =>
        performAction(account.id, detail.id, 'trash').then(() => {
          els.detail.hidden = true;
        }),
      { danger: true },
    ),
    makeIconBtn('open', 'Open in Gmail™', () => openInGmail(account, detail.id)),
  );

  const subject = document.createElement('h2');
  subject.className = 'detail-subject';
  subject.textContent = detail.subject || '(no subject)';

  const from = document.createElement('div');
  from.className = 'detail-from';
  const fromName = detail.from?.name || detail.from?.email || '';
  const fromEmail = detail.from?.email || '';

  const fromEmailSpan = document.createElement('span');
  fromEmailSpan.textContent = fromEmail;

  const fromLabel = document.createElement('span');
  if (fromName && fromName !== fromEmail) {
    fromLabel.appendChild(document.createTextNode(`${fromName} <`));
    fromLabel.appendChild(fromEmailSpan);
    fromLabel.appendChild(document.createTextNode('>'));
  } else {
    fromLabel.appendChild(fromEmailSpan);
  }
  from.appendChild(fromLabel);

  if (fromEmail) {
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'copy-email-btn';
    copyBtn.title = 'Copy email address';
    copyBtn.setAttribute('aria-label', 'Copy sender email address');
    copyBtn.appendChild(
      makeSvgIcon(
        'M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z',
        13,
      ),
    );
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(fromEmail).then(() => {
        flashCopied(fromEmailSpan);
      });
    });
    from.appendChild(copyBtn);
  }

  const body = document.createElement('div');
  body.className = 'detail-body';
  if (detail.bodyHtml) {
    body.appendChild(
      makeEmailIframe(
        processEmailHtml(detail.bodyHtml, {
          blockExternalImages: !!state.settings?.blockExternalImages,
        }),
      ),
    );
  } else {
    const rawText = detail.bodyText || detail.snippet || '';
    body.appendChild(
      makeEmailIframe(
        buildPlainTextDoc(formatPlainTextEmail(rawText), {
          blockExternalImages: !!state.settings?.blockExternalImages,
        }),
      ),
    );
  }

  const date = document.createElement('div');
  date.className = 'detail-date';
  date.textContent = detail.internalDate
    ? new Date(detail.internalDate).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

  const nodes = [subject, from, date];
  if (detail.attachments?.length > 0) {
    nodes.push(renderAttachmentList(account.id, detail.id, detail.attachments));
  }
  nodes.push(body);
  els.detailContent.append(...nodes);
}

els.backBtn.addEventListener('click', () => {
  els.detail.hidden = true;
});

// ── Pagination handlers ────────────────────────────────────────────────────
els.paginationPrev.addEventListener('click', () => {
  const account = getActiveAccount();
  if (!account) {
    return;
  }
  state.pageByAccount[account.id] = Math.max(0, (state.pageByAccount[account.id] || 0) - 1);
  renderList();
  els.list.scrollTop = 0;
});

els.paginationNext.addEventListener('click', () => {
  const account = getActiveAccount();
  if (!account) {
    return;
  }
  const messages = account.messages || [];
  const threads = groupByThread(messages);
  const perPage = state.settings?.maxMessagesPerAccount || 20;
  const totalPages = Math.ceil(threads.length / perPage);
  state.pageByAccount[account.id] = Math.min(
    totalPages - 1,
    (state.pageByAccount[account.id] || 0) + 1,
  );
  renderList();
  els.list.scrollTop = 0;
});

// ── Topbar handlers ────────────────────────────────────────────────────────
els.refreshBtn.addEventListener('click', () => refresh());
els.selectBtn.addEventListener('click', toggleSelectMode);
els.bulkReadBtn.addEventListener('click', () => bulkAction('markRead'));
els.bulkArchiveBtn.addEventListener('click', () => bulkAction('archive'));
els.bulkTrashBtn.addEventListener('click', () => bulkAction('trash'));
els.bulkCancelBtn.addEventListener('click', () => {
  state.selectionMode = false;
  state.selectedMessages.clear();
  els.selectBtn.classList.remove('active');
  updateBulkBar();
  renderList();
  updateSelectBtn();
});
els.markAllBtn.addEventListener('click', async () => {
  const account = getActiveAccount();
  if (!account) {
    return;
  }
  try {
    els.markAllBtn.disabled = true;
    await sendMessage({ type: 'geething.markAllRead', accountId: account.id });
    await loadState();
  } catch (err) {
    showError(err.message || String(err));
  } finally {
    els.markAllBtn.disabled = false;
  }
});
els.addBtn.addEventListener('click', async () => {
  try {
    setLoading(true);
    await sendMessage({ type: 'geething.addAccount' });
    await loadState();
  } catch (err) {
    showError(err.message || String(err));
  } finally {
    setLoading(false);
  }
});
els.optionsBtn.addEventListener('click', () => {
  api.runtime.openOptionsPage();
  window.close();
});

// ── State ──────────────────────────────────────────────────────────────────
async function loadState() {
  const result = await sendMessage({ type: 'geething.getState' });
  state.accounts = result.accounts || [];
  state.settings = result.settings || {};
  dimmedMessages.clear();
  if (!state.activeAccountId || !state.accounts.find((a) => a.id === state.activeAccountId)) {
    state.activeAccountId = state.accounts[0]?.id || null;
  }
  const width = state.settings.popupWidth || 560;
  document.documentElement.style.setProperty('--popup-width', `${width}px`);
  const height = state.settings.popupHeight || 600;
  document.documentElement.style.setProperty('--popup-height', `${height}px`);
  applyTheme(state.settings.theme || 'auto');
  renderTabs();
  renderList();
  updateGmailBtn();
  updateMarkAllBtn();
  updateSelectBtn();
  setLoading(false);
}

async function refresh({ silent = false } = {}) {
  try {
    if (!silent) {
      setLoading(true);
    }
    await sendMessage({ type: 'geething.refresh' });
    await loadState();
  } catch (err) {
    showError(err.message || String(err));
  } finally {
    setLoading(false);
  }
}

// ── Live refresh while popup is open ──────────────────────────────────────
const LIVE_POLL_MS = 30_000;
let livePollHandle = null;

function startLivePoll() {
  if (livePollHandle) {
    return;
  }
  livePollHandle = setInterval(() => refresh({ silent: true }), LIVE_POLL_MS);
}

function stopLivePoll() {
  clearInterval(livePollHandle);
  livePollHandle = null;
}

// Message from background when new mail arrives while popup is open.
api.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'geething.newMail') {
    refresh({ silent: true });
  }
});

window.addEventListener('unload', stopLivePoll);

watchSystemTheme(() => {
  if (state.settings?.theme === 'auto') {
    applyTheme('auto');
  }
});

// ── Onboarding ────────────────────────────────────────────────────────────
els.onboardingAddBtn.addEventListener('click', () => els.addBtn.click());

// ── Keyboard navigation ───────────────────────────────────────────────────
function getEmailItems() {
  return Array.from(els.list.querySelectorAll('.email-item'));
}

document.addEventListener('keydown', (e) => {
  if (!state.settings?.keyboardShortcutsEnabled) {
    return;
  }
  const tag = e.target.tagName;
  if (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    tag === 'BUTTON' ||
    tag === 'A'
  ) {
    return;
  }

  if (!els.detail.hidden) {
    if (e.key === 'Escape') {
      e.preventDefault();
      els.detail.hidden = true;
      document.activeElement?.blur();
    }
    return;
  }

  const items = getEmailItems();
  const current = items.indexOf(document.activeElement);

  switch (e.key) {
    case 'j':
    case 'ArrowDown': {
      e.preventDefault();
      const next = current >= 0 ? Math.min(current + 1, items.length - 1) : 0;
      items[next]?.focus();
      break;
    }
    case 'k':
    case 'ArrowUp': {
      e.preventDefault();
      const prev = current > 0 ? current - 1 : 0;
      items[prev]?.focus();
      break;
    }
    case 'Enter': {
      if (current < 0) {
        break;
      }
      if (state.selectionMode) {
        const { messageId } = items[current].dataset;
        if (messageId) {
          const cb = items[current]._checkbox;
          if (cb) {
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
          }
        }
        break;
      }
      items[current].click();
      break;
    }
    case 'Escape':
      window.close();
      break;
    case 'r': {
      if (current < 0) {
        break;
      }
      const { accountId, messageId } = items[current].dataset;
      if (accountId && messageId) {
        performAction(accountId, messageId, 'markRead');
      }
      break;
    }
    case 'a': {
      if (current < 0) {
        break;
      }
      const { accountId, messageId } = items[current].dataset;
      if (accountId && messageId) {
        performAction(accountId, messageId, 'archive');
      }
      break;
    }
    case 'o': {
      if (current < 0) {
        break;
      }
      const { accountId, messageId } = items[current].dataset;
      const account = state.accounts.find((acc) => acc.id === accountId);
      if (account && messageId) {
        openInGmail(account, messageId);
      }
      break;
    }
  }
});

// ── Boot ───────────────────────────────────────────────────────────────────
(async () => {
  await loadState();
  startLivePoll();
})().catch((err) => showError(err.message || String(err)));
