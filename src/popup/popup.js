import { applyTheme, watchSystemTheme } from '../shared/theme.js';
import {
  bulkAction,
  initActions,
  openInGmail,
  performAction,
  performThreadAction,
} from './actions.js';
import {
  getActiveAccount,
  getThreads,
  initList,
  renderList,
  renderTabs,
  toggleSelectMode,
  updateBulkBar,
  updateGmailBtn,
  updateMarkAllBtn,
  updateSelectBtn,
} from './list.js';
import { closeMuteDropdown, initMuteUi, registerMuteListeners, updateMuteBtn } from './mute-ui.js';
import { api, dimmedMessages, els, state } from './state.js';
import { sendMessage, setLoading, showError } from './utils.js';

// ── State management ───────────────────────────────────────────────────────

export async function loadState() {
  const [result, sessionData] = await Promise.all([
    sendMessage({ type: 'geething.getState' }),
    api.storage.session?.get('expandedThreads').catch(() => ({})) ?? {},
  ]);
  if (Array.isArray(sessionData?.expandedThreads)) {
    state.expandedThreads = new Set(sessionData.expandedThreads);
  }
  state.accounts = result.accounts || [];
  state.settings = result.settings || {};
  state.globalMute = result.globalMute || null;
  dimmedMessages.clear();
  if (!state.activeAccountId || !state.accounts.find((a) => a.id === state.activeAccountId)) {
    state.activeAccountId = state.accounts[0]?.id || null;
  }
  const width = state.settings.popupWidth || 560;
  document.documentElement.style.setProperty('--popup-width', `${width}px`);
  const height = state.settings.popupHeight || 600;
  document.documentElement.style.setProperty('--popup-height', `${height}px`);
  try {
    localStorage.setItem('popupWidth', width);
    localStorage.setItem('popupHeight', height);
  } catch {}
  applyTheme(state.settings.theme || 'auto');
  renderTabs();
  renderList();
  updateGmailBtn();
  updateMarkAllBtn();
  updateSelectBtn();
  updateMuteBtn();
  els.addBtn.hidden = state.accounts.length > 0;
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

// Wire up cross-module dependencies that cannot be resolved at import time.
initActions({ refresh, loadState });
initMuteUi({ loadState });
initList({ loadState });
registerMuteListeners();

// ── Detail back button ─────────────────────────────────────────────────────
els.backBtn.addEventListener('click', () => {
  els.detail.hidden = true;
});

// ── Pagination ─────────────────────────────────────────────────────────────
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
  const threads = getThreads(messages);
  const perPage = state.settings?.maxMessagesPerAccount || 20;
  const totalPages = Math.ceil(threads.length / perPage);
  state.pageByAccount[account.id] = Math.min(
    totalPages - 1,
    (state.pageByAccount[account.id] || 0) + 1,
  );
  renderList();
  els.list.scrollTop = 0;
});

// ── Topbar ─────────────────────────────────────────────────────────────────
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

  if (!els.muteDropdown.hidden) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMuteDropdown();
      els.muteBtn.focus();
    }
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
        const cb = items[current]._checkbox;
        if (cb) {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change'));
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
      const { accountId, messageId, threadId } = items[current].dataset;
      if (accountId && messageId) {
        performAction(accountId, messageId, 'markRead');
      } else if (accountId && threadId) {
        performThreadAction(accountId, threadId, 'markRead');
      }
      break;
    }
    case 'a': {
      if (current < 0) {
        break;
      }
      const { accountId, messageId, threadId } = items[current].dataset;
      if (accountId && messageId) {
        performAction(accountId, messageId, 'archive');
      } else if (accountId && threadId) {
        performThreadAction(accountId, threadId, 'archive');
      }
      break;
    }
    case 'o': {
      if (current < 0) {
        break;
      }
      const { accountId, messageId, threadId } = items[current].dataset;
      const account = state.accounts.find((acc) => acc.id === accountId);
      if (account && messageId) {
        openInGmail(account, messageId);
      } else if (account && threadId) {
        performThreadAction(accountId, threadId, 'markRead').catch(() => {});
        const url = `https://mail.google.com/mail/?authuser=${encodeURIComponent(account.email)}#inbox/${threadId}`;
        api.tabs.create({ url });
        window.close();
      }
      break;
    }
  }
});

// ── Live refresh while popup is open ──────────────────────────────────────
const LIVE_POLL_MS = 30_000;
let livePollHandle = null;

function startLivePoll() {
  if (livePollHandle) {
    return;
  }
  livePollHandle = setInterval(() => loadState(), LIVE_POLL_MS);
}

function stopLivePoll() {
  clearInterval(livePollHandle);
  livePollHandle = null;
}

// Message from background after each poll cycle or mute state change.
api.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'geething.newMail' || msg?.type === 'geething.muteChanged') {
    loadState();
  }
});

window.addEventListener('unload', stopLivePoll);

watchSystemTheme(() => {
  if (state.settings?.theme === 'auto') {
    applyTheme('auto');
  }
});

// ── Boot ───────────────────────────────────────────────────────────────────
(async () => {
  await loadState();
  startLivePoll();
})().catch((err) => showError(err.message || String(err)));
