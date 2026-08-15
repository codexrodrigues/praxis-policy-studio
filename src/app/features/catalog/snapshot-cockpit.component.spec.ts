import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import type { DomainRuleRolloutPolicy, DomainRuleSnapshotVersion } from '@praxisui/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SnapshotCockpitComponent } from './snapshot-cockpit.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('SnapshotCockpitComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({}));
  afterEach(() => TestBed.resetTestingModule());

  it('labels only the action already authorized by the snapshot catalog', () => {
    const component = TestBed.runInInjectionContext(() => new SnapshotCockpitComponent());
    const version: DomainRuleSnapshotVersion = {
      snapshotKey: 'snapshot-2', ruleSetKey: 'benefit-rules', ruleSetVersion: 2,
      publicationRevision: 2, snapshotContentHash: 'A'.repeat(64), publishedBy: 'publisher',
      publishedAtUtc: '2026-08-13T12:00:00Z', active: false,
      governanceState: 'READY', availableAction: 'ROLLBACK'
    };
    expect(component.actionLabel(version)).toContain('Reverter');
    expect(component.actionLabel({ ...version, availableAction: 'UNAVAILABLE' })).toContain('indisponível');
  });

  it('emits a typed REQUIRED rollout-policy draft only with a valid quorum', () => {
    const component = TestBed.runInInjectionContext(() => new SnapshotCockpitComponent());
    Object.defineProperty(component, 'ruleSetKey', { value: () => 'frequency-rules' });
    const requests: unknown[] = [];
    component.createRolloutPolicy.subscribe(request => requests.push(request));

    component.submitPolicy('strict-host-quorum', 'REQUIRED', '0', '1', true, '120', '900');
    expect(component.policyInputError()).toBe(true);
    expect(requests).toHaveLength(0);

    component.submitPolicy('strict-host-quorum', 'REQUIRED', '2', '1', true, '120', '900');
    expect(component.policyInputError()).toBe(false);
    expect(requests).toEqual([expect.objectContaining({
      ruleSetKey: 'frequency-rules', policyKey: 'strict-host-quorum',
      enforcementMode: 'REQUIRED', minimumFreshProbes: 2, minimumReadyRatio: 1
    })]);
  });

  it('derives policy commands from lifecycle without inferring user roles', () => {
    const component = TestBed.runInInjectionContext(() => new SnapshotCockpitComponent());
    const policy: DomainRuleRolloutPolicy = {
      policyId: 'policy-1', ruleSetKey: 'frequency-rules', policyKey: 'strict-host-quorum',
      policyVersion: 1, status: 'DRAFT', enforcementMode: 'REQUIRED', minimumFreshProbes: 2,
      minimumReadyRatio: 1, blockOnIncompatible: true, staleAfterSeconds: 120,
      maximumRolloutAgeSeconds: 900, createdBy: 'author', createdAt: '2026-08-13T12:00:00Z',
      approvedBy: null, approvedAt: null, activatedBy: null, activatedAt: null,
      availableActions: ['APPROVE']
    };
    expect(component.policyActionLabel(policy)).toContain('Aprovar');
    expect(component.policyActionLabel({
      ...policy, status: 'APPROVED', availableActions: ['ACTIVATE']
    })).toContain('Ativar');
    expect(component.policyActionLabel({
      ...policy, status: 'ACTIVE', availableActions: []
    })).toBe('ACTIVE');
  });

  it('creates rollout controls only from the rollout catalog action', () => {
    const component = TestBed.runInInjectionContext(() => new SnapshotCockpitComponent());
    const version: DomainRuleSnapshotVersion = {
      snapshotKey: 'candidate-2', ruleSetKey: 'benefit-rules', ruleSetVersion: 2,
      publicationRevision: 2, snapshotContentHash: 'A'.repeat(64), publishedBy: 'publisher',
      publishedAtUtc: '2026-08-13T12:00:00Z', active: false,
      governanceState: 'READY', availableAction: 'UNAVAILABLE'
    };
    Object.defineProperty(component, 'rolloutCatalog', {
      configurable: true,
      value: () => ({ ruleSetKey: 'benefit-rules', rollouts: [], availableActions: [] })
    });
    expect(component.canCreateRollout(version)).toBe(false);

    Object.defineProperty(component, 'rolloutCatalog', {
      configurable: true,
      value: () => ({
        ruleSetKey: 'benefit-rules', rollouts: [], availableActions: ['CREATE_ROLLOUT']
      })
    });
    expect(component.canCreateRollout(version)).toBe(true);
    expect(component.canCreateRollout({ ...version, active: true })).toBe(false);
  });

  it('projects stable snapshot blocker codes through localized product copy', () => {
    const component = TestBed.runInInjectionContext(() => new SnapshotCockpitComponent());

    expect(component.blockerLabel('OPERATION_DECISION_MATRIX_INCOMPLETE'))
      .toContain('CREATE e UPDATE');
    expect(component.blockerLabel('FUTURE_SERVER_BLOCKER'))
      .toContain('ainda não reconhece');
  });

});
