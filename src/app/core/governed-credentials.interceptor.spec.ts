import '@angular/compiler';
import { HttpClient, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { governedCredentialsInterceptor } from './governed-credentials.interceptor';
import { RuntimeConfigService } from './runtime-config.service';
import { GovernedHostScopeService } from './governed-host-scope.service';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('governedCredentialsInterceptor', () => {
  let baseUrl: string;
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    baseUrl = document.location.origin;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([governedCredentialsInterceptor])),
        provideHttpClientTesting(),
        { provide: RuntimeConfigService, useValue: { state: () => ({ kind: 'ready', config: { mode: 'remote', configApiBaseUrl: baseUrl } }) } }
      ]
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
    TestBed.resetTestingModule();
  });

  for (const url of [
    '/auth/session',
    'https://quickstart.example/api/praxis/config/domain-rules/definitions',
    'https://quickstart.example/schemas/actions'
  ]) {
    it(`sends the HttpOnly session to governed URL ${url}`, () => {
      baseUrl = new URL(url, document.baseURI).origin;
      http.get(url).subscribe();
      const request = controller.expectOne(url);
      expect(request.request.withCredentials).toBe(true);
      request.flush({});
    });
  }

  for (const url of [
    '/app-config.json',
    '/projections/quickstart-benefit-eligibility.v1.json',
    'https://unrelated.example/content'
  ]) {
    it(`does not attach ambient credentials to ${url}`, () => {
      http.get(url).subscribe();
      const request = controller.expectOne(url);
      expect(request.request.withCredentials).toBe(false);
      request.flush({});
    });
  }

  it('propagates realm/organization scope headers and captures in-memory X-XSRF-TOKEN for mutations', () => {
    baseUrl = 'http://localhost:8089';
    const scopeService = TestBed.inject(GovernedHostScopeService);
    scopeService.syncFromQueryString('?tenantId=df&organizationId=GROUP%3AGDF_CONSOLIDADO&environment=local');

    http.get('http://localhost:8089/auth/session').subscribe();
    const sessionReq = controller.expectOne('http://localhost:8089/auth/session');
    expect(sessionReq.request.withCredentials).toBe(true);
    expect(sessionReq.request.headers.get('X-Tenant-Realm')).toBe('df');
    expect(sessionReq.request.headers.get('X-Tenant-ID')).toBeNull();
    expect(sessionReq.request.headers.get('X-Organization-ID')).toBeNull();
    expect(sessionReq.request.headers.get('X-Env')).toBeNull();
    sessionReq.flush(null, { headers: new HttpHeaders({ 'X-XSRF-TOKEN': 'csrf-df-123' }) });

    http.post('http://localhost:8089/api/praxis/config/domain-rules/definitions', { ok: true }).subscribe();
    const mutationReq = controller.expectOne('http://localhost:8089/api/praxis/config/domain-rules/definitions');
    expect(mutationReq.request.withCredentials).toBe(true);
    expect(mutationReq.request.headers.get('X-Tenant-Realm')).toBe('df');
    expect(mutationReq.request.headers.get('X-Tenant-ID')).toBe('df');
    expect(mutationReq.request.headers.get('X-Organization-ID')).toBe('GROUP:GDF_CONSOLIDADO');
    expect(mutationReq.request.headers.get('X-XSRF-TOKEN')).toBe('csrf-df-123');
    mutationReq.flush({});
  });

  it('keeps legacy numeric scope on Config requests and removes caller-provided hints on session paths', () => {
    TestBed.inject(GovernedHostScopeService).syncFromQueryString('?tenantId=42&organizationId=7&environment=stage');
    const hints = { 'X-Tenant-ID': '42', 'X-Organization-ID': '7', 'X-Env': 'stage' };
    for (const [method, url] of [['GET', '/auth/session'], ['POST', '/auth/login'], ['POST', '/auth/logout']]) {
      http.request(method, url, { headers: hints }).subscribe();
      const pending = controller.expectOne(url);
      const { request } = pending;
      expect(request.withCredentials).toBe(true);
      expect(request.headers.has('X-Tenant-Realm')).toBe(false);
      for (const key of Object.keys(hints)) expect(request.headers.has(key)).toBe(false);
      pending.flush(null);
    }
    http.get('/api/praxis/config/domain-rules/authorization/catalog').subscribe();
    const catalog = controller.expectOne('/api/praxis/config/domain-rules/authorization/catalog');
    for (const [key, value] of Object.entries(hints)) expect(catalog.request.headers.get(key)).toBe(value);
    expect(catalog.request.headers.has('X-Tenant-Realm')).toBe(false);
    catalog.flush({});
  });

  it('blocks governed requests to another origin and isolates tokens by host and tenant', () => {
    const scope = TestBed.inject(GovernedHostScopeService);
    scope.rotateCsrfSession('https://quickstart.example', 'rio', 'qa-secret');
    scope.rotateCsrfSession('https://enterprise.example', 'other', 'other-tenant-secret');
    scope.syncFromQueryString('?tenantId=rio');
    baseUrl = 'https://enterprise.example';
    const alien = 'https://quickstart.example/auth/login';
    let failure: unknown;
    http.post(alien, {}, { withCredentials: true }).subscribe({ error: err => { failure = err; } });
    expect(failure).toMatchObject({ message: 'GOVERNED_HOST_MISMATCH' });
    controller.expectNone(alien);
    const target = baseUrl + '/api/praxis/config/domain-rules/definitions';
    http.post(target, {}).subscribe();
    const mutation = controller.expectOne(target);
    expect(mutation.request.withCredentials).toBe(true);
    expect(mutation.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    mutation.flush({});
  });

  it.each([null, 'anonymous-token'])('rotates CSRF across logout, anonymous challenge and login in one realm (%s)', challenge => {
    const scope = TestBed.inject(GovernedHostScopeService);
    scope.syncFromQueryString('?tenantId=rio');
    scope.rotateCsrfSession(baseUrl, 'rio', 'first-user-token');
    http.get('/api/older-request').subscribe();
    const delayed = controller.expectOne('/api/older-request');
    http.post('/auth/logout', {}).subscribe();
    const logout = controller.expectOne('/auth/logout');
    expect(logout.request.headers.get('X-XSRF-TOKEN')).toBe('first-user-token');
    logout.flush(null, { status: 204, statusText: 'No Content' });
    delayed.flush({}, { headers: { 'X-XSRF-TOKEN': 'first-user-token' } });
    expect(scope.csrfSession(baseUrl, 'rio').token).toBeNull();
    http.get('/auth/session').subscribe({ error: () => undefined });
    controller.expectOne('/auth/session').flush(null, {
      status: 401, statusText: 'Unauthorized', headers: challenge ? { 'X-XSRF-TOKEN': challenge } : {}
    });
    http.post('/auth/login', {}).subscribe();
    const login = controller.expectOne('/auth/login');
    expect(login.request.headers.get('X-XSRF-TOKEN')).toBe(challenge);
    login.flush(null);
    http.get('/auth/session').subscribe();
    controller.expectOne('/auth/session').flush(null, { headers: { 'X-XSRF-TOKEN': 'second-user-token' } });
    http.post('/api/mutation', {}).subscribe();
    const mutation = controller.expectOne('/api/mutation');
    expect(mutation.request.headers.get('X-XSRF-TOKEN')).toBe('second-user-token');
    mutation.flush({});
  });
});
