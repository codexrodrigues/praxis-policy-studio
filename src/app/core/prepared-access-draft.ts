import type { DomainRuleDefinitionRequest } from '@praxisui/core';

export const AUTHORIZATION_RULE_TYPE = 'authorization_policy';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_ACCESS_OBJECT');
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('MISSING_ACCESS_VALUE');
  return value;
}

function entries(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.length) throw new Error('MISSING_ACCESS_ENTRIES');
  return value.map(object);
}

function modes(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length) throw new Error('MISSING_ACCESS_MODE');
  return value.map(text);
}

// Recognizes the portion of the policy that this review screen can explain.
// Config owns canonical validation and the host owns target/fact admission.
export function accessPreview(value: unknown) {
  const definition = object(value);
  if (definition['schemaVersion'] !== 'praxis.authorization-policy/v1') throw new Error('ACCESS_SCHEMA_REQUIRED');
  const targets = entries(definition['targets']).map(target => {
    if (target['kind'] !== 'EXACT') throw new Error('EXACT_ACCESS_TARGET_REQUIRED');
    return { point: text(target['pointKey']), digest: text(target['expectedDescriptorDigest']), modes: modes(target['evaluationModes']) };
  });
  const rules = entries(definition['rules']).map(rule => {
    const contributions = object(rule['contributions']);
    const access = object(contributions['access']);
    if (contributions['dataScope'] != null || ['fieldUse', 'fieldWrite', 'mask'].some(key => {
      const other = contributions[key];
      return other != null && !(Array.isArray(other) && other.length === 0);
    })) throw new Error('ACCESS_ONLY_REQUIRED');
    return {
      id: text(rule['ruleId']), modes: modes(rule['evaluationModes']), authority: text(access['authority']),
      effect: text(access['effect']), reason: text(contributions['reasonCode'])
    };
  });
  const artifacts = entries(definition['materializationTargets']).map(target => {
    if (target['targetLayer'] !== 'policy_engine' || target['targetArtifactType'] !== 'opa-policy') {
      throw new Error('OPA_TARGET_REQUIRED');
    }
    return text(target['targetArtifactKey']);
  });
  return { title: text(definition['title']), policyId: text(definition['policyId']), version: text(definition['version']), targets, rules, artifacts };
}

// Only draft input is accepted. Reject server-owned fields (scope, principal,
// approval, validation results) instead of silently dropping parts of a file.
const inputFields = new Set([
  'ruleKey', 'version', 'ruleType', 'status', 'contextKey', 'resourceKey', 'serviceKey', 'definition',
  'parameters', 'governance', 'condition', 'sourceReleaseId', 'sourceChangeSetId', 'semanticOwner', 'steward'
]);

export function readPreparedAccessDraft(source: string) {
  const input = object(JSON.parse(source, (_, value: unknown) => {
    if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) {
      throw new Error('ACCESS_VALUE_OUTSIDE_JSON_NUMBER_PRECISION');
    }
    return value;
  }));
  if (Object.keys(input).some(key => !inputFields.has(key)) || input['ruleType'] !== AUTHORIZATION_RULE_TYPE
    || input['condition'] != null || input['status'] !== 'draft' || !Number.isSafeInteger(input['version']) || Number(input['version']) < 1) {
    throw new Error('PREPARED_ACCESS_DRAFT_REQUIRED');
  }
  text(input['ruleKey']);
  text(input['serviceKey']);
  text(input['resourceKey']);
  const preview = accessPreview(input['definition']);
  return { request: input as unknown as DomainRuleDefinitionRequest, preview };
}
