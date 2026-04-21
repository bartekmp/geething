/**
 * Starts Firefox with the extension loaded and pre-seeded fake accounts/emails.
 * Usage: npm run seed
 *
 * Creates src/dev-mode.json before launching web-ext so the service worker
 * injects 2 fake accounts (7 emails total) on startup. Removes the file on exit.
 */
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEV_MODE_FILE = resolve(__dirname, '../src/dev-mode.json');

const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

writeFileSync(DEV_MODE_FILE, JSON.stringify({ seed: true, createdAt: Date.now() }), 'utf8');
console.log(cyan('[seed-dev]'), 'dev-mode.json written — fake data will be injected on startup.');
console.log(yellow('[seed-dev]'), 'Popup shows 2 accounts (Personal + Work, 7 fake emails). Take your screenshot!');
console.log(cyan('[seed-dev]'), 'Press Ctrl+C to stop and clean up.\n');

const child = spawn(
  'npx',
  ['web-ext', 'run', '--source-dir=src'],
  { stdio: 'inherit', shell: true },
);

function cleanup() {
  if (existsSync(DEV_MODE_FILE)) {
    unlinkSync(DEV_MODE_FILE);
    console.log('\n' + cyan('[seed-dev]'), 'Removed dev-mode.json.');
  }
}

child.on('exit', () => {
  cleanup();
  process.exit();
});

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
