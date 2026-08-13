import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map, Observable, of } from 'rxjs';
import { PolicyStudioRuntimeConfig, SupportedLocale } from './runtime-config';
import { validateDomainProjection } from './domain-projection';
import { DecisionSummary, DecisionTimelineEvent } from '../features/catalog/catalog.fixture';
import { collectFactPaths, formatDecisionExpression } from './decision-inspection';

export interface ConfigDefinition {
  readonly id: string;
  readonly ruleKey: string;
  readonly version: number;
  readonly status: string;
  readonly condition?: unknown;
  readonly parameters?: {
    readonly nullSemantics?: string;
    readonly operationKeys?: readonly string[];
    readonly hostContractVersion?: string;
  };
  readonly governance?: { readonly lifecycleBoundary?: string };
}

interface ConfigDefinitionCapabilities {
  readonly definitions: readonly {
    readonly definitionId: string;
    readonly ruleKey: string;
    readonly version: number;
    readonly availableActions: readonly string[];
  }[];
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
    const capabilities = config.mode === 'remote'
      ? this.http.get<ConfigDefinitionCapabilities>(
          `${config.configApiBaseUrl}/api/praxis/config/domain-rules/definitions/capabilities`,
          { withCredentials: true })
      : of({ definitions: [] } as ConfigDefinitionCapabilities);
    return forkJoin({ projection: this.http.get<unknown>(path).pipe(map(validateDomainProjection)), definitions, capabilities }).pipe(
      map(({ projection, definitions, capabilities }) => projection.decisionRefs.map(decision => {
        const definition = latestDefinition(definitions, decision.decisionKey);
        const availableActions = definition
          ? capabilities.definitions.find(item => item.definitionId === definition.id)?.availableActions ?? []
          : [];
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
          code: decision.reasonCode,
          name: decision.presentationLabel,
          domain: projection.presentationLabels.domain[locale] ?? projection.ruleSetRef.boundedContextKey,
          ruleSet: projection.presentationLabels.ruleSet[locale] ?? projection.ruleSetRef.ruleSetKey,
          state: decision.semanticStatus === 'TECHNICAL_DRAFT_READY' ? 'technical-draft' as const : 'verified' as const,
          meaning: decision.presentationLabel,
          authority: `${projection.authorityEvidence.currentAuthority} · ${projection.authorityEvidence.legacyAuthority}`,
          source: decision.semanticSourceRef,
          evidenceCount: projection.sourceArtifacts.length,
          editable: decision.editable && availableActions.includes('CREATE_NEW_VERSION'),
          availableActions,
          reviewStatus: decision.reviewStatus,
          configDefinitionId: definition?.id,
          configStatus: definition?.status,
          expression: formatDecisionExpression(definition?.condition),
          condition: definition?.condition ?? null,
          factPaths: conditionFactPaths.length ? conditionFactPaths : decision.factPaths,
          facts,
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

export function latestDefinition(
  definitions: readonly ConfigDefinition[], ruleKey: string
): ConfigDefinition | undefined {
  return definitions
    .filter(item => item.ruleKey === ruleKey)
    .reduce<ConfigDefinition | undefined>((latest, item) =>
      !latest || item.version > latest.version ? item : latest, undefined);
}
