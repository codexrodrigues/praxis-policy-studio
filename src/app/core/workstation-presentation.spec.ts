import { describe, expect, it } from 'vitest';
import {
  formatLocalizedTimestamp,
  humanizeDecisionOutcome,
  humanizeEvidenceKind,
  humanizeEnforcementMode,
  humanizeGovernanceGateLabel,
  humanizeOperationMode,
  humanizeReviewDecision,
  humanizeRolloutStatus,
  humanizeSnapshotGovernanceState,
  humanizeTimelineEventType,
  reviewDecisionTone,
  rolloutStatusTone,
  snapshotStateTone,
  timelineEventTone
} from './workstation-presentation';

describe('workstation-presentation', () => {
  it('formats timestamps for business mode while preserving ISO in technical mode and falling back safely', () => {
    const iso = '2026-10-21T15:30:00Z';
    expect(formatLocalizedTimestamp(null, 'pt-BR', 'business')).toBe('—');
    expect(formatLocalizedTimestamp('   ', 'pt-BR', 'business')).toBe('—');
    expect(formatLocalizedTimestamp(iso, 'pt-BR', 'technical')).toBe(iso);
    expect(formatLocalizedTimestamp('not-a-date', 'pt-BR', 'business')).toBe('not-a-date');

    const formattedPt = formatLocalizedTimestamp(iso, 'pt-BR', 'business');
    expect(formattedPt).not.toBe(iso);
    expect(formattedPt).toContain('21');

    const formattedEn = formatLocalizedTimestamp(iso, 'en-US', 'business');
    expect(formattedEn).not.toBe(iso);
    expect(formattedEn).toContain('21');
  });

  it('humanizes review decisions and derives matching tones', () => {
    expect(humanizeReviewDecision('APPROVE', 'pt-BR', 'business')).toBe('Aprovado');
    expect(humanizeReviewDecision('REJECT', 'en-US', 'business')).toBe('Rejected');
    expect(humanizeReviewDecision('APPROVE', 'pt-BR', 'technical')).toBe('APPROVE');
    expect(reviewDecisionTone('APPROVE')).toBe('success');
    expect(reviewDecisionTone('REJECT')).toBe('danger');
    expect(reviewDecisionTone('UNKNOWN')).toBe('neutral');
  });

  it('humanizes governance gate labels in business mode while preserving codes in technical mode', () => {
    expect(humanizeGovernanceGateLabel('SUBMIT', 'pt-BR', 'business')).toBe('Submeter para revisão');
    expect(humanizeGovernanceGateLabel('REVIEW', 'pt-BR', 'business')).toBe('Revisão independente (4-olhos)');
    expect(humanizeGovernanceGateLabel('PROMOTE', 'en-US', 'business')).toBe('Promote candidate');
    expect(humanizeGovernanceGateLabel('PUBLISH_DEFINITION', 'en-US', 'business')).toBe('Publish governed definition');
    expect(humanizeGovernanceGateLabel('REVIEW', 'pt-BR', 'technical')).toBe('REVIEW');
  });

  it('humanizes timeline event types and falls back cleanly for unknown snake_case events', () => {
    expect(humanizeTimelineEventType('WORKSPACE_CREATED', 'pt-BR', 'business')).toBe('Rascunho criado');
    expect(humanizeTimelineEventType('definition.created', 'pt-BR', 'business')).toBe('Definição criada');
    expect(humanizeTimelineEventType('approval.requested', 'pt-BR', 'business')).toBe('Aprovação solicitada');
    expect(humanizeTimelineEventType('materialization.applied', 'en-US', 'business')).toBe('Materialization applied');
    expect(humanizeTimelineEventType('TEST_RUN_RECORDED', 'en-US', 'business')).toBe('Test run recorded');
    expect(humanizeTimelineEventType('ROLLED_BACK', 'pt-BR', 'business')).toBe('Snapshot revertido');
    expect(humanizeTimelineEventType('WORKSPACE_CREATED', 'pt-BR', 'technical')).toBe('WORKSPACE_CREATED');
    expect(humanizeTimelineEventType('definition.created', 'pt-BR', 'technical')).toBe('definition.created');
    expect(humanizeTimelineEventType('CUSTOM_AUDIT_EVENT', 'en-US', 'business')).toBe('Custom Audit Event');

    expect(timelineEventTone('APPROVED')).toBe('success');
    expect(timelineEventTone('approval.requested')).toBe('warning');
    expect(timelineEventTone('definition.created')).toBe('info');
    expect(timelineEventTone('REJECTED')).toBe('danger');
    expect(timelineEventTone('SUBMITTED')).toBe('warning');
    expect(timelineEventTone('TEST_RUN_RECORDED')).toBe('info');
    expect(timelineEventTone('UNCLASSIFIED')).toBe('neutral');
  });

  it('humanizes snapshot states, enforcement modes, rollout statuses, and outcomes cleanly', () => {
    expect(humanizeSnapshotGovernanceState('READY', 'pt-BR', 'business')).toBe('Pronto para operação');
    expect(humanizeSnapshotGovernanceState('READY', 'pt-BR', 'technical')).toBe('READY');
    expect(humanizeSnapshotGovernanceState('RUNTIME_INCOMPATIBLE', 'en-US', 'technical')).toBe('Incompatible with the current runtime');
    expect(snapshotStateTone('READY')).toBe('success');
    expect(snapshotStateTone('REPUBLICATION_REQUIRED')).toBe('warning');
    expect(snapshotStateTone('WITHDRAWN')).toBe('danger');

    expect(humanizeEnforcementMode('OBSERVE_ONLY', 'pt-BR', 'business')).toBe('Somente observação');
    expect(humanizeEnforcementMode('REQUIRED', 'en-US', 'business')).toBe('Required (gates promotion)');
    expect(humanizeEnforcementMode('REQUIRED', 'pt-BR', 'technical')).toBe('REQUIRED');

    expect(humanizeRolloutStatus('READY', 'pt-BR', 'business')).toBe('Pronto');
    expect(humanizeRolloutStatus('WAITING', 'en-US', 'business')).toBe('Waiting for quorum');
    expect(humanizeRolloutStatus('ACTIVE', 'pt-BR', 'technical')).toBe('ACTIVE');
    expect(rolloutStatusTone('ACTIVE')).toBe('success');
    expect(rolloutStatusTone('WAITING')).toBe('warning');
    expect(rolloutStatusTone('BLOCKED')).toBe('danger');

    expect(humanizeDecisionOutcome('ALLOW', 'pt-BR', 'business')).toBe('Permitida');
    expect(humanizeDecisionOutcome('DENY', 'en-US', 'business')).toBe('Denied');
    expect(humanizeDecisionOutcome('TECHNICAL_ERROR', 'pt-BR', 'technical')).toBe('TECHNICAL_ERROR');

    expect(humanizeEvidenceKind('legacy_oracle_probe', 'en-US', 'business')).toBe('Legacy Oracle Probe');
    expect(humanizeOperationMode('CREATE', 'pt-BR', 'business')).toBe('Criação');
    expect(humanizeOperationMode('UPDATE', 'en-US', 'business')).toBe('Update');
  });
});
