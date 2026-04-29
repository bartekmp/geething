export { CLIENT_ID, CLIENT_SECRET } from './credentials.js';

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
];

export const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
export const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';
export const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

export const STORAGE_KEYS = Object.freeze({
  ACCOUNTS: 'accounts',
  TOKENS: 'tokens',
  SETTINGS: 'settings',
  UNREAD_CACHE: 'unreadCache',
  SEEN_MESSAGES: 'seenMessages',
  ACCOUNT_STATE: 'accountState',
});

export const ALARM_NAMES = Object.freeze({
  POLL: 'geething.poll',
});

export const DEFAULT_SETTINGS = Object.freeze({
  pollIntervalMinutes: 2,
  notificationsEnabled: true,
  notificationContentMode: 'title-snippet', // 'title' | 'title-snippet'
  theme: 'auto', // 'auto' | 'light' | 'dark'
  maxMessagesPerAccount: 20,
  autoMarkReadOnOpen: true,
  popupWidth: 560,
  popupHeight: 600,
});

export const ACCOUNT_COLORS = Object.freeze([
  '#4f8cff',
  '#ff7a59',
  '#47c7a1',
  '#c57bff',
  '#f4c25e',
  '#ff6b9d',
  '#6bd0ff',
  '#aad16a',
]);

export const MAX_BADGE_DISPLAY = 99;

// Hard limits — not user-configurable.
export const MAX_FETCH_MESSAGES = 100;
export const MAX_EMAIL_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
