import { afterEach, beforeEach, vi } from 'vitest';
import { createMockBrowser, resetMockBrowser } from './mocks/browser.js';

const mockBrowser = createMockBrowser();
globalThis.browser = mockBrowser;
globalThis.chrome = mockBrowser;

if (!globalThis.crypto) {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto;
}

if (!globalThis.fetch) {
  globalThis.fetch = vi.fn();
} else {
  globalThis.fetch = vi.fn(globalThis.fetch);
}

beforeEach(() => {
  resetMockBrowser(mockBrowser);
  if (globalThis.fetch && 'mockReset' in globalThis.fetch) {
    globalThis.fetch.mockReset();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

export { mockBrowser };
