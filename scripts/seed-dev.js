// Launches Firefox with a temporary dev overlay that seeds fake accounts and
// emails — without touching any production source files.
//
// What it does:
//   1. Copies src/ → .dev-src/ and patches the manifest to use a dev-only SW
//   2. Writes .dev-src/background/sw-dev.js (the dev service worker)
//   3. Watches src/ for changes and syncs them into .dev-src/
//   4. Runs web-ext against .dev-src/
//   5. Deletes .dev-src/ on exit

import { copyFileSync, cpSync, existsSync, readFileSync, rmSync, watch, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(__dirname, '../src');
const DEV_DIR = resolve(__dirname, '../.dev-src');

// ── Dev service worker ────────────────────────────────────────────────────
// Injected only into .dev-src/. Reads seed data from dev-seed.js (also
// copied there), handles geething.getState/refresh/getMessageDetail, and
// never touches the real Gmail API or OAuth.
const DEV_SW = `// DEV ONLY — lives only in .dev-src/, never part of the production build
import { getSettings, saveAccounts, savePersistedAccountState } from '../shared/storage.js';
import { ACCOUNTS, buildMessages } from './dev-seed.js';
import { updateBadge } from './badge.js';
import { showNewMailNotification } from './notifications.js';

const api = typeof browser !== 'undefined' ? browser : globalThis.chrome;
const accountState = new Map();
let refreshCount = 0;

async function seed() {
  const msgs = buildMessages();
  await saveAccounts(ACCOUNTS);
  const t = Date.now();
  for (const [id, messages] of Object.entries(msgs)) {
    accountState.set(id, { messages, unreadCount: messages.length, error: null, lastPolledAt: t });
  }
  await savePersistedAccountState(Object.fromEntries(accountState));
  const total = Array.from(accountState.values()).reduce((s, a) => s + a.unreadCount, 0);
  await updateBadge(total);
}

await seed();

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  Promise.resolve(handleMessage(msg))
    .then((result) => sendResponse({ ok: true, result }))
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
  return true;
});

async function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'geething.getState': {
      const settings = await getSettings();
      const accounts = ACCOUNTS.map((acc) => ({
        ...acc,
        ...(accountState.get(acc.id) || { unreadCount: 0, messages: [] }),
      }));
      return { accounts, settings };
    }
    case 'geething.refresh': {
      refreshCount++;
      const settings = await getSettings();
      const msgs = buildMessages();
      const accountEntries = Object.entries(msgs);
      const [accountId, messages] = accountEntries[refreshCount % accountEntries.length];
      const account = ACCOUNTS.find((a) => a.id === accountId) || ACCOUNTS[0];
      const message = messages[refreshCount % messages.length];
      if (!account.muted) {
        await showNewMailNotification(message, account, settings);
      }
      return { total: Array.from(accountState.values()).reduce((s, a) => s + a.unreadCount, 0) };
    }
    case 'geething.getMessageDetail': {
      for (const { messages } of accountState.values()) {
        const found = messages?.find((m) => m.id === msg.messageId);
        if (found) return { ...found, bodyText: found.snippet || '', bodyHtml: null };
      }
      throw new Error('Message not found');
    }
    case 'geething.action':
    case 'geething.markAllRead': {
      const acctState = accountState.get(msg.accountId);
      if (acctState?.messages) {
        const filtered = acctState.messages.filter((m) => m.id !== msg.messageId);
        accountState.set(msg.accountId, { ...acctState, messages: filtered, unreadCount: filtered.length });
        const total = Array.from(accountState.values()).reduce((s, a) => s + a.unreadCount, 0);
        await updateBadge(total);
      }
      return { ok: true };
    }
    default:
      return undefined;
  }
}
`;

// ── Build dev dir ─────────────────────────────────────────────────────────
function buildDevDir() {
  if (existsSync(DEV_DIR)) rmSync(DEV_DIR, { recursive: true, force: true });
  cpSync(SRC_DIR, DEV_DIR, { recursive: true });

  const manifest = JSON.parse(readFileSync(join(DEV_DIR, 'manifest.json'), 'utf8'));
  manifest.background.scripts = ['background/sw-dev.js'];
  writeFileSync(join(DEV_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  writeFileSync(join(DEV_DIR, 'background/sw-dev.js'), DEV_SW, 'utf8');
}

buildDevDir();

// ── Watch src/ → .dev-src/ ────────────────────────────────────────────────
const watcher = watch(SRC_DIR, { recursive: true }, (_event, filename) => {
  if (!filename) return;
  try {
    copyFileSync(join(SRC_DIR, filename), join(DEV_DIR, filename));
  } catch {
    // File deleted or temporarily locked — ignore
  }
});

// ── Launch Firefox ────────────────────────────────────────────────────────
const child = spawn('npx', ['web-ext', 'run', `--source-dir=${DEV_DIR}`, '--firefox=firefox'], {
  stdio: 'inherit',
  shell: true,
});

function cleanup() {
  watcher.close();
  if (existsSync(DEV_DIR)) rmSync(DEV_DIR, { recursive: true, force: true });
}

child.on('exit', () => {
  cleanup();
  process.exit();
});
process.on('SIGINT', () => {
  cleanup();
  process.exit();
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit();
});
