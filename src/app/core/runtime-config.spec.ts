import { normalizeTrustedConfigApiBaseUrl, validateRuntimeConfig } from './runtime-config';
import { describe, expect, it } from 'vitest';

describe('validateRuntimeConfig', () => {
  it('accepts the hermetic fixture mode without an endpoint', () => {
    expect(validateRuntimeConfig({
      mode: 'fixture', configApiBaseUrl: null, locale: 'pt-BR',
      projectionPath: '/projections/quickstart-benefit-eligibility.v1.json'
    })).toEqual({
      mode: 'fixture', configApiBaseUrl: null, locale: 'pt-BR',
      projectionPath: '/projections/quickstart-benefit-eligibility.v1.json', initialDecisionKey: null
    });
  });

  it('fails closed when remote mode has no endpoint', () => {
    expect(() => validateRuntimeConfig({
      mode: 'remote', configApiBaseUrl: null, locale: 'pt-BR',
      projectionPath: '/projections/quickstart-benefit-eligibility.v1.json'
    }))
      .toThrowError('SETUP_REMOTE_ENDPOINT_REQUIRED');
  });

  it('allows remote catalog navigation without a static projection', () => {
    expect(validateRuntimeConfig({
      mode: 'remote', configApiBaseUrl: '', locale: 'pt-BR', initialDecisionKey: null
    }).projectionPath).toBeNull();
  });

  it('rejects a projection outside the versioned local catalog', () => {
    expect(() => validateRuntimeConfig({
      mode: 'fixture', configApiBaseUrl: null, locale: 'pt-BR', projectionPath: 'https://example.invalid/policy.json'
    })).toThrowError('SETUP_PROJECTION_PATH_REQUIRED');
  });

  it('normalizes trusted loopback and host-profile apiBaseUrl values while failing closed on untrusted origins', () => {
    expect(normalizeTrustedConfigApiBaseUrl('')).toBe('');
    expect(normalizeTrustedConfigApiBaseUrl('http://127.0.0.1:8080/api/')).toBe('http://127.0.0.1:8080');
    expect(normalizeTrustedConfigApiBaseUrl('http://localhost:8088')).toBe('http://localhost:8088');
    expect(normalizeTrustedConfigApiBaseUrl('https://evil.example.invalid/api')).toBeNull();
    expect(normalizeTrustedConfigApiBaseUrl('javascript:alert(1)')).toBeNull();
  });

  it('accepts distinct HTTPS deployment profiles with an explicit matching default', () => {
    const main = { id: 'primary', labelPtBr: 'Padrão', labelEnUs: 'Default', apiBaseUrl: 'https://primary.example' };
    const other = { ...main, id: 'other', apiBaseUrl: 'https://other.example' };
    const config = { mode: 'remote', configApiBaseUrl: main.apiBaseUrl, locale: 'pt-BR', hostProfiles: [main, other] };
    expect(validateRuntimeConfig(config).hostProfiles).toEqual([main, other]);
    for (const hostProfiles of [[], [other], [main, main], [main, { ...other, apiBaseUrl: main.apiBaseUrl }],
      [main, { ...other, labelEnUs: '' }], ...[
        'http://other.example', 'https://u:p@other.example', 'https://other.example/path', 'https://other.example?site=1',
        'https://other.example#fragment', 'https://*.example', 'https://other.example/'
      ].map(apiBaseUrl => [main, { ...other, apiBaseUrl }])]) {
      expect(() => validateRuntimeConfig({ ...config, hostProfiles })).toThrow('SETUP_INVALID_HOST_PROFILES');
    }
  });
});
