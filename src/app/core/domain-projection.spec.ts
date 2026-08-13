import { describe, expect, it } from 'vitest';
import { validateDomainProjection } from './domain-projection';

const valid = {
  kind: 'POLICY_STUDIO_PROJECTION_V1',
  projectionId: 'fixture.domain.rules',
  projectionVersion: 1,
  sourceArtifacts: [{ path: 'fixture', kind: 'FIXTURE', sha256: 'A'.repeat(64) }],
  ruleSetRef: { boundedContextKey: 'fixture.domain', ruleSetKey: 'fixture.rules', operationKeys: ['evaluate'] },
  decisionRefs: [{
    order: 1, decisionKey: 'fixture.decision', reasonCode: 'FIXTURE-1', presentationLabel: 'Fixture decision',
    semanticStatus: 'TECHNICAL_DRAFT_READY', reviewStatus: 'BUSINESS_REVIEW_PENDING',
    semanticSourceRef: 'fixture#decision', targetPlanRef: 'fixture#target', editable: false, factPaths: ['fixture.amount']
  }],
  factSchemas: [{
    path: 'fixture.amount', valueType: 'number', nullable: true, presentationLabel: 'Amount',
    description: 'Amount evaluated by the fixture decision.', locale: 'pt-BR', providerRef: 'Fixture.amount',
    evidenceRefs: ['fixture.fact-provider-evidence.json']
  }],
  configDefinitionRefs: { status: 'CONTRACTUAL_FIXTURE', definitionIds: ['fixture'] },
  presentationLabels: { domain: { 'en-US': 'Fixture' }, ruleSet: { 'en-US': 'Rules' } },
  evidenceBoundaries: [{ boundary: 'CONTRACT', operations: ['evaluate'], status: 'HERMETIC' }],
  authorityEvidence: { currentAuthority: 'KEEP_DB_BACKED', legacyAuthority: 'LEGACY_AUTHORITATIVE', productionAuthorityChanged: false }
};

describe('validateDomainProjection', () => {
  it('accepts a consumer-neutral projection', () => {
    expect(validateDomainProjection(valid).projectionId).toBe('fixture.domain.rules');
  });

  it('rejects projections that elevate authority', () => {
    expect(() => validateDomainProjection({
      ...valid,
      authorityEvidence: { ...valid.authorityEvidence, currentAuthority: 'JAVA_AUTHORITATIVE' }
    })).toThrowError('PROJECTION_AUTHORITY_INVALID');
  });

  it('rejects duplicate decision identities', () => {
    expect(() => validateDomainProjection({ ...valid, decisionRefs: [valid.decisionRefs[0], valid.decisionRefs[0]] }))
      .toThrowError('PROJECTION_DECISION_DUPLICATE');
  });

  it('rejects a decision whose facts have no governed schema', () => {
    expect(() => validateDomainProjection({ ...valid, factSchemas: [] }))
      .toThrowError('PROJECTION_FACT_SCHEMAS_REQUIRED');
  });
});
