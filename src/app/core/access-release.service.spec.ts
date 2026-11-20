import '@angular/compiler';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { API_URL } from '@praxisui/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessReleaseService } from './access-release.service';
import { governedCredentialsInterceptor } from './governed-credentials.interceptor';
import { RuntimeConfigService } from './runtime-config.service';
import type { PolicyStudioRuntimeConfig } from './runtime-config';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const config: PolicyStudioRuntimeConfig = {
  configApiBaseUrl: '', mode: 'remote', locale: 'pt-BR', projectionPath: null, initialDecisionKey: null
};
const releaseId = '527830ce-72c5-4af2-a1c5-2e404f29b1cd';
const definitionId = '238bedd2-bf1a-4e67-a505-2758aca46277';
const path = '/api/praxis/config/domain-rules/authorization/releases';
const head = { runtimeRevision: 'r2', instanceId: 'opa', activationRevision: 2, headEtag: 'etag2',
  policySetDigest: 'set', bundleArtifactDigest: 'bundle', compilerProfileVersion: 'v1', opaCapabilitiesDigest: 'cap' };
const response = { releaseId, definitionId, definitionHash: 'hash', current: true, state: 'active', expectedHead: head, observedHead: head };

describe('AccessReleaseService', () => {
  let api: AccessReleaseService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([governedCredentialsInterceptor])),
      { provide: RuntimeConfigService, useValue: { state: () => ({ kind: 'ready', config }) } },
      provideHttpClientTesting(), { provide: API_URL, useValue: { default: { baseUrl: '' } } }] });
    api = TestBed.inject(AccessReleaseService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); });

  it.each([
    { ...response, releaseId: definitionId },
    { ...response, observedHead: null },
    { ...response, observedHead: { ...head, instanceId: 'other' } },
    { ...response, observedHead: { ...head, headEtag: 'other' } },
    { ...response, state: 'reverted', observedHead: { ...head, activationRevision: 3 } }
  ])('rejects a mismatched release or unconfirmed terminal head', body => {
    const next = vi.fn();
    const error = vi.fn();
    api.get(config, releaseId).subscribe({ next, error });
    http.expectOne(path + '/' + releaseId).flush(body);
    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });

  it('requires an active host session before issuing a command', () => {
    const error = vi.fn();
    api.publish(config, definitionId).subscribe({ error });
    http.expectOne('/auth/session').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectNone(path);
    expect(error.mock.calls[0][0].status).toBe(401);
  });

  it('rejects a published receipt for another definition', () => {
    const error = vi.fn();
    api.publish(config, definitionId).subscribe({ error });
    http.expectOne('/auth/session').flush(null, { status: 204, statusText: 'No Content', headers: { 'X-XSRF-TOKEN': 'session-token' } });
    const post = http.expectOne(path);
    expect(post.request.headers.get('X-XSRF-TOKEN')).toBe('session-token');
    post.flush({ ...response, definitionId: releaseId });
    expect(error).toHaveBeenCalledOnce();
  });
});
