export const api = typeof browser !== 'undefined' ? browser : globalThis.chrome;

export const state = {
  accounts: [],
  settings: null,
  activeAccountId: null,
  pageByAccount: {},
  selectionMode: false,
  selectedMessages: new Set(),
  expandedThreads: new Set(),
  globalMute: null,
};

// Message IDs marked read in 'dim' mode — cleared on every loadState().
export const dimmedMessages = new Set();

export const els = {
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
  muteBtn: document.getElementById('mute-btn'),
  muteBtnWrapper: document.getElementById('mute-btn-wrapper'),
  muteDropdown: document.getElementById('mute-dropdown'),
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
