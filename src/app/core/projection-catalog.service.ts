import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap, throwError } from 'rxjs';
import { PolicyStudioRuntimeConfig, SupportedLocale } from './runtime-config';
import { validateDomainProjection } from './domain-projection';
import {
  DecisionLifecycleSummary,
  DecisionPublicationResult,
  DecisionSummary,
  DecisionTimelineEvent,
  PolicySandboxRun,
  PublicationReadiness
} from '../features/catalog/catalog.fixture';
import { collectFactPaths, formatDecisionExpression } from './decision-inspection';
import {
  DomainRuleService,
  type DomainRuleChangeWorkspace,
  type DomainRuleDefinition,
  type DomainRuleRequestOptions,
  type DomainRuleSnapshotActivation,
  type DomainRuleExecutionSummary,
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
  type DomainRuleTestScenarioRequest
} from '@praxisui/core';

@Injectable({ providedIn: 'root' })
export class ProjectionCatalogService {
  private readonly http = inject(HttpClient);
  private readonly domainRules = inject(DomainRuleService);

  load(path: string, locale: SupportedLocale, config: PolicyStudioRuntimeConfig): Observable<readonly DecisionSummary[]> {
    const definitions = config.mode === 'remote'
      ? this.domainRules.listDefinitions({}, this.requestOptions(config))
      : of([] as readonly DomainRuleDefinition[]);
    const workspaces = config.mode === 'remote'
      ? this.domainRules.listChangeWorkspaces(this.requestOptions(config))
      : of([] as readonly DomainRuleChangeWorkspace[]);
    return forkJoin({ projection: this.http.get<unknown>(path).pipe(map(validateDomainProjection)), definitions, workspaces }).pipe(
      switchMap(({ projection, definitions, workspaces }) => {
        const selectedDefinitions = projection.decisionRefs.map(decision =>
          this.latestDefinition(definitions, decision.decisionKey));
        const detailReads = selectedDefinitions.map(definition => definition && config.mode === 'remote'
          ? this.domainRules.getDefinition(definition.id, this.requestOptions(config))
          : of(definition));
        return (detailReads.length ? forkJoin(detailReads) : of([])).pipe(map(definitionDetails =>
          projection.decisionRefs.map((decision, index) => {
        const definition = definitionDetails[index];
        const workspace = this.latestWorkspace(workspaces, decision.decisionKey);
        const conditionFactPaths = collectFactPaths(definition?.condition);
        if (conditionFactPaths.some(factPath => !decision.factPaths.includes(factPath))) {
          throw new Error(`CONFIG_FACT_OUTSIDE_GOVERNED_PROJECTION ${decision.decisionKey}`);
        }
        const facts = decision.factPaths.map(factPath => {
          const schema = projection.factSchemas.find(item => item.path === factPath);
          if (!schema) throw new Error(`PROJECTION_FACT_SCHEMA_MISSING ${factPath}`);
          return {
            path: schema.path,
            valueType: schema.valueType,
            nullable: schema.nullable,
            label: schema.presentationLabel,
            description: schema.description,
            providerRef: schema.providerRef
          };
        });
        return {
          order: decision.order,
          totalDecisions: projection.decisionRefs.length,
          key: decision.decisionKey,
          code: decision.reasonCode ?? decision.decisionKey,
          name: decision.presentationLabel,
          domain: projection.presentationLabels.domain[locale] ?? projection.ruleSetRef.boundedContextKey,
          ruleSet: projection.presentationLabels.ruleSet[locale] ?? projection.ruleSetRef.ruleSetKey,
          ruleSetKey: projection.ruleSetRef.ruleSetKey,
          state: decision.semanticStatus === 'REFERENCE_IMPLEMENTED' ? 'verified' as const : 'technical-draft' as const,
          meaning: decision.presentationLabel,
          authority: `${projection.authorityEvidence.currentAuthority} · ${projection.authorityEvidence.baselineAuthority}`,
          baselineAuthority: projection.authorityEvidence.baselineAuthority,
          source: decision.semanticSourceRef,
          evidenceCount: projection.sourceArtifacts.length,
          editable: decision.editable,
          reviewStatus: decision.reviewStatus,
          configDefinitionId: definition?.id,
          configStatus: definition?.status ?? undefined,
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
          draftLifecycle: this.stringValue(definition?.governance, 'lifecycleBoundary')
        };
      })));
      })
    );
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
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleChangeWorkspace> {
    return this.domainRules.updateChangeWorkspaceDraft(workspace.id, {
      condition: this.record(condition),
      parameters: workspace.parameters,
      rationale: 'Policy Studio visual authoring round-trip'
    }, workspace.etag, this.requestOptions(config));
  }

  scenarios(workspaceId: string, config: PolicyStudioRuntimeConfig): Observable<DomainRuleTestScenario[]> {
    return this.domainRules.listTestScenarios(workspaceId, this.requestOptions(config));
  }

  createScenario(
    workspaceId: string,
    request: DomainRuleTestScenarioRequest,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleTestScenario> {
    return this.domainRules.createTestScenario(workspaceId, request, this.requestOptions(config));
  }

  runSandbox(
    workspaceId: string,
    scenarioIds: readonly string[],
    config: PolicyStudioRuntimeConfig
  ): Observable<PolicySandboxRun> {
    const baseUrl = (config.configApiBaseUrl ?? '').replace(/\/$/, '');
    return this.http.post<PolicySandboxRun>(`${baseUrl}/api/praxis/policy-studio/sandbox/runs`, {
      workspaceId,
      scenarioIds,
      userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    });
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
      promotedDefinitionId: inspection.workspace.promotedDefinitionId ?? null
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
    headEtag: string,
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

  private latestDefinition(
    definitions: readonly DomainRuleDefinition[],
    ruleKey: string
  ): DomainRuleDefinition | undefined {
    return definitions
      .filter(item => item.ruleKey === ruleKey)
      .sort((left, right) => (right.version ?? 0) - (left.version ?? 0))[0];
  }

  private latestWorkspace(
    workspaces: readonly DomainRuleChangeWorkspace[],
    ruleKey: string
  ): DomainRuleChangeWorkspace | undefined {
    return workspaces
      .filter(item => item.ruleKey === ruleKey)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
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
