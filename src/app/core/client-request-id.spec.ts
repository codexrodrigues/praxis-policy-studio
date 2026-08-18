import { describe, expect, it, vi } from 'vitest';
import { createClientRequestId } from './client-request-id';

describe('createClientRequestId', () => {
  it('uses the native browser UUID when available', () => {
    const native = '5cab5513-ab17-4df0-9550-41d16d8b2129';
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(native);
    expect(createClientRequestId()).toBe(native);
    vi.restoreAllMocks();
  });

  it('creates a v4 UUID with getRandomValues when randomUUID is unavailable', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(undefined as never);
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(array => {
      (array as Uint8Array).fill(0xab);
      return array;
    });

    expect(createClientRequestId()).toBe('abababab-abab-4bab-abab-abababababab');
    vi.restoreAllMocks();
  });
});
