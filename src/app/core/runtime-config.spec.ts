import { validateRuntimeConfig } from './runtime-config';
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

  it('rejects a projection outside the versioned local catalog', () => {
    expect(() => validateRuntimeConfig({
      mode: 'fixture', configApiBaseUrl: null, locale: 'pt-BR', projectionPath: 'https://example.invalid/policy.json'
    })).toThrowError('SETUP_PROJECTION_PATH_REQUIRED');
  });
});
