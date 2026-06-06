import { vi } from 'vitest';

(globalThis as { __DEV__?: boolean }).__DEV__ = true;
process.env.EXPO_OS = 'ios';

class MockEventEmitter {
  addListener = vi.fn(() => ({ remove: vi.fn() }));
  removeListener = vi.fn();
  emit = vi.fn();
}

(globalThis as { expo?: { EventEmitter: typeof MockEventEmitter } }).expo = {
  EventEmitter: MockEventEmitter,
};

const asyncStorage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: vi.fn(async (key: string, value: string) => {
      asyncStorage.set(key, value);
    }),
    getItem: vi.fn(async (key: string) => asyncStorage.get(key) ?? null),
    removeItem: vi.fn(async (key: string) => {
      asyncStorage.delete(key);
    }),
    clear: vi.fn(async () => {
      asyncStorage.clear();
    }),
    getAllKeys: vi.fn(async () => [...asyncStorage.keys()]),
    multiGet: vi.fn(),
    multiSet: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  TurboModuleRegistry: {
    get: vi.fn(),
    getEnforcing: vi.fn(),
  },
  Share: {
    share: vi.fn(async () => ({ action: 'sharedAction' })),
  },
}));

vi.mock('expo-clipboard', () => ({
  setStringAsync: vi.fn(async () => undefined),
  getStringAsync: vi.fn(async () => 'clipboard-value'),
}));

vi.mock('expo-constants', () => ({
  default: { isDevice: true },
}));

vi.mock('expo-linking', () => ({
  canOpenURL: vi.fn(async () => true),
  openURL: vi.fn(async () => undefined),
}));

vi.mock('expo-device', () => {
  const device = {
    modelName: 'Test Device',
    osVersion: '17.0',
    totalMemory: 8 * 1024 * 1024 * 1024,
  };
  return { __esModule: true, ...device, default: device };
});

vi.mock('expo-modules-core', () => ({
  requireNativeModule: vi.fn(() => ({
    verifyFileSha256: vi.fn(async () => ({ ok: true })),
    addListener: vi.fn(() => ({ remove: vi.fn() })),
  })),
  requireNativeViewManager: vi.fn(() => () => null),
  EventEmitter: MockEventEmitter,
}));

vi.mock('expo-file-system', () => {
  const files = new Map<string, { exists: boolean; size: number; content: Uint8Array }>();

  class MockHandle {
    offset = 0;
    constructor(
      readonly size: number,
      private readonly content: Uint8Array,
    ) {}

    readBytes(n: number): Uint8Array {
      const slice = this.content.subarray(this.offset, this.offset + n);
      this.offset += slice.length;
      return slice;
    }

    close(): void {}
  }

  class File {
    uri: string;
    exists = false;
    size = 0;
    private content = new Uint8Array(0);

    constructor(_dir: unknown, name: string) {
      this.uri = `file:///mock/${name}`;
      const stored = files.get(this.uri);
      if (stored) {
        this.exists = stored.exists;
        this.size = stored.size;
        this.content = stored.content;
      }
    }

    open(_mode: unknown) {
      const stored = files.get(this.uri);
      if (stored) {
        this.exists = stored.exists;
        this.size = stored.size;
        this.content = stored.content;
      }
      return new MockHandle(this.size, this.content);
    }

    delete() {
      this.exists = false;
      this.size = 0;
      files.delete(this.uri);
    }

    static seed(uri: string, content: Uint8Array) {
      files.set(uri, { exists: true, size: content.length, content });
    }
  }

  class Directory {
    exists = true;
    uri = 'file:///mock/dir';
    create(): void {}
  }

  return {
    File,
    Directory,
    FileMode: { ReadOnly: 'r' },
    Paths: { document: 'doc', cache: 'cache' },
    __resetFiles: () => files.clear(),
    __seedFile: (uri: string, content: Uint8Array) => File.seed(uri, content),
    __clearAsyncStorage: () => asyncStorage.clear(),
  };
});
