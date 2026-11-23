import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { StudioCapabilitiesService } from './studio-capabilities.service';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('StudioCapabilitiesService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('allows public/default modules and checks required server capabilities fail-closed', () => {
    const service = TestBed.inject(StudioCapabilitiesService);

    expect(service.serverCapabilities()).toBeNull();
    expect(service.isModuleVisible({ requiredCapability: undefined })).toBe(true);
    expect(service.isModuleVisible({ requiredCapability: 'RULES_MONITORING_VIEW' })).toBe(false);

    service.applyServerCapabilities(['RULES_CATALOG_READ', 'RULES_MONITORING_VIEW']);
    expect(service.isModuleVisible({ requiredCapability: 'RULES_MONITORING_VIEW' })).toBe(true);
    expect(service.isModuleVisible({ requiredCapability: 'SURFACES_ADMIN' })).toBe(false);

    service.reset();
    expect(service.serverCapabilities()).toBeNull();
    expect(service.isModuleVisible({ requiredCapability: 'RULES_MONITORING_VIEW' })).toBe(false);
  });
});
