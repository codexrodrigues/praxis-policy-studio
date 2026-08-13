export interface DomainProjection {
  readonly kind: string;
  readonly projectionId: string;
  readonly projectionVersion: number;
  readonly sourceArtifacts: readonly { readonly path: string; readonly kind: string; readonly sha256: string }[];
  readonly ruleSetRef: {
    readonly domainKey: string;
    readonly boundedContextKey: string;
    readonly ruleSetKey: string;
    readonly hostContractVersion?: string;
    readonly operationKeys: readonly string[];
  };
  readonly decisionRefs: readonly ProjectionDecisionRef[];
  readonly factSchemas: readonly ProjectionFactSchema[];
  readonly configDefinitionRefs: { readonly status: string; readonly definitionIds: readonly string[] };
  readonly presentationLabels: {
    readonly domain: Record<string, string>;
    readonly ruleSet: Record<string, string>;
  };
  readonly evidenceBoundaries: readonly { readonly boundary: string; readonly operations: readonly string[]; readonly status: string }[];
  readonly authorityEvidence: {
    readonly currentAuthority: string;
    readonly baselineAuthority: string;
    readonly productionAuthorityChanged: false;
  };
}

export interface ProjectionDecisionRef {
  readonly order: number;
  readonly decisionKey: string;
  readonly reasonCode: string | null;
  readonly presentationLabel: string;
  readonly semanticStatus: string;
  readonly reviewStatus: string;
  readonly semanticSourceRef: string;
  readonly targetPlanRef: string;
  readonly editable: boolean;
  readonly factPaths: readonly string[];
  readonly stage?: string;
  readonly cardinality?: string;
  readonly overridePolicy?: string;
  readonly bindingRefs?: readonly {
    readonly bindingKey: string;
    readonly source: string;
    readonly executorType: string;
    readonly order: number;
  }[];
}

export type ProjectionFactValueType = 'boolean' | 'string' | 'number' | 'date' | 'string-array' | 'date-array';

export interface ProjectionFactSchema {
  readonly path: string;
  readonly valueType: ProjectionFactValueType;
  readonly nullable: boolean;
  readonly presentationLabel: string;
  readonly description: string;
  readonly locale: 'pt-BR' | 'en-US';
  readonly providerRef: string;
  readonly evidenceRefs: readonly string[];
}

export function validateDomainProjection(value: unknown): DomainProjection {
  if (!value || typeof value !== 'object') throw new Error('PROJECTION_DOCUMENT_REQUIRED');
  const projection = value as Partial<DomainProjection>;
  if (!projection.projectionId || !projection.ruleSetRef?.domainKey || !projection.ruleSetRef.ruleSetKey) {
    throw new Error('PROJECTION_IDENTITY_REQUIRED');
  }
  if (!projection.decisionRefs?.length) throw new Error('PROJECTION_DECISIONS_REQUIRED');
  if (!projection.factSchemas?.length) throw new Error('PROJECTION_FACT_SCHEMAS_REQUIRED');
  if (!projection.sourceArtifacts?.length || projection.sourceArtifacts.some(item => !/^[A-Fa-f0-9]{64}$/.test(item.sha256))) {
    throw new Error('PROJECTION_SOURCE_DIGEST_INVALID');
  }
  const decisions = projection.decisionRefs;
  if (new Set(decisions.map(item => item.decisionKey)).size !== decisions.length) throw new Error('PROJECTION_DECISION_DUPLICATE');
  if (decisions.some((item, index) => item.order !== index + 1)) throw new Error('PROJECTION_ORDER_INVALID');
  if (decisions.some(item => !['TECHNICAL_DRAFT_READY', 'REFERENCE_IMPLEMENTED'].includes(item.semanticStatus))) {
    throw new Error('PROJECTION_SEMANTIC_STATUS_UNSUPPORTED');
  }
  const factPaths = projection.factSchemas.map(item => item.path);
  if (new Set(factPaths).size !== factPaths.length) throw new Error('PROJECTION_FACT_SCHEMA_DUPLICATE');
  if (projection.factSchemas.some(item => !item.presentationLabel || !item.description || !item.providerRef ||
      !item.evidenceRefs?.length || !['boolean', 'string', 'number', 'date', 'string-array', 'date-array'].includes(item.valueType) ||
      typeof item.nullable !== 'boolean')) {
    throw new Error('PROJECTION_FACT_SCHEMA_INVALID');
  }
  if (decisions.some(item => !Array.isArray(item.factPaths) || item.factPaths.some(factPath => !factPaths.includes(factPath)))) {
    throw new Error('PROJECTION_FACT_SCHEMA_COVERAGE_INVALID');
  }
  if (!projection.authorityEvidence?.currentAuthority?.trim() ||
      !projection.authorityEvidence.baselineAuthority?.trim() ||
      projection.authorityEvidence.productionAuthorityChanged !== false) {
    throw new Error('PROJECTION_AUTHORITY_INVALID');
  }
  return projection as DomainProjection;
}
