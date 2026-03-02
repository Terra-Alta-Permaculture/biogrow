import '@testing-library/jest-dom/vitest';

// Mock localStorage
const store = {};
const localStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock matchMedia
Object.defineProperty(globalThis, 'matchMedia', {
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock crypto.subtle.digest (SHA-256)
if (!globalThis.crypto?.subtle) {
  const { createHash } = await import('node:crypto');
  globalThis.crypto = {
    ...globalThis.crypto,
    subtle: {
      digest: async (algo, data) => {
        const name = algo === 'SHA-256' ? 'sha256' : algo.toLowerCase().replace('-', '');
        const buf = Buffer.from(data);
        const hash = createHash(name).update(buf).digest();
        return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
      },
    },
  };
}

// Mock indexedDB (no-op)
globalThis.indexedDB = {
  open: () => {
    const req = { result: null, error: null };
    setTimeout(() => req.onerror?.());
    return req;
  },
};

// Clean localStorage between tests
afterEach(() => {
  localStorageMock.clear();
});
