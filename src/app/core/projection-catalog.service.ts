import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map, Observable, of } from 'rxjs';
import { PolicyStudioRuntimeConfig, SupportedLocale } from './runtime-config';
import { validateDomainProjection } from './domain-projection';
import { DecisionSummary, DecisionTimelineEvent } from '../features/catalog/catalog.fixture';
import { collectFactPaths, formatDecisionExpression } from './decision-inspection';

interface ConfigDefinition {
  readonly id: string;
  readonly ruleKey: string;
  readonly status: string;
  readonly condition?: unknown;
  readonly parameters?: {
    readonly nullSemantics?: string;
    readonly operationKeys?: readonly string[];
    readonly hostContractVersion?: string;
  };
  readonly governance?: { readonly lifecycleBoundary?: string };
}

interface ConfigTimeline {
  readonly events: readonly DecisionTimelineEvent[];
}

@Injectable({ providedIn: 'root' })
export class ProjectionCatalogService {
  private readonly http = inject(HttpClient);

  load(path: string, locale: SupportedLocale, config: PolicyStudioRuntimeConfig): Observable<readonly DecisionSummary[]> {
    const definitions = config.mode === 'remote'
      ? this.http.get<readonly ConfigDefinition[]>(`${config.configApiBaseUrl}/api/praxis/config/domain-rules/definitions`, {
          withCredentials: true
        })
      : of([] as readonly ConfigDefinition[]);
    return forkJoin({ projection: this.http.get<unknown>(path).pipe(map(validateDomainProjection)), definitions }).pipe(
      map(({ projection, definitions }) => projection.decisionRefs.map(decision => {
        const definition = definitions.find(item => item.ruleKey === decision.decisionKey);
        return {
          order: decision.order,
          totalDecisions: projection.decisionRefs.length,
          key: decision.decisionKey,
          code: decision.reasonCode,
          name: decision.presentationLabel,
          domain: projection.presentationLabels.domain[locale] ?? projection.ruleSetRef.boundedContextKey,
          ruleSet: projection.presentationLabels.ruleSet[locale] ?? projection.ruleSetRef.ruleSetKey,
          state: decision.semanticStatus === 'TECHNICAL_DRAFT_READY' ? 'technical-draft' as const : 'verified' as const,
          meaning: decision.presentationLabel,
          authority: `${projection.authorityEvidence.currentAuthority} · ${projection.authorityEvidence.legacyAuthority}`,
          source: decision.semanticSourceRef,
          evidenceCount: projection.sourceArtifacts.length,
          editable: decision.editable,
          reviewStatus: decision.reviewStatus,
          configDefinitionId: definition?.id,
          configStatus: definition?.status,
          expression: formatDecisionExpression(definition?.condition),
          factPaths: collectFactPaths(definition?.condition),
          nullSemantics: definition?.parameters?.nullSemantics ?? null,
          operationKeys: definition?.parameters?.operationKeys ?? projection.ruleSetRef.operationKeys,
          hostContractVersion: definition?.parameters?.hostContractVersion ?? projection.ruleSetRef.hostContractVersion ?? null,
          evidence: projection.sourceArtifacts,
          draftLifecycle: definition?.governance?.lifecycleBoundary ?? null
        };
      }))
    );
  }

  timeline(definitionId: string, config: PolicyStudioRuntimeConfig): Observable<readonly DecisionTimelineEvent[]> {
    if (config.mode !== 'remote') return of([]);
    return this.http.get<ConfigTimeline>(
      `${config.configApiBaseUrl}/api/praxis/config/domain-rules/definitions/${encodeURIComponent(definitionId)}/timeline`,
      { withCredentials: true }
    ).pipe(map(response => response.events));
  }
}
