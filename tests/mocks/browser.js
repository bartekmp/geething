import { vi } from 'vitest';

function createStorageArea() {
  let store = {};
  return {
    _store: () => store,
    _reset: () => {
      store = {};
    },
    get: vi.fn(async (keys) => {
      if (!keys) {
        return { ...store };
      }
      if (typeof keys === 'string') {
        return { [keys]: store[keys] };
      }
      if (Array.isArray(keys)) {
        const out = {};
        for (const k of keys) {
          out[k] = store[k];
        }
        return out;
      }
      const out = {};
      for (const [k, defaultValue] of Object.entries(keys)) {
        out[k] = store[k] === undefined ? defaultValue : store[k];
      }
      return out;
    }),
    set: vi.fn(async (items) => {
      store = { ...store, ...items };
    }),
    remove: vi.fn(async (keys) => {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) {
        delete store[k];
      }
    }),
    clear: vi.fn(async () => {
      store = {};
    }),
  };
}

export function createMockBrowser() {
  const local = createStorageArea();
  const sync = createStorageArea();

  return {
    storage: {
      local,
      sync,
      onChanged: { addListener: vi.fn() },
    },
    runtime: {
      getManifest: vi.fn(() => ({ version: '0.1.0' })),
      getURL: vi.fn((path) => `moz-extension://test/${path}`),
      sendMessage: vi.fn(),
      openOptionsPage: vi.fn(),
      onMessage: { addListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
      lastError: null,
    },
    identity: {
      getRedirectURL: vi.fn(() => 'https://test-ext.extensions.allizom.org/'),
      launchWebAuthFlow: vi.fn(),
    },
    notifications: {
      create: vi.fn(async () => 'notif-id'),
      clear: vi.fn(async () => true),
      onClicked: { addListener: vi.fn() },
    },
    alarms: {
      create: vi.fn(),
      clear: vi.fn(async () => true),
      onAlarm: { addListener: vi.fn() },
    },
    action: {
      setBadgeText: vi.fn(async () => {}),
      setBadgeBackgroundColor: vi.fn(async () => {}),
      setBadgeTextColor: vi.fn(async () => {}),
    },
    tabs: {
      create: vi.fn(async () => ({})),
      remove: vi.fn(async () => {}),
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    windows: {
      create: vi.fn(async () => ({ id: 1, tabs: [{ id: 10 }] })),
      remove: vi.fn(async () => {}),
      onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    contextMenus: {
      create: vi.fn(),
      removeAll: vi.fn(async () => {}),
      onClicked: { addListener: vi.fn() },
    },
  };
}

export function resetMockBrowser(browser) {
  browser.storage.local._reset();
  browser.storage.sync._reset();
  for (const area of ['local', 'sync']) {
    for (const method of ['get', 'set', 'remove', 'clear']) {
      browser.storage[area][method].mockClear();
    }
  }
  const clearables = [
    browser.runtime.sendMessage,
    browser.runtime.openOptionsPage,
    browser.notifications.create,
    browser.notifications.clear,
    browser.alarms.create,
    browser.alarms.clear,
    browser.action.setBadgeText,
    browser.action.setBadgeBackgroundColor,
    browser.action.setBadgeTextColor,
    browser.tabs.create,
    browser.tabs.remove,
    browser.windows.create,
    browser.windows.remove,
  ];
  for (const fn of clearables) {
    if (fn?.mockClear) {
      fn.mockClear();
    }
  }
  browser.runtime.lastError = null;
}
