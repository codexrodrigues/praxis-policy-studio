import '@angular/compiler';
import { HttpClient, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { governedCredentialsInterceptor } from './governed-credentials.interceptor';
import { GovernedHostScopeService } from './governed-host-scope.service';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('governedCredentialsInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([governedCredentialsInterceptor])),
        provideHttpClientTesting()
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
    const scopeService = TestBed.inject(GovernedHostScopeService);
    scopeService.syncFromQueryString('?tenantId=df&organizationId=GROUP%3AGDF_CONSOLIDADO&environment=local');

    http.get('http://localhost:8089/auth/session').subscribe();
    const sessionReq = controller.expectOne('http://localhost:8089/auth/session');
    expect(sessionReq.request.withCredentials).toBe(true);
    expect(sessionReq.request.headers.get('X-Tenant-Realm')).toBe('df');
    expect(sessionReq.request.headers.get('X-Tenant-ID')).toBe('df');
    expect(sessionReq.request.headers.get('X-Organization-ID')).toBe('GROUP:GDF_CONSOLIDADO');
    expect(sessionReq.request.headers.get('X-Env')).toBe('local');
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
});
