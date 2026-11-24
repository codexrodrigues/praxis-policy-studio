import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import type { PolicySandboxRun } from './catalog.fixture';
import { PolicySandboxResultsComponent } from './policy-sandbox-results.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('PolicySandboxResultsComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [PolicyStudioI18n] }));
  afterEach(() => TestBed.resetTestingModule());

  it('does not present a partial candidate result as an overall pass', () => {
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

  it('computes KPI summary totals for null and mixed sandbox runs', () => {
    const component = TestBed.runInInjectionContext(() => new PolicySandboxResultsComponent());
    const runSignal = signal<PolicySandboxRun | null>(null);
    Object.defineProperty(component, 'run', { configurable: true, value: runSignal });

    expect(component.summary()).toEqual({ total: 0, passed: 0, diverged: 0 });

    runSignal.set({
      runId: 'run-1',
      workspaceId: 'ws-1',
      workspaceRevision: 1,
      evaluatedAtUtc: '2026-10-21T12:00:00Z',
      activeSnapshotKey: 'snap-1',
      results: [
        {
          scenarioId: 's-1', scenarioKey: 'ok', expectedDecision: 'ALLOW',
          candidateDecision: 'ALLOW', activeDecision: 'ALLOW', comparison: 'CANDIDATE_MATCH',
          candidateMatchesExpected: true, activeMatchesExpected: true,
          candidateReasonCodes: [], activeReasonCodes: []
        },
        {
          scenarioId: 's-2', scenarioKey: 'diff', expectedDecision: 'DENY',
          candidateDecision: 'ALLOW', activeDecision: 'DENY', comparison: 'CANDIDATE_MISMATCH',
          candidateMatchesExpected: false, activeMatchesExpected: true,
          candidateReasonCodes: [], activeReasonCodes: []
        }
      ]
    });

    expect(component.summary()).toEqual({ total: 2, passed: 1, diverged: 1 });
  });
});
