import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, EMPTY, expand, forkJoin, map, Observable, of, reduce, switchMap, throwError } from 'rxjs';
import { PolicyStudioRuntimeConfig, SupportedLocale } from './runtime-config';
import { createClientRequestId } from './client-request-id';
import { DomainProjection, validateDomainProjection } from './domain-projection';
import {
  DecisionLifecycleSummary,
  DecisionParameterCatalog,
  DecisionParameterDescriptor,
  DecisionParameterValueType,
  DecisionPublicationResult,
  DecisionSummary,
  DecisionTimelineEvent,
  PolicySandboxRun,
  PublicationReadiness,
  RuleSetCompositionCandidate,
  RuleSetCompositionCandidateCommand,
  RuleSetCompositionCandidateRequest,
  RuleSetCompositionPublication
} from '../features/catalog/catalog.fixture';
import { collectFactPaths, formatDecisionExpression } from './decision-inspection';
import {
  DomainRuleService,
  ResourceDiscoveryService,
  type ResourceActionCatalogItem,
  type RestApiResponse,
  type DomainRuleChangeWorkspace,
  type DomainRuleCatalogCandidate,
  type DomainRuleCompositionApproval,
  type DomainRuleCompositionManifest,
  type DomainRuleDefinition,
  type DomainRuleDefinitionCapabilities,
  type DomainRuleDefinitionRequest,
  type DomainRuleRequestOptions,
  type DomainRuleSnapshotActivation,
  type DomainRuleSnapshotStored,
  type DomainRuleSnapshotCompositionRequest,
  type DomainRuleSnapshotPublicationRequest,
  type DomainRuleExecutionSummary,
  type DomainRuleFactCatalog,
  type DomainRuleParameterCatalog,
  type DomainRuleParameterDescriptor,
  type DomainRuleHostStatusSummary,
  type DomainRuleRolloutPolicy,
  type DomainRuleRolloutPolicyCatalog,
  type DomainRuleRolloutPolicyCreateRequest,
  type DomainRuleRolloutPolicyEvent,
  type DomainRuleRolloutPolicyMutation,
  type DomainRuleRollout,
  type DomainRuleRolloutCatalog,
  type DomainRuleRolloutCatalogItem,
  type DomainRuleSnapshotHeadStatus,
  type DomainRuleSnapshotVersion,
  type DomainRuleTestScenario,
  type DomainRuleTestScenarioRequest,
  type DomainRuleTestRun,
  type DomainRuleWorkspaceCapabilities
} from '@praxisui/core';

@Injectable({ providedIn: 'root' })
export class ProjectionCatalogService {
  private readonly http = inject(HttpClient);
  private readonly domainRules = inject(DomainRuleService);
  private readonly discovery = inject(ResourceDiscoveryService);

  load(locale: SupportedLocale, config: PolicyStudioRuntimeConfig): Observable<readonly DecisionSummary[]> {
    const catalog = config.mode === 'remote'
      ? this.loadCatalogPages(config)
      : of([] as readonly DomainRuleCatalogCandidate[]);
    const workspaces = config.mode === 'remote'
      ? this.domainRules.listChangeWorkspaces(this.requestOptions(config))
      : of([] as readonly DomainRuleChangeWorkspace[]);
    const definitionCapabilities = config.mode === 'remote'
      ? this.domainRules.getDefinitionCapabilities(this.requestOptions(config))
      : of({ tenantId: '', environment: '', definitions: [] } satisfies DomainRuleDefinitionCapabilities);
    return forkJoin({
      projection: config.projectionPath
        ? this.http.get<unknown>(config.projectionPath).pipe(
            map(validateDomainProjection),
            catchError(error => config.mode === 'remote' ? of(null) : throwError(() => error)))
        : of(null),
      catalog,
      definitionCapabilities,
      workspaces
    }).pipe(
      switchMap(({ projection, catalog, definitionCapabilities, workspaces }) => {
        if (config.mode === 'fixture') {
          return of(this.fixtureSummaries(projection!, locale));
        }
        const eagerRuleKeys = new Set<string>([
          ...(projection?.decisionRefs.map(item => item.decisionKey) ?? []),
          ...(config.initialDecisionKey ? [config.initialDecisionKey] : []),
          ...workspaces.map(item => item.ruleKey)
        ]);
        const eagerCandidates = catalog.length <= 12
          ? catalog
          : projection
            ? catalog.filter(candidate => eagerRuleKeys.has(candidate.ruleKey))
            : catalog.filter((candidate, idx) =>
                eagerRuleKeys.has(candidate.ruleKey) || (candidate.status !== 'retired' && idx < 12));
        const detailReads = eagerCandidates.map(candidate => forkJoin({
          definitionWithParameters: this.domainRules.getDefinition(candidate.definitionId, this.requestOptions(config)).pipe(
            switchMap(definition => (this.hasParameterTemplate(definition)
              ? this.fetchDefinitionParameters(candidate.definitionId, config)
              : of<DomainRuleParameterCatalog | null>(null)
            ).pipe(map(serverParameterCatalog => ({ definition, serverParameterCatalog }))))
          ),
          factCatalog: this.domainRules.getDefinitionFacts(candidate.definitionId, this.requestOptions(config))
        }));
        return (detailReads.length ? forkJoin(detailReads) : of([])).pipe(map(definitionDetails => {
          const details = new Map(definitionDetails.map(detail => [detail.definitionWithParameters.definition.id, detail]));
          const summaries = catalog.map((candidate, index) => {
        const detail = details.get(candidate.definitionId);
        const definition = detail?.definitionWithParameters.definition;
        const serverParameterCatalog = detail?.definitionWithParameters.serverParameterCatalog ?? null;
        const factCatalog = detail?.factCatalog ?? undefined;
        const decision = projection?.decisionRefs.find(item => item.decisionKey === candidate.ruleKey);
        const workspace = this.latestWorkspace(workspaces, candidate.ruleKey);
        const availableDefinitionActions = this.mergeDefinitionActions(
          definitionCapabilities,
          candidate.definitionId,
          candidate.ruleKey,
          candidate.version,
          workspace?.promotedDefinitionId ?? null
        );
        if (!projection || !decision) {
          return this.catalogSummary(candidate, index, catalog.length, locale,
            availableDefinitionActions, factCatalog, definition, workspace, serverParameterCatalog);
        }
        const conditionFactPaths = collectFactPaths(definition?.condition);
        if (conditionFactPaths.some(factPath => !decision.factPaths.includes(factPath))) {
          throw new Error(`CONFIG_FACT_OUTSIDE_GOVERNED_PROJECTION ${decision.decisionKey}`);
        }
        const hasCatalogFacts = (factCatalog?.facts.length ?? 0) > 0;
        const facts = hasCatalogFacts
          ? this.decisionFacts(factCatalog, locale)
          : this.projectionFacts(decision.factPaths, projection.factSchemas);
        if (hasCatalogFacts && conditionFactPaths.some(factPath => !facts.some(fact => fact.path === factPath))) {
          throw new Error(`CONFIG_FACT_CATALOG_INCOMPLETE ${decision.decisionKey}`);
        }
        const parameterCatalog = this.overlayParameterCatalog(
          this.parameterCatalog(definition, serverParameterCatalog),
          workspace?.parameters
        );
        return {
          order: decision.order,
          // Projection order is scoped to the governed decision set, not to the
          // filtered/paginated catalog returned by discovery.
          totalDecisions: projection.decisionRefs.length,
          key: decision.decisionKey,
          code: decision.reasonCode ?? decision.decisionKey,
          name: decision.presentationLabel,
          domain: projection.presentationLabels.domain[locale] ?? projection.ruleSetRef.boundedContextKey,
          ruleSet: projection.presentationLabels.ruleSet[locale] ?? projection.ruleSetRef.ruleSetKey,
          ruleSetKey: projection.ruleSetRef.ruleSetKey,
          resourceKey: projection.ruleSetRef.operationalResourceKey?.trim() || null,
          serviceKey: definition?.serviceKey?.trim() || null,
          state: decision.semanticStatus === 'REFERENCE_IMPLEMENTED' ? 'verified' as const : 'technical-draft' as const,
          meaning: decision.presentationLabel,
          authority: `${projection.authorityEvidence.currentAuthority} · ${projection.authorityEvidence.baselineAuthority}`,
          baselineAuthority: projection.authorityEvidence.baselineAuthority,
          source: decision.semanticSourceRef,
          evidenceCount: projection.sourceArtifacts.length,
          authoringSupported: decision.editable
            || (parameterCatalog?.parameters.length ?? 0) > 0
            || this.hasEditableOperationalPolicy(definition),
          availableDefinitionActions,
          reviewStatus: decision.reviewStatus,
          configDefinitionId: candidate.definitionId,
          configVersion: candidate.version,
          configStatus: candidate.status,
          workspaceId: workspace?.id,
          workspaceStatus: workspace?.status,
          workspaceEtag: workspace?.etag,
          workspaceRevision: workspace?.revision,
          promotedDefinitionId: workspace?.promotedDefinitionId ?? null,
          workspaceCondition: workspace?.condition ?? null,
          workspaceParameters: workspace?.parameters ?? {},
          expression: formatDecisionExpression(definition?.condition),
          condition: definition?.condition ?? null,
          factPaths: conditionFactPaths.length ? conditionFactPaths : decision.factPaths,
          facts,
          nullSemantics: this.stringValue(definition?.parameters, 'nullSemantics'),
          operationKeys: this.stringArrayValue(definition?.parameters, 'operationKeys') ?? projection.ruleSetRef.operationKeys,
          hostContractVersion: this.stringValue(definition?.parameters, 'hostContractVersion') ??
            projection.ruleSetRef.hostContractVersion ?? null,
          evidence: projection.sourceArtifacts,
          draftLifecycle: this.stringValue(definition?.governance, 'lifecycleBoundary'),
          ruleType: definition?.ruleType ?? candidate.ruleType,
          parameters: definition?.parameters ?? {},
          parameterCatalog,
          detailHydrated: true
        };
      });
          if (!projection) return summaries;
          const projectionKeys = new Set(projection.decisionRefs.map(item => item.decisionKey));
          const governed = summaries
            .filter(item => projectionKeys.has(item.key))
            .sort((left, right) => left.order - right.order);
          const others = summaries.filter(item => !projectionKeys.has(item.key));
          return [...governed, ...others];
        }));
      })
    );
  }

  loadDiscoveredCandidate(
    candidate: DomainRuleCatalogCandidate,
    index: number,
    totalDecisions: number,
    locale: SupportedLocale,
    config: PolicyStudioRuntimeConfig
  ): Observable<DecisionSummary> {
    const options = this.requestOptions(config);
    return forkJoin({
      definitionWithParameters: this.domainRules.getDefinition(candidate.definitionId, options).pipe(
        switchMap(definition => (this.hasParameterTemplate(definition)
          ? this.fetchDefinitionParameters(candidate.definitionId, config)
          : of<DomainRuleParameterCatalog | null>(null)
        ).pipe(map(serverParameterCatalog => ({ definition, serverParameterCatalog }))))
      ),
      factCatalog: this.domainRules.getDefinitionFacts(candidate.definitionId, options),
      workspaces: this.domainRules.listChangeWorkspaces(options),
      definitionCapabilities: this.domainRules.getDefinitionCapabilities(options)
    }).pipe(
      map(({ definitionWithParameters, factCatalog, workspaces, definitionCapabilities }) => {
        const { definition, serverParameterCatalog } = definitionWithParameters;
        const workspace = this.latestWorkspace(workspaces, candidate.ruleKey);
        const availableDefinitionActions = this.mergeDefinitionActions(
          definitionCapabilities,
          candidate.definitionId,
          candidate.ruleKey,
          candidate.version,
          workspace?.promotedDefinitionId ?? null
        );
        return this.catalogSummary(
          candidate,
          index,
          Math.max(totalDecisions, index + 1),
          locale,
          availableDefinitionActions,
          factCatalog ?? undefined,
          definition,
          workspace,
          serverParameterCatalog
        );
      })
    );
  }

  private loadCatalogPages(config: PolicyStudioRuntimeConfig): Observable<readonly DomainRuleCatalogCandidate[]> {
    const options = this.requestOptions(config);
    return this.domainRules.browseDefinitionCatalog({ page: 0, limit: 12 }, options).pipe(
      expand(page => page.hasMore
        ? this.domainRules.browseDefinitionCatalog({ page: page.page + 1, limit: page.limit }, options)
        : EMPTY),
      reduce((candidates, page) => [...candidates, ...page.candidates], [] as DomainRuleCatalogCandidate[]),
      map(candidates => this.latestCatalogCandidates(candidates))
    );
  }

  private latestCatalogCandidates(
    candidates: readonly DomainRuleCatalogCandidate[]
  ): readonly DomainRuleCatalogCandidate[] {
    const latest = new Map<string, DomainRuleCatalogCandidate>();
    candidates.forEach(candidate => {
      const current = latest.get(candidate.ruleKey);
      if (!current || candidate.version > current.version) latest.set(candidate.ruleKey, candidate);
    });
    return [...latest.values()];
  }

  private catalogSummary(
    candidate: DomainRuleCatalogCandidate,
    index: number,
    total: number,
    locale: SupportedLocale,
    availableDefinitionActions: DecisionSummary['availableDefinitionActions'],
    factCatalog?: DomainRuleFactCatalog,
    definition?: DomainRuleDefinition,
    workspace?: DomainRuleChangeWorkspace,
    serverParameterCatalog?: DomainRuleParameterCatalog | null
  ): DecisionSummary {
    const context = candidate.contextKey?.trim() || candidate.resourceKey?.trim() || 'domain-decisions';
    const definitionBody = this.record(definition?.definition);
    const governanceBody = this.record(definition?.governance);
    const parametersBody = this.record(definition?.parameters);
    const conditionFactPaths = collectFactPaths(definition?.condition);
    const facts = this.decisionFacts(factCatalog, locale);
    const parameterCatalog = this.overlayParameterCatalog(
      this.parameterCatalog(definition, serverParameterCatalog),
      workspace?.parameters
    );
    const hasConditionFacts =
      facts.length > 0
      && definition?.condition != null
      && conditionFactPaths.every(factPath => facts.some(fact => fact.path === factPath));
    const authoringSupported = hasConditionFacts
      || (parameterCatalog?.parameters.length ?? 0) > 0
      || this.hasEditableOperationalPolicy(definition);
    const code = this.stringValue(definitionBody, 'falseReasonCode')
      ?? this.stringValue(definitionBody, 'reasonCode')
      ?? this.stringValue(parametersBody, 'reasonCode')
      ?? this.operationalPolicyString(parametersBody, 'code')
      ?? candidate.ruleKey;
    const name = this.localizedText(definitionBody?.['labels'], locale)
      ?? this.localizedText(definitionBody?.['title'], locale)
      ?? this.stringValue(definitionBody, 'presentationLabel')
      ?? this.stringValue(definitionBody, 'title')
      ?? candidate.ruleKey;
    const meaning = this.localizedText(definitionBody?.['descriptions'], locale)
      ?? this.localizedText(definitionBody?.['description'], locale)
      ?? this.stringValue(definitionBody, 'description')
      ?? this.operationalPolicyString(parametersBody, 'message')
      ?? this.localizedText(definitionBody?.['labels'], locale)
      ?? this.localizedText(definitionBody?.['title'], locale)
      ?? this.stringValue(definitionBody, 'presentationLabel')
      ?? candidate.ruleKey;
    const ruleSetKey = this.stringValue(definitionBody, 'ruleSetKey')
      ?? this.stringValue(parametersBody, 'ruleSetKey')
      ?? (candidate.resourceKey?.trim() || context);
    const resourceKey = this.stringValue(definitionBody, 'operationalResourceKey')
      ?? this.stringValue(parametersBody, 'operationalResourceKey')
      ?? candidate.resourceKey;
    const declaredBaseline = this.stringValue(governanceBody, 'baselineAuthority')
      ?? this.stringValue(governanceBody, 'sourceKind');
    const baselineAuthority = declaredBaseline
      ?? (locale === 'pt-BR' ? 'Não declarada no catálogo' : 'Not declared by the catalog');
    const currentAuthority = this.stringValue(governanceBody, 'currentAuthority')
      ?? (locale === 'pt-BR' ? 'Config · definição governada' : 'Config · governed definition');
    const authority = this.stringValue(governanceBody, 'currentAuthority') && declaredBaseline
      ? `${currentAuthority} · ${declaredBaseline}`
      : currentAuthority;
    const evidence = this.catalogEvidence(definitionBody, facts);
    const requiredFactPaths = this.stringArrayValue(definitionBody, 'requiredFactPaths');
    return {
      order: index + 1,
      totalDecisions: total,
      key: candidate.ruleKey,
      code,
      name,
      domain: context,
      ruleSet: candidate.resourceKey?.trim() || candidate.serviceKey?.trim() || context,
      ruleSetKey,
      resourceKey,
      serviceKey: definition?.serviceKey?.trim() || candidate.serviceKey,
      state: ['approved', 'active'].includes(candidate.status) ? 'verified' : 'technical-draft',
      meaning,
      authority,
      baselineAuthority,
      source: this.stringValue(definitionBody, 'semanticSourceRef') ?? `definition:${candidate.definitionId}`,
      evidenceCount: evidence.length,
      authoringSupported,
      availableDefinitionActions,
      reviewStatus: authoringSupported ? 'CONFIG_GOVERNED' : 'CATALOG_IDENTITY_ONLY',
      configDefinitionId: candidate.definitionId,
      configVersion: candidate.version,
      configStatus: candidate.status,
      workspaceId: workspace?.id,
      workspaceStatus: workspace?.status,
      workspaceEtag: workspace?.etag,
      workspaceRevision: workspace?.revision,
      promotedDefinitionId: workspace?.promotedDefinitionId ?? null,
      workspaceCondition: workspace?.condition ?? null,
      workspaceParameters: workspace?.parameters ?? {},
      expression: formatDecisionExpression(definition?.condition),
      condition: definition?.condition ?? null,
      factPaths: factCatalog?.facts.length
        ? factCatalog.facts.map(fact => fact.path)
        : requiredFactPaths?.length
          ? requiredFactPaths
          : conditionFactPaths,
      facts,
      nullSemantics: this.stringValue(definition?.parameters, 'nullSemantics'),
      operationKeys: this.stringArrayValue(definition?.parameters, 'operationKeys') ?? [],
      hostContractVersion: this.stringValue(definition?.parameters, 'hostContractVersion'),
      evidence,
      draftLifecycle: this.stringValue(definition?.governance, 'lifecycleBoundary'),
      ruleType: definition?.ruleType ?? candidate.ruleType,
      parameters: definition?.parameters ?? {},
      parameterCatalog,
      detailHydrated: definition !== undefined
    };
  }

  private projectionFacts(
    factPaths: readonly string[],
    factSchemas: DomainProjection['factSchemas']
  ): DecisionSummary['facts'] {
    return factPaths
      .map(factPath => factSchemas.find(item => item.path === factPath))
      .filter((schema): schema is DomainProjection['factSchemas'][number] => schema !== undefined)
      .map(schema => ({
        path: schema.path,
        valueType: schema.valueType,
        nullable: schema.nullable,
        label: schema.presentationLabel,
        description: schema.description,
        providerRef: schema.providerRef,
        evidenceRefs: schema.evidenceRefs,
        sensitivity: 'NON_SENSITIVE' as const,
        redaction: 'NONE' as const
      }));
  }

  private decisionFacts(factCatalog: DomainRuleFactCatalog | undefined, locale: SupportedLocale): DecisionSummary['facts'] {
    return factCatalog?.facts.map(fact => ({
      path: fact.path,
      valueType: fact.valueType,
      nullable: fact.nullable,
      label: fact.labels[locale] ?? fact.labels['en-US'] ?? fact.path,
      description: fact.descriptions[locale] ?? fact.descriptions['en-US'] ?? '',
      providerRef: fact.providerRef,
      evidenceRefs: fact.evidenceRefs,
      sensitivity: fact.sensitivity,
      redaction: fact.redaction
    })) ?? [];
  }

  private catalogEvidence(
    definitionBody: Record<string, unknown> | null,
    facts: DecisionSummary['facts']
  ): DecisionSummary['evidence'] {
    const rawArtifacts = definitionBody?.['sourceArtifacts'];
    if (Array.isArray(rawArtifacts)) {
      const artifacts = rawArtifacts
        .map(item => this.record(item))
        .filter((item): item is Record<string, unknown> =>
          item !== null
          && typeof item['path'] === 'string' && item['path'].trim().length > 0
          && typeof item['kind'] === 'string' && item['kind'].trim().length > 0)
        .map(item => ({
          path: String(item['path']).trim(),
          kind: String(item['kind']).trim(),
          ...(typeof item['sha256'] === 'string' && item['sha256'].trim() ? { sha256: item['sha256'].trim() } : {})
        }));
      if (artifacts.length > 0) return artifacts;
    }
    const uniqueRefs = [...new Set(
      facts
        .flatMap(fact => fact.evidenceRefs)
        .filter((ref): ref is string => typeof ref === 'string' && ref.trim().length > 0)
        .map(ref => ref.trim())
    )];
    return uniqueRefs.map(path => ({ path, kind: 'FACT_PROVIDER_EVIDENCE' }));
  }

  private localizedText(value: unknown, locale: SupportedLocale): string | null {
    const record = this.record(value);
    if (!record) return null;
    return this.stringValue(record, locale) ?? this.stringValue(record, 'en-US') ?? this.stringValue(record, 'pt-BR');
  }

  private operationalPolicyString(
    parameters: Record<string, unknown> | null,
    field: 'code' | 'message'
  ): string | null {
    if (!parameters) return null;
    for (const slot of ['validationPolicy', 'approvalPolicy', 'availabilityPolicy']) {
      const policy = this.record(parameters[slot]);
      const text = this.stringValue(policy, field);
      if (text) return text;
    }
    return null;
  }

  private fixtureSummaries(projection: DomainProjection, locale: SupportedLocale): readonly DecisionSummary[] {
    return projection.decisionRefs.map(decision => ({
      order: decision.order,
      totalDecisions: projection.decisionRefs.length,
      key: decision.decisionKey,
      code: decision.reasonCode ?? decision.decisionKey,
      name: decision.presentationLabel,
      domain: projection.presentationLabels.domain[locale] ?? projection.ruleSetRef.boundedContextKey,
      ruleSet: projection.presentationLabels.ruleSet[locale] ?? projection.ruleSetRef.ruleSetKey,
      ruleSetKey: projection.ruleSetRef.ruleSetKey,
      resourceKey: projection.ruleSetRef.operationalResourceKey?.trim() || null,
      serviceKey: null,
      state: decision.semanticStatus === 'REFERENCE_IMPLEMENTED' ? 'verified' : 'technical-draft',
      meaning: decision.presentationLabel,
      authority: `${projection.authorityEvidence.currentAuthority} · ${projection.authorityEvidence.baselineAuthority}`,
      baselineAuthority: projection.authorityEvidence.baselineAuthority,
      source: decision.semanticSourceRef,
      evidenceCount: projection.sourceArtifacts.length,
      authoringSupported: false,
      availableDefinitionActions: [],
      reviewStatus: decision.reviewStatus,
      expression: null,
      condition: null,
      factPaths: decision.factPaths,
      facts: this.projectionFacts(decision.factPaths, projection.factSchemas),
      nullSemantics: null,
      operationKeys: projection.ruleSetRef.operationKeys,
      hostContractVersion: projection.ruleSetRef.hostContractVersion ?? null,
      evidence: projection.sourceArtifacts,
      draftLifecycle: null
    }));
  }

  createDefinition(
    request: DomainRuleDefinitionRequest,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleDefinition> {
    return this.domainRules.createDefinition(request, this.requestOptions(config));
  }

  createWorkspace(
    baseDefinitionId: string,
    title: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleChangeWorkspace> {
    return this.domainRules.createChangeWorkspace({ baseDefinitionId, title }, this.requestOptions(config));
  }

  saveWorkspaceDraft(
    workspace: Pick<DomainRuleChangeWorkspace, 'id' | 'etag' | 'parameters'>,
    condition: unknown,
    config: PolicyStudioRuntimeConfig,
    parameters?: Readonly<Record<string, unknown>>
  ): Observable<DomainRuleChangeWorkspace> {
    return this.domainRules.updateChangeWorkspaceDraft(workspace.id, {
      condition: this.record(condition),
      parameters: (parameters ?? workspace.parameters) as Record<string, unknown>,
      rationale: 'Policy Studio visual authoring round-trip'
    }, workspace.etag, this.requestOptions(config));
  }

  scenarios(workspaceId: string, config: PolicyStudioRuntimeConfig): Observable<DomainRuleTestScenario[]> {
    return this.domainRules.listTestScenarios(workspaceId, this.requestOptions(config));
  }

  workspaceCapabilities(
    workspaceId: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleWorkspaceCapabilities> {
    return this.domainRules.getChangeWorkspaceCapabilities(workspaceId, this.requestOptions(config));
  }

  createScenario(
    workspaceId: string,
    request: DomainRuleTestScenarioRequest,
    config: PolicyStudioRuntimeConfig
  ): Observable<{ readonly scenario: DomainRuleTestScenario; readonly workspace: DomainRuleChangeWorkspace }> {
    const options = this.requestOptions(config);
    return this.domainRules.createTestScenario(workspaceId, request, options).pipe(
      switchMap(scenario => this.domainRules.getChangeWorkspace(workspaceId, options).pipe(
        map(workspace => ({ scenario, workspace }))
      ))
    );
  }

  updateScenario(
    workspaceId: string,
    scenarioId: string,
    request: DomainRuleTestScenarioRequest,
    scenarioEtag: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<{ readonly scenario: DomainRuleTestScenario; readonly workspace: DomainRuleChangeWorkspace }> {
    const options = this.requestOptions(config);
    return this.domainRules.updateTestScenario(workspaceId, scenarioId, request, scenarioEtag, options).pipe(
      switchMap(scenario => this.domainRules.getChangeWorkspace(workspaceId, options).pipe(
        map(workspace => ({ scenario, workspace }))
      ))
    );
  }

  runSandbox(
    workspaceId: string,
    scenarioIds: readonly string[],
    idempotencyKey: string,
    evaluatedAtUtc: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<PolicySandboxRun> {
    const baseUrl = (config.configApiBaseUrl ?? '').replace(/\/$/, '');
    return this.http.post<PolicySandboxRun>(`${baseUrl}/api/praxis/policy-studio/sandbox/runs`, {
      workspaceId,
      scenarioIds,
      userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      idempotencyKey,
      evaluatedAtUtc
    });
  }

  operationalTestAction(
    resourceKey: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<ResourceActionCatalogItem | null> {
    return this.discovery.getActionsByResourceKey(resourceKey, this.requestOptions(config)).pipe(
      map(catalog => {
        const candidates = catalog.actions.filter(action =>
          action.tags.includes('policy-studio') && action.tags.includes('operational-proof'));
        if (candidates.length > 1) {
          throw new Error(`OPERATIONAL_ACTION_AMBIGUOUS ${resourceKey}`);
        }
        return candidates[0] ?? null;
      })
    );
  }

  runOperationalTest(
    action: ResourceActionCatalogItem,
    workspaceId: string,
    workspaceEtag: string,
    scenarios: readonly { readonly scenarioId: string; readonly operationMode: 'CREATE' | 'UPDATE' }[],
    idempotencyKey: string,
    evaluatedAtUtc: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<{ readonly run: DomainRuleTestRun; readonly workspaceEtag: string }> {
    const preconditions = action.execution?.preconditions;
    const targetIdField = preconditions?.resourceVersionTargetIdField?.trim();
    if (!action.availability.allowed
      || action.method.toUpperCase() !== 'POST'
      || preconditions?.resourceVersion !== 'REQUIRED'
      || preconditions.resourceVersionTransport !== 'IF_MATCH'
      || !preconditions.resourceVersionTargetResourceKey?.trim()
      || !targetIdField
      || preconditions.idempotencyKey !== 'REQUIRED') {
      return throwError(() => new Error('OPERATIONAL_ACTION_CONTRACT_UNAVAILABLE'));
    }
    const headers = new HttpHeaders()
      .set('If-Match', workspaceEtag)
      .set('Idempotency-Key', idempotencyKey)
      .set('X-Correlation-ID', createClientRequestId());
    const body: Record<string, unknown> = {
      [targetIdField]: workspaceId,
      scenarios,
      userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      evaluatedAtUtc
    };
    return this.http.request<RestApiResponse<DomainRuleTestRun>>(
      action.method,
      this.discovery.resolveHref(action.path, this.requestOptions(config)),
      { body, headers, observe: 'response' }
    ).pipe(map(response => {
      if (!response.body?.data) throw new Error('OPERATIONAL_TEST_RUN_MISSING');
      const nextEtag = response.headers.get('ETag')?.trim();
      if (!nextEtag) throw new Error('OPERATIONAL_WORKSPACE_ETAG_MISSING');
      return { run: response.body.data, workspaceEtag: nextEtag };
    }));
  }

  submitWorkspace(
    workspaceId: string,
    etag: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleChangeWorkspace> {
    return this.domainRules.submitChangeWorkspace(workspaceId, etag, this.requestOptions(config));
  }

  reviews(workspaceId: string, config: PolicyStudioRuntimeConfig) {
    return this.domainRules.listChangeWorkspaceReviews(workspaceId, this.requestOptions(config));
  }

  reviewWorkspace(
    workspaceId: string,
    etag: string,
    decision: 'APPROVE' | 'REJECT',
    rationale: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleChangeWorkspace> {
    const options = this.requestOptions(config);
    return this.domainRules.reviewChangeWorkspace(workspaceId, { decision, rationale }, etag, options).pipe(
      switchMap(() => this.domainRules.getChangeWorkspace(workspaceId, options))
    );
  }

  promoteWorkspace(
    workspaceId: string,
    etag: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleChangeWorkspace> {
    return this.domainRules.promoteChangeWorkspace(workspaceId, etag, this.requestOptions(config));
  }

  definitionActions(
    baseDefinitionId: string | null | undefined,
    ruleKey: string,
    baseVersion: number | null | undefined,
    promotedDefinitionId: string | null | undefined,
    config: PolicyStudioRuntimeConfig
  ): Observable<DecisionSummary['availableDefinitionActions']> {
    if (config.mode !== 'remote') return of([]);
    return this.domainRules.getDefinitionCapabilities(this.requestOptions(config)).pipe(
      map(capabilities => this.mergeDefinitionActions(
        capabilities,
        baseDefinitionId ?? null,
        ruleKey,
        baseVersion ?? null,
        promotedDefinitionId ?? null
      ))
    );
  }

  inspectPublicationReadiness(
    definitionId: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<PublicationReadiness> {
    return this.domainRules.simulate({ ruleDefinitionId: definitionId }, this.requestOptions(config)).pipe(
      map(simulation => ({
        result: simulation.result ?? null,
        readiness: this.stringValue(simulation.explainability, 'publicationReadiness'),
        existingCoverage: simulation.existingCoverage ?? [],
        predictedMaterializations: simulation.predictedMaterializations ?? [],
        requiredApprovals: simulation.requiredApprovals ?? [],
        warnings: simulation.warnings ?? [],
        recommendedAction: this.stringValue(simulation.explainability, 'recommendedAction')
      }))
    );
  }

  publishDefinition(
    definitionId: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DecisionPublicationResult> {
    return this.domainRules.publish({
      ruleDefinitionId: definitionId,
      applyEligibleMaterializations: true,
      publicationNotes: { source: 'praxis-policy-studio', intent: 'publish-governed-definition' }
    }, this.requestOptions(config)).pipe(map(publication => ({
      status: publication.publicationStatus ?? null,
      readiness: publication.publicationReadiness ?? null,
      materializationCount: publication.materializations?.length ?? 0,
      outcomes: publication.explainability?.publicationDiagnostics?.materializationOutcomes ?? []
    })));
  }

  lifecycle(
    workspaceId: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DecisionLifecycleSummary> {
    return this.domainRules.inspectChangeWorkspaceLifecycle(
      workspaceId,
      null,
      this.requestOptions(config)
    ).pipe(map(inspection => ({
      workspaceStatus: inspection.workspace.status,
      workspaceRevision: inspection.workspace.revision,
      testRunCount: inspection.testRuns.length,
      reviewCount: inspection.reviews.length,
      materializationCount: inspection.materializations.length,
      promotedDefinitionId: inspection.workspace.promotedDefinitionId ?? null,
      submittedTestRunId: inspection.workspace.submittedTestRunId,
      latestTestRun: inspection.testRuns[0] ?? null
    })));
  }

  snapshotCockpit(
    ruleSetKey: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<{
    readonly head: DomainRuleSnapshotHeadStatus | null;
    readonly versions: readonly DomainRuleSnapshotVersion[];
  }> {
    if (config.mode !== 'remote') return of({ head: null, versions: [] });
    const options = this.requestOptions(config);
    const head = this.domainRules.getSnapshotHeadStatus(ruleSetKey, options).pipe(
      catchError((error: unknown) => this.isMissingSnapshotHead(error)
        ? of(null)
        : throwError(() => error))
    );
    return forkJoin({
      head,
      versions: this.domainRules.listSnapshotVersions(ruleSetKey, 50, options)
    });
  }

  activeSnapshot(
    ruleSetKey: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleSnapshotActivation | null> {
    if (config.mode !== 'remote') return of(null);
    return this.domainRules.getSnapshotHead(ruleSetKey, this.requestOptions(config)).pipe(
      catchError((error: unknown) => this.isMissingSnapshotHead(error)
        ? of(null)
        : throwError(() => error))
    );
  }

  executionSummary(snapshotKey: string, config: PolicyStudioRuntimeConfig): Observable<DomainRuleExecutionSummary> {
    return this.domainRules.getSnapshotExecutionSummary(snapshotKey, this.requestOptions(config));
  }

  hostStatusSummary(ruleSetKey: string, config: PolicyStudioRuntimeConfig): Observable<DomainRuleHostStatusSummary> {
    return this.domainRules.getSnapshotHostStatusSummary(ruleSetKey, this.requestOptions(config));
  }

  rolloutPolicyCatalog(
    ruleSetKey: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleRolloutPolicyCatalog> {
    return this.domainRules.getRolloutPolicyCatalog(ruleSetKey, this.requestOptions(config));
  }

  rolloutPolicyTimeline(
    ruleSetKey: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<readonly DomainRuleRolloutPolicyEvent[]> {
    return this.domainRules.getRolloutPolicyTimeline(ruleSetKey, this.requestOptions(config));
  }

  createRolloutPolicy(
    request: DomainRuleRolloutPolicyCreateRequest,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleRolloutPolicyMutation> {
    return this.domainRules.createRolloutPolicy(request, this.requestOptions(config));
  }

  approveRolloutPolicy(
    policy: Pick<DomainRuleRolloutPolicy, 'policyId'>,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleRolloutPolicyMutation> {
    return this.domainRules.approveRolloutPolicy(policy.policyId, this.requestOptions(config));
  }

  activateRolloutPolicy(
    policy: Pick<DomainRuleRolloutPolicy, 'policyId'>,
    policyHeadEtag: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleRolloutPolicyMutation> {
    return this.domainRules.activateRolloutPolicy(policy.policyId, policyHeadEtag, this.requestOptions(config));
  }

  rolloutCatalog(ruleSetKey: string, config: PolicyStudioRuntimeConfig): Observable<DomainRuleRolloutCatalog> {
    return this.domainRules.getRolloutCatalog(ruleSetKey, this.requestOptions(config));
  }

  createRollout(
    candidateSnapshotKey: string,
    headEtag: string | null,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleRollout> {
    return this.domainRules.createRollout(
      { candidateSnapshotKey }, headEtag, this.requestOptions(config));
  }

  cancelRollout(
    rollout: Pick<DomainRuleRolloutCatalogItem, 'rollout'>,
    config: PolicyStudioRuntimeConfig
  ): Observable<void> {
    return this.domainRules.cancelRollout(rollout.rollout.rolloutId, this.requestOptions(config));
  }

  activateRolloutCandidate(
    rollout: Pick<DomainRuleRolloutCatalogItem, 'rollout'>,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleSnapshotActivation> {
    return this.domainRules.activateSnapshotCandidate(
      rollout.rollout.candidateSnapshotKey,
      rollout.rollout.expectedHeadEtag,
      rollout.rollout.rolloutId,
      this.requestOptions(config));
  }

  operateSnapshot(
    version: Pick<DomainRuleSnapshotVersion, 'snapshotKey' | 'availableAction'>,
    headEtag: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleSnapshotActivation> {
    const options = this.requestOptions(config);
    if (version.availableAction === 'ACTIVATE') {
      return this.domainRules.activateSnapshot(version.snapshotKey, headEtag, options);
    }
    if (version.availableAction === 'ROLLBACK') {
      return this.domainRules.rollbackSnapshot(version.snapshotKey, headEtag, options);
    }
    return throwError(() => new Error(`SNAPSHOT_ACTION_NOT_AVAILABLE ${version.availableAction}`));
  }

  prepareRuleSetCandidate(
    ruleSetKey: string,
    request: RuleSetCompositionCandidateRequest,
    config: PolicyStudioRuntimeConfig
  ): Observable<RuleSetCompositionCandidate> {
    const core = this.domainRules as unknown as {
      prepareRuleSetCandidate?: (
        key: string,
        body: RuleSetCompositionCandidateRequest,
        options: unknown
      ) => Observable<RuleSetCompositionCandidate>;
    };
    if (typeof core.prepareRuleSetCandidate === 'function') {
      return core.prepareRuleSetCandidate(ruleSetKey, request, this.requestOptions(config));
    }
    const baseUrl = (config.configApiBaseUrl ?? '').replace(/\/$/, '');
    return this.http.post<RuleSetCompositionCandidate>(
      `${baseUrl}/api/praxis/policy-studio/rule-sets/${encodeURIComponent(ruleSetKey)}/candidate`,
      request
    );
  }

  approveRuleSetCandidate(
    ruleSetKey: string,
    command: RuleSetCompositionCandidateCommand,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleCompositionApproval> {
    const core = this.domainRules as unknown as {
      approveRuleSetCandidate?: (
        key: string,
        body: RuleSetCompositionCandidateCommand,
        options: unknown
      ) => Observable<DomainRuleCompositionApproval>;
    };
    if (typeof core.approveRuleSetCandidate === 'function') {
      return core.approveRuleSetCandidate(ruleSetKey, command, this.requestOptions(config));
    }
    const baseUrl = (config.configApiBaseUrl ?? '').replace(/\/$/, '');
    return this.http.post<DomainRuleCompositionApproval>(
      `${baseUrl}/api/praxis/policy-studio/rule-sets/${encodeURIComponent(ruleSetKey)}/candidate/approvals`,
      command
    );
  }

  publishRuleSetCandidate(
    ruleSetKey: string,
    command: RuleSetCompositionCandidateCommand,
    currentHeadEtag: string | null,
    config: PolicyStudioRuntimeConfig
  ): Observable<RuleSetCompositionPublication> {
    const headers = this.candidateHeadPrecondition(currentHeadEtag);
    const core = this.domainRules as unknown as {
      publishRuleSetCandidate?: (
        key: string,
        body: RuleSetCompositionCandidateCommand,
        headEtag: string | null,
        options: unknown
      ) => Observable<RuleSetCompositionPublication>;
    };
    if (typeof core.publishRuleSetCandidate === 'function') {
      return core.publishRuleSetCandidate(ruleSetKey, command, currentHeadEtag, this.requestOptions(config));
    }
    const baseUrl = (config.configApiBaseUrl ?? '').replace(/\/$/, '');
    return this.http.post<RuleSetCompositionPublication>(
      `${baseUrl}/api/praxis/policy-studio/rule-sets/${encodeURIComponent(ruleSetKey)}/candidate/publish`,
      command,
      { headers }
    );
  }

  prepareSnapshotComposition(
    request: DomainRuleSnapshotCompositionRequest,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleCompositionManifest> {
    return this.domainRules.prepareSnapshotComposition(request, this.requestOptions(config));
  }

  approveSnapshotComposition(
    request: DomainRuleSnapshotCompositionRequest,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleCompositionApproval> {
    return this.domainRules.approveSnapshotComposition(request, this.requestOptions(config));
  }

  publishSnapshot(
    request: DomainRuleSnapshotPublicationRequest,
    currentHeadEtag: string | null,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleSnapshotStored> {
    return this.domainRules.publishSnapshot(request, currentHeadEtag, this.requestOptions(config));
  }

  timeline(definitionId: string, config: PolicyStudioRuntimeConfig): Observable<readonly DecisionTimelineEvent[]> {
    if (config.mode !== 'remote') return of([]);
    return this.domainRules.getDefinitionTimeline(definitionId, this.requestOptions(config)).pipe(
      map(response => response.events.map(event => ({
        eventType: event.eventType,
        occurredAt: event.occurredAt ?? '',
        summary: event.summary ?? event.eventType,
        status: null,
        actor: event.actor ?? null
      })))
    );
  }

  overlayParameterCatalog(
    catalog: DecisionParameterCatalog | null | undefined,
    parametersRecord: Readonly<Record<string, unknown>> | null | undefined
  ): DecisionParameterCatalog | null {
    if (!catalog) return null;
    const declaredValues = this.record(parametersRecord?.['parameterValues']);
    if (!declaredValues) return catalog;
    return {
      ...catalog,
      parameters: catalog.parameters.map(descriptor => {
        const hasDeclared = Object.prototype.hasOwnProperty.call(declaredValues, descriptor.name);
        if (!hasDeclared) return descriptor;
        const declaredValue = declaredValues[descriptor.name];
        return {
          ...descriptor,
          declaredValue,
          effectiveValue: declaredValue,
          origin: 'DECLARED'
        };
      })
    };
  }

  private candidateHeadPrecondition(headEtag: string | null): HttpHeaders {
    const headers = new HttpHeaders();
    const trimmed = headEtag?.trim() ?? '';
    if (!trimmed) {
      return headers.set('If-None-Match', '*');
    }
    if (/^W\//i.test(trimmed)) {
      throw new Error('Strong entity tag is required');
    }
    const strong = /^"[^"\r\n]*"$/.test(trimmed) ? trimmed : `"${trimmed}"`;
    return headers.set('If-Match', strong);
  }

  private hasParameterTemplate(definition: DomainRuleDefinition | undefined): boolean {
    const template = this.record(this.record(definition?.definition)?.['parameterTemplate']);
    return !!template && Array.isArray(template['parameters']);
  }

  private hasEditableOperationalPolicy(definition: DomainRuleDefinition | undefined): boolean {
    const parameters = this.record(definition?.parameters);
    if (!parameters) return false;
    return ['validationPolicy', 'availabilityPolicy', 'approvalPolicy']
      .some(slot => this.record(parameters[slot]) !== null);
  }

  private fetchDefinitionParameters(
    definitionId: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleParameterCatalog> {
    return this.domainRules.getDefinitionParameters(definitionId.trim(), this.requestOptions(config));
  }

  private parameterCatalog(
    definition: DomainRuleDefinition | undefined,
    serverCatalog?: DomainRuleParameterCatalog | null
  ): DecisionParameterCatalog | null {
    const template = this.record(this.record(definition?.definition)?.['parameterTemplate']);
    const rawParameters = Array.isArray(template?.['parameters'])
      ? (template!['parameters'] as unknown[])
      : [];
    const uiMetadata = new Map<string, { label: string | null; description: string | null }>();
    rawParameters
      .map(item => this.record(item))
      .filter((item): item is Record<string, unknown> => item !== null && typeof item['name'] === 'string')
      .forEach(item => {
        uiMetadata.set(String(item['name']).trim(), {
          label: this.stringValue(item, 'label'),
          description: this.stringValue(item, 'description')
        });
      });

    if (!serverCatalog || serverCatalog.parameters.length === 0) return null;
    return {
      definitionId: serverCatalog.definitionId,
      ruleKey: serverCatalog.ruleKey,
      version: serverCatalog.definitionVersion ?? definition?.version ?? 1,
      schemaVersion: serverCatalog.schemaVersion,
      templateKey: serverCatalog.templateKey,
      templateVersion: serverCatalog.templateVersion,
      parameters: serverCatalog.parameters.map((param: DomainRuleParameterDescriptor) => {
        const meta = uiMetadata.get(param.name);
        return {
          name: param.name,
          label: meta?.label ?? null,
          description: meta?.description ?? null,
          type: param.type,
          required: param.required,
          nullable: param.nullable,
          readOnly: param.readOnly,
          defaultValue: param.defaultValue,
          declaredValue: param.declaredValue,
          effectiveValue: param.effectiveValue,
          minimum: param.minimum ?? null,
          maximum: param.maximum ?? null,
          allowedValues: param.allowedValues ?? undefined,
          unit: param.unit ?? null,
          origin: param.origin
        };
      })
    };
  }

  private latestWorkspace(
    workspaces: readonly DomainRuleChangeWorkspace[],
    ruleKey: string
  ): DomainRuleChangeWorkspace | undefined {
    return workspaces
      .filter(item => item.ruleKey === ruleKey)
      .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))[0];
  }

  private mergeDefinitionActions(
    definitionCapabilities: DomainRuleDefinitionCapabilities,
    baseDefinitionId: string | null,
    ruleKey: string,
    baseVersion: number | null,
    promotedDefinitionId: string | null
  ): DecisionSummary['availableDefinitionActions'] {
    const baseCapability = definitionCapabilities.definitions.find(capability =>
      capability.definitionId === baseDefinitionId
      && capability.ruleKey === ruleKey
      && (baseVersion === null || capability.version === baseVersion));
    const promotedCapability = promotedDefinitionId
      ? definitionCapabilities.definitions.find(capability =>
          capability.definitionId === promotedDefinitionId
          && capability.ruleKey === ruleKey)
      : undefined;
    return [...new Set([
      ...(baseCapability?.availableActions ?? []),
      ...(promotedCapability?.availableActions ?? [])
    ])];
  }

  private requestOptions(config: PolicyStudioRuntimeConfig): DomainRuleRequestOptions {
    return { apiUrlEntry: { baseUrl: config.configApiBaseUrl ?? '' } };
  }

  private isMissingSnapshotHead(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 404;
  }

  private stringValue(record: Record<string, unknown> | null | undefined, key: string): string | null {
    const value = record?.[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private stringArrayValue(
    record: Record<string, unknown> | null | undefined,
    key: string
  ): readonly string[] | null {
    const value = record?.[key];
    return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : null;
  }

  private record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }
}
