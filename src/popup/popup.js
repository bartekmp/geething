import { applyTheme, watchSystemTheme } from '../shared/theme.js';
import { buildPlainTextDoc, formatPlainTextEmail, processEmailHtml } from './email-format.js';

const api = typeof browser !== 'undefined' ? browser : globalThis.chrome;

// ── SVG icon paths (Material Design) ──────────────────────────────────────
const ICONS = Object.freeze({
  reply: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-10z',
  markRead: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  archive:
    'M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z',
  spam: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
  trash: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  open: 'M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
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
  onboardingAddBtn: document.getElementById('onboarding-add-btn'),
  optionsBtn: document.getElementById('options-btn'),
  pagination: document.getElementById('pagination'),
  paginationPrev: document.getElementById('pagination-prev'),
  paginationNext: document.getElementById('pagination-next'),
  paginationInfo: document.getElementById('pagination-info'),
};

const state = {
  accounts: [],
  settings: null,
  activeAccountId: null,
  pageByAccount: {},
};

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
      renderTabs();
      renderList();
      updateGmailBtn();
      updateMarkAllBtn();
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
  const perPage = state.settings?.maxMessagesPerAccount || 20;
  const totalPages = Math.max(1, Math.ceil(messages.length / perPage));
  const page = Math.min(state.pageByAccount[account.id] || 0, totalPages - 1);
  state.pageByAccount[account.id] = page;

  if (!messages.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    const p = document.createElement('p');
    p.textContent = 'No unread messages.';
    empty.appendChild(p);
    els.list.appendChild(empty);
    els.pagination.hidden = true;
    return;
  }
  const pageMessages = messages.slice(page * perPage, (page + 1) * perPage);
  for (const msg of pageMessages) {
    els.list.appendChild(renderEmailItem(account, msg));
  }
  renderPagination(messages.length, page, totalPages);
}

function renderEmailItem(account, message) {
  const li = document.createElement('li');
  li.className = 'email-item';
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
  row.append(sender, time);

  const subject = document.createElement('div');
  subject.className = 'email-subject';
  subject.textContent = message.subject || '(no subject)';

  const snippet = document.createElement('div');
  snippet.className = 'email-snippet';
  snippet.textContent = message.snippet || '';

  const actions = document.createElement('div');
  actions.className = 'email-actions';
  actions.append(
    makeIconBtn('reply', 'Reply', () => openReply(account, message)),
    makeIconBtn('markRead', 'Mark read', () => performAction(account.id, message.id, 'markRead')),
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
    openDetail(account, message);
  });
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      openDetail(account, message);
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
    await refresh({ silent: true });
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

function renderDetail(account, detail) {
  clearNode(els.detailContent);
  clearNode(els.detailActions);

  // Action buttons in the topbar of the detail view.
  els.detailActions.append(
    makeIconBtn('reply', 'Reply', () => openReply(account, detail)),
    makeIconBtn('markRead', 'Mark read', () =>
      performAction(account.id, detail.id, 'markRead').then(() => {
        els.detail.hidden = true;
      }),
    ),
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
  from.textContent = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const body = document.createElement('div');
  body.className = 'detail-body';
  if (detail.bodyHtml) {
    body.appendChild(makeEmailIframe(processEmailHtml(detail.bodyHtml)));
  } else {
    const rawText = detail.bodyText || detail.snippet || '';
    body.appendChild(makeEmailIframe(buildPlainTextDoc(formatPlainTextEmail(rawText))));
  }

  els.detailContent.append(subject, from, body);
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
  const perPage = state.settings?.maxMessagesPerAccount || 20;
  const totalPages = Math.ceil(messages.length / perPage);
  state.pageByAccount[account.id] = Math.min(
    totalPages - 1,
    (state.pageByAccount[account.id] || 0) + 1,
  );
  renderList();
  els.list.scrollTop = 0;
});

// ── Topbar handlers ────────────────────────────────────────────────────────
els.refreshBtn.addEventListener('click', () => refresh());
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
