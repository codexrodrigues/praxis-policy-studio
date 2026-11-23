import '@angular/compiler';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeTrustedConfigApiBaseUrl, validateRuntimeConfig } from './runtime-config';
import { RuntimeConfigService } from './runtime-config.service';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

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

describe('RuntimeConfigService host switching', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('selectHostProfile preserves allowlisted semantic deep-link params and clears host scope params', async () => {
    const primary = { id: 'primary', labelPtBr: 'Primário', labelEnUs: 'Primary', apiBaseUrl: 'https://primary.example' };
    const secondary = { id: 'secondary', labelPtBr: 'Secundário', labelEnUs: 'Secondary', apiBaseUrl: 'https://other.example' };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const runtime = TestBed.inject(RuntimeConfigService);
    const http = TestBed.inject(HttpTestingController);

    const loadPromise = runtime.load();
    http.expectOne('/app-config.json').flush({
      mode: 'remote',
      configApiBaseUrl: 'https://primary.example',
      locale: 'pt-BR',
      hostProfiles: [primary, secondary]
    });
    await loadPromise;

    const assign = vi.fn();
    vi.stubGlobal('location', {
      origin: 'http://127.0.0.1:4302',
      pathname: '/catalog',
      search: '?resourceKey=workforce.leave&ruleSetKey=workforce.leave.rules&slotKey=limit&decisionKey=d1&bindingKey=b1&operationKey=CREATE&tenantId=rio&organizationId=ALL&environment=local',
      assign
    });

    runtime.selectHostProfile('secondary');

    expect(assign).toHaveBeenCalledOnce();
    const targetUrl = new URL(assign.mock.calls[0][0] as string);
    expect(targetUrl.pathname).toBe('/catalog');
    expect(targetUrl.searchParams.get('apiBaseUrl')).toBe('https://other.example');
    expect(targetUrl.searchParams.get('resourceKey')).toBe('workforce.leave');
    expect(targetUrl.searchParams.get('ruleSetKey')).toBe('workforce.leave.rules');
    expect(targetUrl.searchParams.get('slotKey')).toBe('limit');
    expect(targetUrl.searchParams.get('decisionKey')).toBe('d1');
    expect(targetUrl.searchParams.get('bindingKey')).toBe('b1');
    expect(targetUrl.searchParams.get('operationKey')).toBe('CREATE');
    expect(targetUrl.searchParams.has('tenantId')).toBe(false);
    expect(targetUrl.searchParams.has('organizationId')).toBe(false);
    expect(targetUrl.searchParams.has('environment')).toBe(false);
  });
});
