import '@angular/compiler';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthSessionService } from './auth-session.service';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthSessionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http?.verify();
    TestBed.resetTestingModule();
  });

  it('creates the canonical remote cookie session', () => {
    service.login('admin', 'temporary-secret', {
      mode: 'remote', configApiBaseUrl: 'http://127.0.0.1:8088', locale: 'pt-BR',
      projectionPath: '/projections/quickstart-benefit-eligibility.v1.json', initialDecisionKey: null
    }).subscribe();
    const request = http.expectOne('http://127.0.0.1:8088/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({ username: 'admin', password: 'temporary-secret' });
    request.flush(null);
  });

  it('rejects login from the hermetic fixture', () => {
    expect(() => service.login('admin', 'temporary-secret', {
      mode: 'fixture', configApiBaseUrl: null, locale: 'pt-BR',
      projectionPath: '/projections/quickstart-benefit-eligibility.v1.json', initialDecisionKey: null
    })).toThrowError('AUTH_REMOTE_CONFIG_REQUIRED');
  });

  it('distinguishes a missing session from an authenticated principal', () => {
    const config = {
      mode: 'remote' as const, configApiBaseUrl: 'http://127.0.0.1:8088', locale: 'pt-BR' as const,
      projectionPath: '/projections/quickstart-benefit-eligibility.v1.json', initialDecisionKey: null
    };
    let active = false;
    service.hasSession(config).subscribe(value => active = value);
    const activeRequest = http.expectOne('http://127.0.0.1:8088/auth/session');
    expect(activeRequest.request.withCredentials).toBe(true);
    activeRequest.flush(null);
    expect(active).toBe(true);

    let missing = true;
    service.hasSession(config).subscribe(value => missing = value);
    http.expectOne('http://127.0.0.1:8088/auth/session')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(missing).toBe(false);
  });
});
