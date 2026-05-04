import { groupByThread } from './thread-utils.js';
import { openInGmail, openReply, performAction, performThreadAction } from './actions.js';
import { ICONS, makeIconBtn, makeMarkReadToggleBtn, makeStarBtn, makeSvgIcon } from './icons.js';
import { openDetail } from './detail.js';
import { api, dimmedMessages, els, state } from './state.js';
import { clearNode, formatRelativeTime, sendMessage, setLoading, showError } from './utils.js';

// Injected by popup.js via initList() to avoid a circular dependency.
let _loadState;

export function initList({ loadState }) {
  _loadState = loadState;
}

export function getActiveAccount() {
  return state.accounts.find((a) => a.id === state.activeAccountId) || null;
}

export function getThreads(messages) {
  return state.settings?.groupThreads !== false
    ? groupByThread(messages)
    : messages.map((m) => [m]);
}

export function persistExpandedThreads() {
  api.storage.session?.set({ expandedThreads: [...state.expandedThreads] }).catch(() => {});
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
      await _loadState();
    } catch (err) {
      showError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  });
  els.error.append(msg, btn);
}

function renderThreadSubItem(account, message, threadMessages) {
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

  if (message.attachments?.length > 0) {
    const attPill = document.createElement('span');
    attPill.className = 'email-attachment-hint';
    attPill.title = `${message.attachments.length} attachment${message.attachments.length > 1 ? 's' : ''}`;
    attPill.appendChild(makeSvgIcon(ICONS.paperclip, 11));
    if (message.attachments.length > 1) {
      const cnt = document.createElement('span');
      cnt.textContent = message.attachments.length;
      attPill.appendChild(cnt);
    }
    row.appendChild(attPill);
  }

  const snippet = document.createElement('div');
  snippet.className = 'thread-sub-snippet';
  snippet.textContent = message.snippet || '';

  const actions = document.createElement('div');
  actions.className = 'email-actions';
  actions.append(
    makeIconBtn('reply', 'Reply', () => openReply(account, message)),
    makeStarBtn(
      account.id,
      message.id,
      (message.labelIds || []).includes('STARRED'),
      performAction,
    ),
    makeMarkReadToggleBtn(account.id, message.id, dimmedMessages.has(message.id), {
      onAction: performAction,
    }),
    makeIconBtn('archive', 'Archive', () => performAction(account.id, message.id, 'archive')),
    makeIconBtn('spam', 'Spam', () => performAction(account.id, message.id, 'spam'), {
      danger: true,
    }),
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
    openDetail(account, message, threadMessages);
  });

  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (state.selectionMode) {
        li._checkbox?.click();
      } else {
        openDetail(account, message, threadMessages);
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
  li.dataset.accountId = account.id;
  li.dataset.threadId = threadId;

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
    const subItem = renderThreadSubItem(account, msg, messages);
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

  rowRight.append(time, countPill);

  const totalAttachments = messages.reduce((n, m) => n + (m.attachments?.length || 0), 0);
  if (totalAttachments > 0) {
    const attPill = document.createElement('span');
    attPill.className = 'email-attachment-hint';
    attPill.title = `${totalAttachments} attachment${totalAttachments > 1 ? 's' : ''} in thread`;
    attPill.appendChild(makeSvgIcon(ICONS.paperclip, 11));
    if (totalAttachments > 1) {
      const cnt = document.createElement('span');
      cnt.textContent = totalAttachments;
      attPill.appendChild(cnt);
    }
    rowRight.appendChild(attPill);
  }

  row.append(senders, rowRight);

  const subject = document.createElement('div');
  subject.className = 'email-subject';
  subject.textContent = latest.subject || '(no subject)';

  const snippet = document.createElement('div');
  snippet.className = 'email-snippet';
  snippet.textContent = latest.snippet || '';

  const isThreadStarred = messages.some((m) => (m.labelIds || []).includes('STARRED'));

  const actions = document.createElement('div');
  actions.className = 'email-actions';
  actions.append(
    makeIconBtn('reply', 'Reply', () => openReply(account, latest)),
    makeStarBtn(account.id, latest.id, isThreadStarred, performAction),
    makeIconBtn('markRead', 'Mark all as read', () =>
      performThreadAction(account.id, threadId, 'markRead'),
    ),
    makeIconBtn('archive', 'Archive thread', () =>
      performThreadAction(account.id, threadId, 'archive'),
    ),
    makeIconBtn('spam', 'Spam', () => performThreadAction(account.id, threadId, 'spam'), {
      danger: true,
    }),
    makeIconBtn(
      'trash',
      'Delete thread',
      () => performThreadAction(account.id, threadId, 'trash'),
      { danger: true },
    ),
    makeIconBtn('open', 'Open thread in Gmail™', () => {
      performThreadAction(account.id, threadId, 'markRead').catch(() => {});
      api.tabs.create({
        url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(account.email)}#inbox/${threadId}`,
      });
      window.close();
    }),
  );

  li.append(row, subject, snippet, actions, subList);

  function toggleExpand() {
    if (subList.hidden) {
      state.expandedThreads.add(threadId);
      subList.hidden = false;
    } else {
      state.expandedThreads.delete(threadId);
      subList.hidden = true;
    }
    persistExpandedThreads();
  }

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
    toggleExpand();
  });

  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (state.selectionMode) {
        li._checkbox?.click();
      } else {
        toggleExpand();
      }
    }
  });

  return li;
}

export function renderEmailItem(account, message) {
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

  const snip = document.createElement('div');
  snip.className = 'email-snippet';
  snip.textContent = message.snippet || '';

  const actions = document.createElement('div');
  actions.className = 'email-actions';
  const markReadBtn = makeMarkReadToggleBtn(
    account.id,
    message.id,
    dimmedMessages.has(message.id),
    {
      onAction: performAction,
    },
  );
  li.setRead = (val) => markReadBtn.setRead(val);
  actions.append(
    makeIconBtn('reply', 'Reply', () => openReply(account, message)),
    makeStarBtn(
      account.id,
      message.id,
      (message.labelIds || []).includes('STARRED'),
      performAction,
    ),
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

  li.append(row, subject, snip, actions);
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

export function renderTabs() {
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
      state.expandedThreads.clear();
      persistExpandedThreads();
      renderTabs();
      renderList();
      updateGmailBtn();
      updateMarkAllBtn();
      updateSelectBtn();
    });
    els.tabs.appendChild(tab);
  }
}

export function updateGmailBtn() {
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

export function updateMarkAllBtn() {
  const account = getActiveAccount();
  const hasMessages = (account?.messages?.length || 0) > 0;
  els.markAllBtn.hidden = !hasMessages;
}

export function updateSelectBtn() {
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

export function updateBulkBar() {
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

export function toggleSelectMode() {
  state.selectionMode = !state.selectionMode;
  if (!state.selectionMode) {
    state.selectedMessages.clear();
  }
  els.selectBtn.classList.toggle('active', state.selectionMode);
  updateBulkBar();
  renderList();
}

export function renderPagination(total, page, totalPages) {
  if (totalPages <= 1) {
    els.pagination.hidden = true;
    return;
  }
  els.pagination.hidden = false;
  els.paginationPrev.disabled = page === 0;
  els.paginationNext.disabled = page >= totalPages - 1;
  els.paginationInfo.textContent = `${page + 1} / ${totalPages}`;
}

export function renderList() {
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
  const threads = getThreads(messages);
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
