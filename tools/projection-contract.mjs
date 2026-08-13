export const PROJECTION_KIND = 'ERGONX_POLICY_STUDIO_PROJECTION_V1';

export function validateProjection(projection) {
  const errors = [];
  if (!projection || typeof projection !== 'object') errors.push('DOCUMENT_REQUIRED');
  if (projection?.kind !== PROJECTION_KIND && projection?.kind !== 'POLICY_STUDIO_PROJECTION_V1') errors.push('KIND_UNSUPPORTED');
  if (!projection?.projectionId || !projection?.projectionVersion) errors.push('IDENTITY_REQUIRED');
  if (!projection?.ruleSetRef?.ruleSetKey) errors.push('RULESET_REQUIRED');
  if (!Array.isArray(projection?.decisionRefs) || projection.decisionRefs.length === 0) errors.push('DECISIONS_REQUIRED');
  if (!Array.isArray(projection?.sourceArtifacts) || projection.sourceArtifacts.length === 0) errors.push('SOURCES_REQUIRED');
  if (!Array.isArray(projection?.factSchemas) || projection.factSchemas.length === 0) errors.push('FACT_SCHEMAS_REQUIRED');

  const decisions = Array.isArray(projection?.decisionRefs) ? projection.decisionRefs : [];
  const keys = decisions.map(item => item.decisionKey);
  const orders = decisions.map(item => item.order);
  if (new Set(keys).size !== keys.length) errors.push('DECISION_KEY_DUPLICATE');
  if (new Set(orders).size !== orders.length) errors.push('DECISION_ORDER_DUPLICATE');
  if (orders.some((order, index) => order !== index + 1)) errors.push('DECISION_ORDER_NOT_TOTAL');
  if (decisions.some(item => !item.reasonCode || !item.presentationLabel || !item.semanticSourceRef)) {
    errors.push('DECISION_REFERENCE_INCOMPLETE');
  }
  const factSchemas = Array.isArray(projection?.factSchemas) ? projection.factSchemas : [];
  const factPaths = factSchemas.map(item => item.path);
  if (new Set(factPaths).size !== factPaths.length) errors.push('FACT_SCHEMA_PATH_DUPLICATE');
  if (factSchemas.some(item => !item.path || !['number', 'date'].includes(item.valueType) ||
      typeof item.nullable !== 'boolean' || !item.presentationLabel || !item.description ||
      !item.providerRef || !Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0)) {
    errors.push('FACT_SCHEMA_INCOMPLETE');
  }
  const requiredFactPaths = new Set(decisions.flatMap(item => Array.isArray(item.factPaths) ? item.factPaths : []));
  if (decisions.some(item => !Array.isArray(item.factPaths) || item.factPaths.length === 0) ||
      [...requiredFactPaths].some(factPath => !factPaths.includes(factPath))) {
    errors.push('FACT_SCHEMA_COVERAGE_INCOMPLETE');
  }
  if (projection?.authorityEvidence?.currentAuthority !== 'KEEP_DB_BACKED' ||
      projection?.authorityEvidence?.legacyAuthority !== 'LEGACY_AUTHORITATIVE') {
    errors.push('AUTHORITY_BOUNDARY_INVALID');
  }
  if (!Array.isArray(projection?.evidenceBoundaries) || projection.evidenceBoundaries.length === 0) {
    errors.push('EVIDENCE_BOUNDARIES_REQUIRED');
  }
  return errors;
}
