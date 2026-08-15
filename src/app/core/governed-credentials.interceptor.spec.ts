import '@angular/compiler';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { governedCredentialsInterceptor } from './governed-credentials.interceptor';

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
});
