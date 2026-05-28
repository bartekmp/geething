import { els, state } from './state.js';

// Injected by popup.js via initSearchUi() to avoid circular dependencies.
let _renderList;

export function initSearchUi({ renderList }) {
  _renderList = renderList;
}

// Clears the query and collapses the bar without re-rendering. Callers that
// render on their own (e.g. the tab-switch handler) use this directly; the
// interactive close path uses closeSearch() which also re-renders.
export function resetSearch() {
  state.searchQuery = '';
  els.searchInput.value = '';
  els.searchBar.hidden = true;
  els.searchBtn.classList.remove('active');
  els.searchBtn.setAttribute('aria-expanded', 'false');
}

export function closeSearch() {
  resetSearch();
  _renderList();
}

export function openSearch() {
  els.searchBar.hidden = false;
  els.searchBtn.classList.add('active');
  els.searchBtn.setAttribute('aria-expanded', 'true');
  els.searchInput.focus();
}

// Shows the search button only when the active account has cached messages.
// Mirrors updateSelectBtn / updateMarkAllBtn gating. Closes an open bar if the
// active inbox no longer has any messages to search.
export function updateSearchBtn() {
  const account = state.accounts.find((a) => a.id === state.activeAccountId) || null;
  const hasMessages = (account?.messages?.length || 0) > 0;
  els.searchBtn.hidden = !hasMessages;
  if (!hasMessages && !els.searchBar.hidden) {
    closeSearch();
  }
}

export function registerSearchListeners() {
  els.searchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (els.searchBar.hidden) {
      openSearch();
    } else {
      closeSearch();
    }
  });

  els.searchInput.addEventListener('input', () => {
    state.searchQuery = els.searchInput.value;
    _renderList();
  });

  els.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
      els.searchBtn.focus();
    }
  });

  els.searchClearBtn.addEventListener('click', () => {
    closeSearch();
    els.searchBtn.focus();
  });
}
