export const PROJECTION_KIND = 'ERGONX_POLICY_STUDIO_PROJECTION_V1';

export function validateProjection(projection) {
  const errors = [];
  if (!projection || typeof projection !== 'object') errors.push('DOCUMENT_REQUIRED');
  if (projection?.kind !== PROJECTION_KIND && projection?.kind !== 'POLICY_STUDIO_PROJECTION_V1') errors.push('KIND_UNSUPPORTED');
  if (!projection?.projectionId || !projection?.projectionVersion) errors.push('IDENTITY_REQUIRED');
  if (!projection?.ruleSetRef?.domainKey || !projection?.ruleSetRef?.ruleSetKey) errors.push('RULESET_REQUIRED');
  if (projection?.ruleSetRef?.operationalResourceKey !== undefined &&
      !projection.ruleSetRef.operationalResourceKey?.trim?.()) errors.push('OPERATIONAL_RESOURCE_INVALID');
  if (!Array.isArray(projection?.decisionRefs) || projection.decisionRefs.length === 0) errors.push('DECISIONS_REQUIRED');
  if (!Array.isArray(projection?.sourceArtifacts) || projection.sourceArtifacts.length === 0) errors.push('SOURCES_REQUIRED');
  if (projection?.sourceArtifacts?.some(item => !/^[A-Fa-f0-9]{64}$/.test(item.sha256))) errors.push('SOURCE_DIGEST_INVALID');
  if (!Array.isArray(projection?.factSchemas) || projection.factSchemas.length === 0) errors.push('FACT_SCHEMAS_REQUIRED');

  const decisions = Array.isArray(projection?.decisionRefs) ? projection.decisionRefs : [];
  const keys = decisions.map(item => item.decisionKey);
  const orders = decisions.map(item => item.order);
  if (new Set(keys).size !== keys.length) errors.push('DECISION_KEY_DUPLICATE');
  if (new Set(orders).size !== orders.length) errors.push('DECISION_ORDER_DUPLICATE');
  if (orders.some((order, index) => order !== index + 1)) errors.push('DECISION_ORDER_NOT_TOTAL');
  if (decisions.some(item => !['TECHNICAL_DRAFT_READY', 'REFERENCE_IMPLEMENTED'].includes(item.semanticStatus))) {
    errors.push('DECISION_SEMANTIC_STATUS_UNSUPPORTED');
  }
  if (decisions.some(item => !item.presentationLabel || !item.semanticSourceRef || !Array.isArray(item.factPaths))) {
    errors.push('DECISION_REFERENCE_INCOMPLETE');
  }
  const factSchemas = Array.isArray(projection?.factSchemas) ? projection.factSchemas : [];
  const factPaths = factSchemas.map(item => item.path);
  if (new Set(factPaths).size !== factPaths.length) errors.push('FACT_SCHEMA_PATH_DUPLICATE');
  if (factSchemas.some(item => !item.path || !['boolean', 'string', 'number', 'date', 'string-array', 'date-array'].includes(item.valueType) ||
      typeof item.nullable !== 'boolean' || !item.presentationLabel || !item.description ||
      !item.providerRef || !Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0)) {
    errors.push('FACT_SCHEMA_INCOMPLETE');
  }
  const requiredFactPaths = new Set(decisions.flatMap(item => Array.isArray(item.factPaths) ? item.factPaths : []));
  if ([...requiredFactPaths].some(factPath => !factPaths.includes(factPath))) {
    errors.push('FACT_SCHEMA_COVERAGE_INCOMPLETE');
  }
  if (!projection?.authorityEvidence?.currentAuthority?.trim?.() ||
      !projection?.authorityEvidence?.baselineAuthority?.trim?.() ||
      projection?.authorityEvidence?.productionAuthorityChanged !== false) {
    errors.push('AUTHORITY_BOUNDARY_INVALID');
  }
  if (!Array.isArray(projection?.evidenceBoundaries) || projection.evidenceBoundaries.length === 0) {
    errors.push('EVIDENCE_BOUNDARIES_REQUIRED');
  }
  return errors;
}
