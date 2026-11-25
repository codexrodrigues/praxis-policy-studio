import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DecisionSummary } from './catalog.fixture';
import { DecisionExplorerRailComponent } from './decision-explorer-rail.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

function makeDecision(index: number, stage: DecisionSummary['decisionStage'] = 'DOMAIN_DECISION'): DecisionSummary {
  return {
    order: index,
    totalDecisions: index,
    key: `workforce.rule.${index}`,
    code: `WF-${index}`,
    name: `Regra ${index}`,
    domain: 'workforce',
    ruleSet: 'Workforce Rules',
    ruleSetKey: 'workforce.rules',
    state: 'verified',
    meaning: `Descrição da regra ${index}`,
    resourceKey: 'workforce.attendance',
    serviceKey: 'workforce-service',
    authority: 'CONFIG_AUTHORITATIVE',
    baselineAuthority: 'LEGACY_RECOVERED',
    source: 'config',
    evidenceCount: 1,
    authoringSupported: true,
    availableDefinitionActions: [],
    configDefinitionId: `def-${index}`,
    configVersion: 1,
    expression: null,
    condition: { '==': [1, 1] },
    factPaths: [],
    facts: [],
    nullSemantics: 'FAIL_CLOSED',
    operationKeys: ['CREATE'],
    hostContractVersion: '1.0',
    evidence: [],
    draftLifecycle: null,
    decisionStage: stage,
    slotOverridePolicy: index === 1 ? 'LOCKED' : 'PARAMETERIZABLE'
  };
}

describe('DecisionExplorerRailComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [PolicyStudioI18n] }));
  afterEach(() => TestBed.resetTestingModule());

  it('groups decisions by canonical stage and formats concise override policy badges', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionExplorerRailComponent());
    const first = makeDecision(1, 'PROTECTED_GUARD');
    const second = makeDecision(2, 'DOMAIN_DECISION');
    Object.defineProperty(component, 'decisions', { configurable: true, value: signal([first, second]) });

    expect(component.useVirtualScroll()).toBe(false);
    expect(component.stageGroups().map(group => group.stageKey)).toEqual([
      'PROTECTED_GUARD',
      'DOMAIN_DECISION'
    ]);
    expect(component.autonomyLabel(first)).toBe('Fixa');
    expect(component.autonomyTone(first)).toBe('locked');
    expect(component.autonomyIcon(first)).toBe('lock');
    expect(component.autonomyTooltip(first)).toBe('Fixa');
    expect(component.autonomyLabel(second)).toBe('Parametrizável');
    expect(component.autonomyTone(second)).toBe('param');
    expect(component.autonomyIcon(second)).toBe('sliders');

    const unhydrated = { ...makeDecision(3), slotOverridePolicy: null };
    expect(component.autonomyIcon(unhydrated)).toBe('circle-dot');
    expect(component.autonomyTooltip(unhydrated)).toBe('Detalhes carregados ao abrir');
  });

  it('tracks active workflow indicators only when workspace is open, in review, approved, or rejected', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionExplorerRailComponent());
    const promoted = { ...makeDecision(1), workspaceStatus: 'PROMOTED' };
    const open = { ...makeDecision(2), workspaceStatus: 'OPEN' };
    const review = { ...makeDecision(3), workspaceStatus: 'SUBMITTED' };
    const approved = { ...makeDecision(4), workspaceStatus: 'APPROVED' };
    const rejected = { ...makeDecision(5), workspaceStatus: 'REJECTED' };

    expect(component.hasActiveWorkflowIndicator(promoted)).toBe(false);
    expect(component.workflowIndicatorTone(promoted)).toBeNull();
    expect(component.hasActiveWorkflowIndicator(open)).toBe(true);
    expect(component.workflowIndicatorTone(open)).toBe('open');
    expect(component.workflowIndicatorTitle(open)).toBe('Em elaboração');
    expect(component.workflowIndicatorTone(review)).toBe('review');
    expect(component.workflowIndicatorTone(approved)).toBe('approved');
    expect(component.workflowIndicatorTone(rejected)).toBe('rejected');
  });

  it('switches to CdkVirtualScrollViewport virtual rows when catalog has more than 40 decisions', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionExplorerRailComponent());
    const many = Array.from({ length: 45 }, (_, index) => makeDecision(index + 1, 'DOMAIN_DECISION'));
    Object.defineProperty(component, 'decisions', { configurable: true, value: signal(many) });

    expect(component.useVirtualScroll()).toBe(true);
    const rows = component.virtualRows();
    expect(rows[0]).toMatchObject({ kind: 'stage', labelKey: 'stageDomain', count: 45 });
    expect(rows).toHaveLength(46);
    expect(component.trackVirtualRow(0, rows[0]!)).toBe('stage:DOMAIN_DECISION');
  });

  it('humanizes domain/scope/titles and hides redundant ruleSet subtitle in business lens when scoped', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionExplorerRailComponent());
    const decision = {
      ...makeDecision(1),
      domain: 'human-resources.attendance',
      code: 'WF-10',
      name: 'WF-10 — attendance.limit-days',
      ruleSet: 'Workforce Attendance'
    };
    Object.defineProperty(component, 'selected', { configurable: true, value: signal(decision) });
    Object.defineProperty(component, 'contextScopeFilter', { configurable: true, value: signal('human-resources.attendance.launch') });

    expect(component.displayDomainEyebrow()).toBe('Human Resources · Attendance');
    expect(component.displayScopeFilter('human-resources.attendance.launch')).toBe('Attendance · Launch');
    expect(component.displayDecisionTitle(decision)).toBe('Attendance · Limit Days');
    expect(component.displayRuleSetSubtitle(decision)).toBeNull();

    Object.defineProperty(component, 'viewDepth', { configurable: true, value: signal<'business' | 'technical'>('business') });
    expect(component.virtualItemSize()).toBe(78);

    const technicalComponent = TestBed.runInInjectionContext(() => new DecisionExplorerRailComponent());
    Object.defineProperty(technicalComponent, 'selected', { configurable: true, value: signal(decision) });
    Object.defineProperty(technicalComponent, 'contextScopeFilter', { configurable: true, value: signal('human-resources.attendance.launch') });
    Object.defineProperty(technicalComponent, 'viewDepth', { configurable: true, value: signal<'business' | 'technical'>('technical') });
    expect(technicalComponent.displayDomainEyebrow()).toBe('human-resources.attendance');
    expect(technicalComponent.displayDecisionTitle(decision)).toBe('attendance.limit-days');
    expect(technicalComponent.displayRuleSetSubtitle(decision)).toBe('Workforce Attendance');
    expect(technicalComponent.virtualItemSize()).toBe(98);
  });

  it('prevents partial hydration catalogs from dumping unhydrated rows into Other and groups truthfully by global lens', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionExplorerRailComponent());
    const partial = [
      ...Array.from({ length: 36 }, (_, idx) => ({
        ...makeDecision(idx + 1, 'DOMAIN_DECISION'),
        domain: 'human-resources.attendance',
        ruleType: 'validation'
      })),
      ...Array.from({ length: 970 }, (_, idx) => ({
        ...makeDecision(idx + 37, undefined),
        domain: idx % 2 === 0 ? 'payroll.benefits' : 'human-resources.attendance',
        ruleSet: idx % 2 === 0 ? 'payroll.benefits.calc' : 'human-resources.attendance.launch',
        ruleSetKey: idx % 2 === 0 ? 'payroll.benefits.calc' : 'human-resources.attendance.launch',
        ruleType: idx % 3 === 0 ? 'approval_policy' : 'validation',
        workspaceStatus: idx === 0 ? 'OPEN' : 'PROMOTED',
        detailHydrated: false,
        decisionStage: undefined,
        slotOverridePolicy: undefined
      }))
    ];
    const lensSignal = signal<'domain' | 'type' | 'workflow'>('domain');
    Object.defineProperty(component, 'decisions', { configurable: true, value: signal(partial) });
    Object.defineProperty(component, 'globalLens', { configurable: true, value: lensSignal });

    expect(component.autonomyFilterAvailable()).toBe(false);
    expect(component.hasStageMetadata()).toBe(false);
    expect(component.virtualRows().some(row => row.kind === 'stage' && row.labelKey === 'stageOther')).toBe(false);

    expect(component.globalGroups().map(group => group.label)).toEqual([
      'Human Resources · Attendance',
      'Payroll · Benefits'
    ]);

    lensSignal.set('type');
    expect(component.globalGroups().map(group => group.label)).toEqual([
      'Validação',
      'Aprovação'
    ]);

    lensSignal.set('workflow');
    expect(component.globalGroups()[0]).toMatchObject({
      groupKey: 'workflow:OPEN',
      label: 'Em elaboração'
    });
  });

  it('filters scoped hydrated rules accurately by autonomy and legal basis', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionExplorerRailComponent());
    const first = { ...makeDecision(1, 'PROTECTED_GUARD'), slotOverridePolicy: 'LOCKED' as const };
    const second = {
      ...makeDecision(2, 'DOMAIN_DECISION'),
      slotOverridePolicy: 'PARAMETERIZABLE' as const,
      documentation: { legalBasis: [{ code: 'Decreto 1/2025' }] }
    };
    const third = { ...makeDecision(3, 'DOMAIN_DECISION'), slotOverridePolicy: 'REPLACEABLE' as const };
    Object.defineProperty(component, 'decisions', { configurable: true, value: signal([first, second, third]) });

    expect(component.autonomyFilterAvailable()).toBe(true);
    expect(component.autonomyCounts()).toEqual({ all: 3, param: 1, editable: 1, locked: 1, legal: 1 });

    component.selectAutonomyFilter('param');
    expect(component.filteredDecisions().map(item => item.key)).toEqual([second.key]);

    component.selectAutonomyFilter('legal');
    expect(component.filteredDecisions().map(item => item.key)).toEqual([second.key]);
  });

  it('builds quick scope dropdown options and toggles expandable filters panel', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionExplorerRailComponent());
    const d1 = {
      ...makeDecision(1),
      domain: 'human-resources.attendance',
      ruleSet: 'human-resources.attendance.launch',
      ruleSetKey: 'human-resources.attendance.launch'
    };
    const d2 = {
      ...makeDecision(2),
      domain: 'payroll.benefits',
      ruleSet: 'payroll.benefits.calc',
      ruleSetKey: 'payroll.benefits.calc'
    };
    Object.defineProperty(component, 'decisions', { configurable: true, value: signal([d1, d2]) });

    expect(component.hasMultipleQuickScopes()).toBe(true);
    expect(component.quickScopeDomains().map(d => d.domainKey)).toEqual([
      'human-resources.attendance',
      'payroll.benefits'
    ]);

    expect(component.filtersPanelOpen()).toBe(false);
    component.toggleFiltersPanel();
    expect(component.filtersPanelOpen()).toBe(true);
  });
});
