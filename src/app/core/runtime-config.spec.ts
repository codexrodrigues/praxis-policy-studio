import { validateRuntimeConfig } from './runtime-config';
import { describe, expect, it } from 'vitest';

describe('validateRuntimeConfig', () => {
  it('accepts the hermetic fixture mode without an endpoint', () => {
    expect(validateRuntimeConfig({ mode: 'fixture', configApiBaseUrl: null, locale: 'pt-BR' }))
      .toEqual({ mode: 'fixture', configApiBaseUrl: null, locale: 'pt-BR' });
  });

  it('fails closed when remote mode has no endpoint', () => {
    expect(() => validateRuntimeConfig({ mode: 'remote', configApiBaseUrl: null, locale: 'pt-BR' }))
      .toThrowError('SETUP_REMOTE_ENDPOINT_REQUIRED');
  });
});
