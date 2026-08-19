import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { describe, expect, it } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import { PolicySandboxResultsComponent } from './policy-sandbox-results.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('PolicySandboxResultsComponent', () => {
  it('does not present a partial candidate result as an overall pass', () => {
    TestBed.configureTestingModule({ providers: [PolicyStudioI18n] });
    const component = TestBed.runInInjectionContext(() => new PolicySandboxResultsComponent());
    const base = {
      scenarioId: 'scenario-A', scenarioKey: 'A', expectedDecision: 'ALLOW',
      candidateDecision: 'ALLOW', activeDecision: 'DENY', comparison: 'CANDIDATE_MISMATCH',
      candidateMatchesExpected: true, activeMatchesExpected: false,
      candidateReasonCodes: [], activeReasonCodes: []
    };
    expect(component.passed(base)).toBe(false);
    expect(component.passed({
      ...base, activeDecision: 'ALLOW', comparison: 'CANDIDATE_MATCH', activeMatchesExpected: true
    })).toBe(true);
  });
});
