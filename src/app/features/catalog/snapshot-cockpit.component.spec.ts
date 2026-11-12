import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import type { DomainRuleRolloutPolicy, DomainRuleSnapshotVersion } from '@praxisui/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RuleSetCompositionCandidate } from './catalog.fixture';
import {
  buildDecisionMaturityPosture,
  buildExecutionCorrelationSummary
} from './catalog-presentation';
import { SnapshotCockpitComponent } from './snapshot-cockpit.component';
import { DecisionParametersEditorComponent } from '../authoring/decision-parameters-editor.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('SnapshotCockpitComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({}));
  afterEach(() => TestBed.resetTestingModule());

  it('labels only the action already authorized by the snapshot catalog', () => {
    const component = TestBed.runInInjectionContext(() => new SnapshotCockpitComponent());
    Object.defineProperty(component, 'operationKey', { configurable: true, value: () => 'evaluate' });
    Object.defineProperty(component, 'operationKeys', { configurable: true, value: () => ['evaluate'] });
    const version: DomainRuleSnapshotVersion = {
      snapshotKey: 'snapshot-2', ruleSetKey: 'benefit-rules', operationKey: 'evaluate', ruleSetVersion: 2,
      publicationRevision: 2, snapshotContentHash: 'A'.repeat(64), publishedBy: 'publisher',
      publishedAtUtc: '2026-08-13T12:00:00Z', active: false,
      governanceState: 'READY', availableAction: 'ROLLBACK'
    };
    expect(component.actionLabel(version)).toContain('Reverter');
    expect(component.actionLabel({ ...version, availableAction: 'UNAVAILABLE' })).toContain('indisponível');
  });

  it('emits a typed REQUIRED rollout-policy draft only with a valid quorum', () => {
    const component = TestBed.runInInjectionContext(() => new SnapshotCockpitComponent());
    Object.defineProperty(component, 'operationKey', { configurable: true, value: () => 'evaluate' });
    Object.defineProperty(component, 'operationKeys', { configurable: true, value: () => ['evaluate'] });
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
    Object.defineProperty(component, 'operationKey', { configurable: true, value: () => 'evaluate' });
    Object.defineProperty(component, 'operationKeys', { configurable: true, value: () => ['evaluate'] });
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
    Object.defineProperty(component, 'operationKey', { configurable: true, value: () => 'evaluate' });
    Object.defineProperty(component, 'operationKeys', { configurable: true, value: () => ['evaluate'] });
    const version: DomainRuleSnapshotVersion = {
      snapshotKey: 'candidate-2', ruleSetKey: 'benefit-rules', operationKey: 'evaluate', ruleSetVersion: 2,
      publicationRevision: 2, snapshotContentHash: 'A'.repeat(64), publishedBy: 'publisher',
      publishedAtUtc: '2026-08-13T12:00:00Z', active: false,
      governanceState: 'READY', availableAction: 'ACTIVATE'
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
    expect(component.canCreateRollout(version)).toBe(false);
    expect(component.canCreateRollout({ ...version, availableAction: 'CREATE_ROLLOUT' })).toBe(true);
    Object.defineProperty(component, 'head', {
      value: () => ({ headEtag: 'head-1' })
    });
    expect(component.canCreateRollout(version)).toBe(true);
    expect(component.canCreateRollout({ ...version, availableAction: 'CREATE_ROLLOUT' })).toBe(false);
    expect(component.canCreateRollout({ ...version, active: true })).toBe(false);
    expect(component.canCreateRollout({ ...version, availableAction: 'UNAVAILABLE' })).toBe(false);
    for (const governanceState of ['RUNTIME_INCOMPATIBLE', 'REPUBLICATION_REQUIRED', 'INVALID'] as const) {
      const unavailable = { ...version, governanceState, availableAction: 'UNAVAILABLE' as const };
      expect(component.canCreateRollout(unavailable)).toBe(false);
      expect(component.actionLabel(unavailable)).toContain('indisponível');
      // Even contradictory stale actions cannot make a non-ready version operational.
      expect(component.canCreateRollout({ ...unavailable, availableAction: 'ACTIVATE' })).toBe(false);
      expect(component.actionLabel({ ...unavailable, availableAction: 'ACTIVE', active: true }))
        .toContain('indisponível');
    }
  });

  it('explains runtime incompatibility and preserved audit history in both locales', () => {
    const component = TestBed.runInInjectionContext(() => new SnapshotCockpitComponent());
    Object.defineProperty(component, 'operationKey', { configurable: true, value: () => 'evaluate' });
    Object.defineProperty(component, 'operationKeys', { configurable: true, value: () => ['evaluate'] });
    expect(component.i18n.text('snapshotRuntimeIncompatible')).toContain('runtime atual');
    expect(component.i18n.text('snapshotRuntimeIncompatibleHint')).toContain('auditoria');
    component.i18n.locale.set('en-US');
    expect(component.i18n.text('snapshotRuntimeIncompatible')).toContain('current runtime');
    expect(component.i18n.text('snapshotRuntimeIncompatibleHint')).toContain('preserved for audit');
  });

  it('projects stable snapshot blocker codes through localized product copy', () => {
    const component = TestBed.runInInjectionContext(() => new SnapshotCockpitComponent());
    Object.defineProperty(component, 'operationKey', { configurable: true, value: () => 'evaluate' });
    Object.defineProperty(component, 'operationKeys', { configurable: true, value: () => ['evaluate'] });

    expect(component.blockerLabel('OPERATION_DECISION_MATRIX_INCOMPLETE'))
      .toContain('CREATE e UPDATE');
    expect(component.blockerLabel('FUTURE_SERVER_BLOCKER'))
      .toContain('ainda não reconhece');
  });

  it('enforces Segregation of Duties (SoD) via authorizedActions on the host-owned RuleSetCompositionCandidate', () => {
    const component = TestBed.runInInjectionContext(() => new SnapshotCockpitComponent());
    Object.defineProperty(component, 'operationKey', { configurable: true, value: () => 'evaluate' });
    Object.defineProperty(component, 'operationKeys', { configurable: true, value: () => ['evaluate'] });
    const candidateSignal = signal<RuleSetCompositionCandidate | null>({
      ruleSetKey: 'benefit-rules',
      ruleSetVersion: 3,
      compositionDigest: 'sha256:comp-3',
      implementationCatalogDigest: 'sha256:impl-3',
      currentHeadEtag: '"head-2"',
      sources: [{ ruleKey: 'benefit.rule', definitionId: 'def-1', version: 2, status: 'approved' }],
      authorizedActions: ['PREPARE', 'APPROVE']
    });
    Object.defineProperty(component, 'compositionCandidate', {
      configurable: true,
      value: candidateSignal
    });

    expect(component.canApproveCandidate()).toBe(true);
    expect(component.canPublishCandidate()).toBe(false);

    candidateSignal.set({
      ruleSetKey: 'benefit-rules',
      ruleSetVersion: 3,
      compositionDigest: 'sha256:comp-3',
      implementationCatalogDigest: 'sha256:impl-3',
      currentHeadEtag: '"head-2"',
      sources: [{ ruleKey: 'benefit.rule', definitionId: 'def-1', version: 2, status: 'approved' }],
      authorizedActions: ['PREPARE', 'PUBLISH']
    });
    expect(component.canApproveCandidate()).toBe(false);
    expect(component.canPublishCandidate()).toBe(true);
  });

  it('prevents silent fallback to defaultValue when clearing a required non-nullable numeric parameter', () => {
    const editor = TestBed.runInInjectionContext(() => new DecisionParametersEditorComponent());
    const descriptor = {
      name: 'maxRetroactiveDays',
      type: 'INTEGER' as const,
      required: true,
      nullable: false,
      readOnly: false,
      defaultValue: 30,
      declaredValue: 30,
      effectiveValue: 30,
      minimum: 1,
      maximum: 365
    };
    const catalogSignal = signal({
      definitionId: 'def-1',
      ruleKey: 'hr.retroactive',
      version: 1,
      schemaVersion: 'praxis.domain-rule-parameter-catalog.v1',
      parameters: [descriptor]
    });
    const paramsSignal = signal<Readonly<Record<string, unknown>>>({
      parameterValues: { maxRetroactiveDays: 30 }
    });
    Object.defineProperty(editor, 'parameterCatalog', { configurable: true, value: catalogSignal });
    Object.defineProperty(editor, 'parameters', { configurable: true, value: paramsSignal });

    const emittedParameters: Readonly<Record<string, unknown>>[] = [];
    editor.parametersChanged.subscribe(next => {
      emittedParameters.push(next);
      paramsSignal.set(next);
    });

    editor.updateNumericValue(descriptor, '');
    expect(emittedParameters).toEqual([{ parameterValues: { maxRetroactiveDays: '' } }]);
    expect(editor.numericParameterValue(descriptor)).toBe('');
    expect(editor.descriptorError(descriptor)).toBe('Obrigatório');

    const stringDescriptor = {
      name: 'approvalChannel',
      type: 'STRING' as const,
      required: true,
      nullable: false,
      readOnly: false,
      defaultValue: 'BOARD',
      declaredValue: '   ',
      effectiveValue: '   '
    };
    paramsSignal.set({ parameterValues: { approvalChannel: '   ' } });
    expect(editor.descriptorError(stringDescriptor)).toBe('Obrigatório');
  });

  it('resets customPromotedDefinitionId when switching decisions or ruleSetKeys', () => {
    const component = TestBed.runInInjectionContext(() => new SnapshotCockpitComponent());
    Object.defineProperty(component, 'operationKey', { configurable: true, value: () => 'evaluate' });
    Object.defineProperty(component, 'operationKeys', { configurable: true, value: () => ['evaluate'] });
    const ruleSetKeySignal = signal('benefit-rules');
    const defaultSourceSignal = signal<string | null>('def-default-1');
    const eligibleSourcesSignal = signal([
      {
        definitionId: 'def-default-1',
        ruleKey: 'benefit.rule.1',
        name: 'Rule 1',
        status: 'approved',
        version: 1,
        domain: 'benefits',
        operationKeys: ['CREATE'],
        parameterCatalog: null,
        parameterValues: null
      },
      {
        definitionId: 'def-custom-2',
        ruleKey: 'benefit.rule.2',
        name: 'Rule 2',
        status: 'approved',
        version: 2,
        domain: 'benefits',
        operationKeys: ['CREATE'],
        parameterCatalog: null,
        parameterValues: null
      }
    ]);
    Object.defineProperty(component, 'ruleSetKey', { configurable: true, value: ruleSetKeySignal });
    Object.defineProperty(component, 'defaultSourceDefinitionId', { configurable: true, value: defaultSourceSignal });
    Object.defineProperty(component, 'eligibleSources', { configurable: true, value: eligibleSourcesSignal });

    expect(component.effectivePromotedDefinitionId()).toBe('def-default-1');
    component.updatePromotedDefinitionId('def-custom-2');
    expect(component.effectivePromotedDefinitionId()).toBe('def-custom-2');

    // Switching selected decision updates defaultSourceDefinitionId and clears stale custom selection
    defaultSourceSignal.set('def-default-1-next');
    expect(component.customPromotedDefinitionId()).toBeNull();
    expect(component.effectivePromotedDefinitionId()).toBe('def-default-1-next');
  });

  it('computes pre-publication RuleSet impact, shared facts (where-used), peer slot roles, and unpromoted draft warnings', () => {
    const component = TestBed.runInInjectionContext(() => new SnapshotCockpitComponent());
    Object.defineProperty(component, 'operationKey', { configurable: true, value: () => 'evaluate' });
    Object.defineProperty(component, 'operationKeys', { configurable: true, value: () => ['evaluate'] });
    const ruleSetKeySignal = signal('extraordinary-grant-eligibility');
    const defaultSourceSignal = signal<string | null>('def-amount-promoted');
    const candidateSignal = signal<RuleSetCompositionCandidate | null>(null);
    const catalogDecisionsSignal = signal([
      {
        order: 1,
        totalDecisions: 2,
        key: 'grant.amount-parameters',
        code: 'GRANT_AMOUNT_EXCEEDED',
        name: 'Limite do auxílio',
        domain: 'benefits',
        ruleSet: 'Extraordinary grant',
        ruleSetKey: 'extraordinary-grant-eligibility',
        resourceKey: 'human-resources.extraordinary-benefit-requests',
        serviceKey: 'praxis-api-quickstart',
        state: 'verified' as const,
        meaning: 'Limita o valor solicitado.',
        authority: 'CONFIG',
        baselineAuthority: 'QUICKSTART_RULE_LAB',
        source: 'factory#amount',
        evidenceCount: 1,
        authoringSupported: true,
        availableDefinitionActions: [],
        configDefinitionId: 'def-amount-base',
        promotedDefinitionId: 'def-amount-promoted',
        configVersion: 2,
        configStatus: 'approved',
        expression: 'request.requestedAmount <= program.maxAmount',
        condition: null,
        factPaths: ['request.requestedAmount', 'program.maxAmount'],
        facts: [],
        nullSemantics: 'FAIL_CLOSED',
        operationKeys: ['evaluate-extraordinary-grant'],
        hostContractVersion: 'quickstart/1.0',
        evidence: [],
        draftLifecycle: null
      },
      {
        order: 2,
        totalDecisions: 2,
        key: 'budget.availability',
        code: 'BUDGET_UNAVAILABLE',
        name: 'Disponibilidade orçamentária',
        domain: 'benefits',
        ruleSet: 'Extraordinary grant',
        ruleSetKey: 'extraordinary-grant-eligibility',
        resourceKey: 'human-resources.extraordinary-benefit-requests',
        serviceKey: 'praxis-api-quickstart',
        state: 'technical-draft' as const,
        meaning: 'Exige orçamento suficiente.',
        authority: 'CONFIG',
        baselineAuthority: 'QUICKSTART_RULE_LAB',
        source: 'factory#budget',
        evidenceCount: 1,
        authoringSupported: true,
        availableDefinitionActions: [],
        configDefinitionId: 'def-budget-base',
        promotedDefinitionId: null,
        workspaceId: 'ws-budget-draft',
        workspaceStatus: 'OPEN',
        configVersion: 1,
        configStatus: 'draft',
        expression: 'request.requestedAmount <= budget.availableAmount',
        condition: null,
        factPaths: ['request.requestedAmount', 'budget.availableAmount'],
        facts: [],
        nullSemantics: 'FAIL_CLOSED',
        operationKeys: ['evaluate-extraordinary-grant', 'reserve-budget'],
        hostContractVersion: 'quickstart/1.0',
        evidence: [],
        draftLifecycle: null
      }
    ]);
    Object.defineProperty(component, 'ruleSetKey', { configurable: true, value: ruleSetKeySignal });
    Object.defineProperty(component, 'defaultSourceDefinitionId', { configurable: true, value: defaultSourceSignal });
    Object.defineProperty(component, 'compositionCandidate', { configurable: true, value: candidateSignal });
    Object.defineProperty(component, 'catalogDecisions', { configurable: true, value: catalogDecisionsSignal });

    const impact = component.impactSummary();
    expect(impact).not.toBeNull();
    expect(impact?.targetDecisionKey).toBe('grant.amount-parameters');
    expect(impact?.affectedSurfaces).toEqual([
      'human-resources.extraordinary-benefit-requests',
      'praxis-api-quickstart'
    ]);
    expect(impact?.affectedOperations).toEqual([
      'evaluate-extraordinary-grant',
      'reserve-budget'
    ]);
    expect(impact?.sharedFacts).toEqual([
      { path: 'request.requestedAmount', usedByRuleKeys: ['budget.availability'] }
    ]);
    expect(impact?.peerDecisions).toEqual([
      expect.objectContaining({
        key: 'grant.amount-parameters',
        role: 'PROMOTED_TARGET',
        version: 2
      }),
      expect.objectContaining({
        key: 'budget.availability',
        role: 'PEER_SLOT',
        sharedFactPaths: ['request.requestedAmount'],
        hasUnpromotedDraft: true
      })
    ]);
    expect(impact?.unpromotedDraftPeers).toEqual(['budget.availability']);
    expect(impact?.reasonCodes).toEqual(['GRANT_AMOUNT_EXCEEDED', 'BUDGET_UNAVAILABLE']);
    expect(impact?.hostContractVersions).toEqual(['quickstart/1.0']);
    expect(impact?.diagnostics).toEqual([
      {
        code: 'UNPROMOTED_PEER_WORKSPACE',
        severity: 'WARNING',
        affectedRuleKeys: ['budget.availability'],
        detail: 'budget.availability'
      }
    ]);

    // When a peer member has reviewStatus CATALOG_IDENTITY_ONLY or missing fact catalog descriptors,
    // MISSING_SLOT_FACTS is emitted as an ERROR diagnostic.
    catalogDecisionsSignal.update(decisions => [
      decisions[0],
      {
        ...decisions[1],
        reviewStatus: 'CATALOG_IDENTITY_ONLY',
        factPaths: ['request.requestedAmount', 'budget.availableAmount'],
        facts: []
      }
    ]);
    const impactWithMissingFacts = component.impactSummary();
    expect(impactWithMissingFacts?.diagnostics).toContainEqual({
      code: 'MISSING_SLOT_FACTS',
      severity: 'ERROR',
      affectedRuleKeys: ['budget.availability'],
      detail: 'budget.availability'
    });
  });

  it('supports governed head withdrawal validation and reactivation rollout when head is WITHDRAWN (V73/V74 tombstone)', () => {
    const component = TestBed.runInInjectionContext(() => new SnapshotCockpitComponent());
    Object.defineProperty(component, 'operationKey', { configurable: true, value: () => 'funcao-confianca:create' });
    Object.defineProperty(component, 'operationKeys', {
      configurable: true,
      value: () => ['funcao-confianca:create', 'funcao-confianca:update']
    });
    const headSignal = signal<{
      readonly ruleSetKey: string;
      readonly operationKey: string;
      readonly activeSnapshotKey: string;
      readonly ruleSetVersion: number;
      readonly publicationRevision: number;
      readonly activationRevision: number;
      readonly activatedBy: string;
      readonly activatedAtUtc: string;
      readonly headEtag: string;
      readonly executionReady: boolean;
      readonly governanceState: 'READY' | 'WITHDRAWN';
    } | null>({
      ruleSetKey: 'ergon.funcao-confianca',
      operationKey: 'funcao-confianca:create',
      activeSnapshotKey: 'fc-snap-v1',
      ruleSetVersion: 1,
      publicationRevision: 1,
      activationRevision: 1,
      activatedBy: 'publisher',
      activatedAtUtc: '2026-08-13T12:00:00Z',
      headEtag: '"head-ready-1"',
      executionReady: true,
      governanceState: 'READY'
    });
    Object.defineProperty(component, 'head', { configurable: true, value: headSignal });
    Object.defineProperty(component, 'rolloutCatalog', {
      configurable: true,
      value: () => ({
        ruleSetKey: 'ergon.funcao-confianca',
        operationKey: 'funcao-confianca:create',
        rollouts: [],
        availableActions: ['CREATE_ROLLOUT']
      })
    });

    const withdrawnReasons: string[] = [];
    const selectedOperations: string[] = [];
    component.withdrawHead.subscribe(reason => withdrawnReasons.push(reason));
    component.operationSelected.subscribe(op => selectedOperations.push(op));

    component.withdrawAuthoringOpen.set(true);
    component.submitWithdraw('   ');
    expect(component.withdrawInputError()).toBe(true);
    expect(withdrawnReasons).toHaveLength(0);

    // Switching operations resets withdrawAuthoringOpen and withdrawInputError
    component.selectOperation('funcao-confianca:update');
    expect(component.withdrawAuthoringOpen()).toBe(false);
    expect(component.withdrawInputError()).toBe(false);
    expect(selectedOperations).toEqual(['funcao-confianca:update']);

    component.submitWithdraw('Incidente operacional no lote de funções governadas');
    expect(component.withdrawInputError()).toBe(false);
    expect(withdrawnReasons).toEqual(['Incidente operacional no lote de funções governadas']);

    // Even while the currently inspected operation head is READY, if the coupled family cohort (head-set)
    // is null (404 because another peer operation was withdrawn), posture reports CONFIG_AUTHORITATIVE (no active cohort).
    const coupledReadyHeadWithIncompleteCohort = buildDecisionMaturityPosture(
      {
        order: 1,
        totalDecisions: 1,
        key: 'ergon.funcao_confianca.identidade_obrigatoria',
        code: 'ERG_FC_IDENTIDADE_OBRIGATORIA',
        name: 'Identidade obrigatória',
        domain: 'ergon',
        ruleSet: 'Função de Confiança',
        ruleSetKey: 'ergon.administracao-pessoal.funcoes.chefia',
        resourceKey: 'ergon.funcao-confianca',
        serviceKey: 'praxis-ergon-showcase',
        state: 'verified' as const,
        meaning: 'Valida código e nome.',
        authority: 'GOVERNED_SNAPSHOT',
        baselineAuthority: 'LEGACY_ORACLE',
        source: 'FuncaoConfiancaRuleSet',
        evidenceCount: 1,
        authoringSupported: true,
        availableDefinitionActions: [],
        expression: null,
        condition: null,
        factPaths: [],
        facts: [],
        nullSemantics: 'FAIL_CLOSED',
        operationKeys: ['createErgonFuncaoConfianca', 'updateErgonFuncaoConfianca'],
        hostContractVersion: 'ergon/1.0',
        evidence: [],
        draftLifecycle: null
      },
      headSignal(),
      null
    );
    expect(coupledReadyHeadWithIncompleteCohort?.activeSnapshotKey).toBeNull();
    expect(coupledReadyHeadWithIncompleteCohort?.operationalAuthority).toBe('CONFIG_AUTHORITATIVE');

    // Transition to WITHDRAWN tombstone: activeSnapshotKey is preserved for audit, executionReady is false,
    // and published READY versions expose CREATE_ROLLOUT for reactivation using the rotated headEtag.
    headSignal.set({
      ruleSetKey: 'ergon.funcao-confianca',
      operationKey: 'funcao-confianca:create',
      activeSnapshotKey: 'fc-snap-v1',
      ruleSetVersion: 1,
      publicationRevision: 1,
      activationRevision: 2,
      activatedBy: 'publisher',
      activatedAtUtc: '2026-08-13T12:00:00Z',
      headEtag: '"head-withdrawn-2"',
      executionReady: false,
      governanceState: 'WITHDRAWN'
    });

    const reactivationCandidate: DomainRuleSnapshotVersion = {
      snapshotKey: 'fc-snap-v1',
      ruleSetKey: 'ergon.funcao-confianca',
      operationKey: 'funcao-confianca:create',
      ruleSetVersion: 1,
      publicationRevision: 1,
      snapshotContentHash: 'B'.repeat(64),
      publishedBy: 'publisher',
      publishedAtUtc: '2026-08-13T12:00:00Z',
      active: false,
      governanceState: 'READY',
      availableAction: 'CREATE_ROLLOUT'
    };
    expect(component.canCreateRollout(reactivationCandidate)).toBe(true);

    const decision = {
      order: 1,
      totalDecisions: 1,
      key: 'ergon.funcao_confianca.identidade_obrigatoria',
      code: 'ERG_FC_IDENTIDADE_OBRIGATORIA',
      name: 'Identidade obrigatória',
      domain: 'ergon',
      ruleSet: 'Função de Confiança',
      ruleSetKey: 'ergon.funcao-confianca',
      resourceKey: 'ergon.funcao-confianca',
      serviceKey: 'praxis-ergon-showcase',
      state: 'verified' as const,
      meaning: 'Valida código e nome.',
      authority: 'GOVERNED_SNAPSHOT',
      baselineAuthority: 'LEGACY_ORACLE',
      source: 'FuncaoConfiancaRuleSet',
      evidenceCount: 1,
      authoringSupported: true,
      availableDefinitionActions: [],
      expression: null,
      condition: null,
      factPaths: [],
      facts: [],
      nullSemantics: 'FAIL_CLOSED',
      operationKeys: ['funcao-confianca:create', 'funcao-confianca:update'],
      hostContractVersion: 'ergon/1.0',
      evidence: [],
      draftLifecycle: null
    };
    const posture = buildDecisionMaturityPosture(decision, headSignal());
    expect(posture?.activeSnapshotKey).toBeNull();
    expect(posture?.operationalAuthority).toBe('CONFIG_AUTHORITATIVE');

    const correlation = buildExecutionCorrelationSummary(decision, null, headSignal(), null, null);
    expect(correlation?.activeSnapshotKey).toBeNull();
  });

});
