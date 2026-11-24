import { humanizeTechnicalSlug } from './humanize-labels';
import { POLICY_STUDIO_COPY } from './i18n';
import type { SupportedLocale } from './runtime-config';
import type { StudioViewDepth } from './studio-shell-state.service';

export type WorkstationStatusTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

/**
 * Formats ISO-8601 timestamps concisely for business users while retaining the raw
 * canonical UTC/ISO string in Technical Mode (and via `<time [datetime]/[title]>`).
 */
export function formatLocalizedTimestamp(
  iso: string | null | undefined,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  const trimmed = iso?.trim() ?? '';
  if (!trimmed) {
    return '—';
  }
  if (viewDepth === 'technical') {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(parsed);
}

export function humanizeReviewDecision(
  decision: string | null | undefined,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  const trimmed = decision?.trim() ?? '';
  if (!trimmed) {
    return '—';
  }
  if (viewDepth === 'technical') {
    return trimmed;
  }
  const dict = POLICY_STUDIO_COPY[locale];
  const normalized = trimmed.toUpperCase();
  if (normalized === 'APPROVE' || normalized === 'APPROVED') {
    return dict.reviewDecisionApprove;
  }
  if (normalized === 'REJECT' || normalized === 'REJECTED') {
    return dict.reviewDecisionReject;
  }
  return humanizeTechnicalSlug(trimmed, undefined, locale);
}

export function reviewDecisionTone(decision: string | null | undefined): WorkstationStatusTone {
  const normalized = decision?.trim().toUpperCase() ?? '';
  if (normalized === 'APPROVE' || normalized === 'APPROVED') {
    return 'success';
  }
  if (normalized === 'REJECT' || normalized === 'REJECTED') {
    return 'danger';
  }
  return 'neutral';
}

export function humanizeGovernanceGateLabel(
  gateId: string | null | undefined,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  const trimmed = gateId?.trim() ?? '';
  if (!trimmed) {
    return '—';
  }
  if (viewDepth === 'technical') {
    return trimmed;
  }
  const dict = POLICY_STUDIO_COPY[locale];
  switch (trimmed.toUpperCase()) {
    case 'SUBMIT':
      return dict.gateLabelSubmit;
    case 'REVIEW':
      return dict.gateLabelReview;
    case 'PROMOTE':
      return dict.gateLabelPromote;
    case 'PUBLISH_DEFINITION':
      return dict.gateLabelPublishDefinition;
    default:
      return humanizeTechnicalSlug(trimmed, undefined, locale);
  }
}

export function humanizeTimelineEventType(
  eventType: string | null | undefined,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  const trimmed = eventType?.trim() ?? '';
  if (!trimmed) {
    return '—';
  }
  if (viewDepth === 'technical') {
    return trimmed;
  }
  const dict = POLICY_STUDIO_COPY[locale];
  const normalized = trimmed.replace(/[.:\s-]+/g, '_').toUpperCase();
  switch (normalized) {
    case 'WORKSPACE_CREATED':
      return dict.timelineEventWorkspaceCreated;
    case 'DRAFT_UPDATED':
    case 'CONDITION_UPDATED':
      return dict.timelineEventDraftUpdated;
    case 'TEST_RUN_RECORDED':
      return dict.timelineEventTestRunRecorded;
    case 'SUBMITTED':
    case 'WORKSPACE_SUBMITTED':
      return dict.timelineEventSubmitted;
    case 'APPROVED':
    case 'WORKSPACE_APPROVED':
      return dict.timelineEventApproved;
    case 'REJECTED':
    case 'WORKSPACE_REJECTED':
      return dict.timelineEventRejected;
    case 'PROMOTED':
    case 'WORKSPACE_PROMOTED':
      return dict.timelineEventPromoted;
    case 'PUBLISHED':
    case 'DEFINITION_PUBLISHED':
    case 'SNAPSHOT_PUBLISHED':
      return dict.timelineEventPublished;
    case 'ACTIVATED':
    case 'SNAPSHOT_ACTIVATED':
      return dict.timelineEventActivated;
    case 'ROLLED_BACK':
    case 'SNAPSHOT_ROLLED_BACK':
      return dict.timelineEventRolledBack;
    case 'SCENARIO_CREATED':
      return dict.timelineEventScenarioCreated;
    case 'SCENARIO_UPDATED':
      return dict.timelineEventScenarioUpdated;
    case 'POLICY_CREATED':
    case 'ROLLOUT_POLICY_CREATED':
      return dict.timelineEventPolicyCreated;
    case 'POLICY_APPROVED':
    case 'ROLLOUT_POLICY_APPROVED':
      return dict.timelineEventPolicyApproved;
    case 'POLICY_ACTIVATED':
    case 'ROLLOUT_POLICY_ACTIVATED':
      return dict.timelineEventPolicyActivated;
    case 'DEFINITION_CREATED':
      return dict.timelineEventDefinitionCreated;
    case 'DEFINITION_APPROVED':
      return dict.timelineEventDefinitionApproved;
    case 'DEFINITION_ACTIVATED':
      return dict.timelineEventDefinitionActivated;
    case 'APPROVAL_REQUESTED':
      return dict.timelineEventApprovalRequested;
    case 'APPROVAL_APPROVED':
    case 'APPROVAL_COMPLETED':
      return dict.timelineEventApprovalCompleted;
    case 'INTAKE_RECEIVED':
      return dict.timelineEventIntakeReceived;
    case 'SIMULATION_REQUESTED':
      return dict.timelineEventSimulationRequested;
    case 'SIMULATION_COMPLETED':
      return dict.timelineEventSimulationCompleted;
    case 'PUBLICATION_REQUESTED':
      return dict.timelineEventPublicationRequested;
    case 'PUBLICATION_COMPLETED':
      return dict.timelineEventPublicationCompleted;
    case 'MATERIALIZATION_CREATED':
      return dict.timelineEventMaterializationCreated;
    case 'MATERIALIZATION_APPLIED':
      return dict.timelineEventMaterializationApplied;
    case 'MATERIALIZATION_SUPERSEDED':
      return dict.timelineEventMaterializationSuperseded;
    default:
      return humanizeTechnicalSlug(trimmed, undefined, locale);
  }
}

export function timelineEventTone(eventType: string | null | undefined): WorkstationStatusTone {
  const normalized = eventType?.trim().replace(/[.:\s-]+/g, '_').toUpperCase() ?? '';
  if (
    normalized.includes('REJECT')
    || normalized.includes('WITHDRAW')
    || normalized.includes('FAIL')
  ) {
    return 'danger';
  }
  if (
    normalized.includes('REQUESTED')
    || normalized.includes('SUBMIT')
    || normalized.includes('ROLL')
    || normalized.includes('SUPERSEDED')
  ) {
    return 'warning';
  }
  if (
    normalized.includes('APPROV')
    || normalized.includes('PUBLISH')
    || normalized.includes('ACTIVAT')
    || normalized.includes('PROMOT')
    || normalized.includes('APPLIED')
    || normalized === 'PUBLICATION_COMPLETED'
  ) {
    return 'success';
  }
  if (
    normalized.includes('TEST')
    || normalized.includes('DRAFT')
    || normalized.includes('CREATED')
    || normalized.includes('SCENARIO')
    || normalized.includes('POLICY')
    || normalized.includes('SIMULATION')
    || normalized.includes('INTAKE')
  ) {
    return 'info';
  }
  return 'neutral';
}

export function humanizeSnapshotGovernanceState(
  state: string | null | undefined,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  const trimmed = state?.trim() ?? '';
  if (!trimmed) {
    return '—';
  }
  const dict = POLICY_STUDIO_COPY[locale];
  const normalized = trimmed.toUpperCase();
  if (normalized === 'RUNTIME_INCOMPATIBLE') {
    return dict.snapshotRuntimeIncompatible;
  }
  if (normalized === 'WITHDRAWN') {
    return dict.snapshotWithdrawnState;
  }
  if (viewDepth === 'technical') {
    return trimmed;
  }
  switch (normalized) {
    case 'READY':
      return dict.snapshotStateReady;
    case 'REPUBLICATION_REQUIRED':
      return dict.snapshotStateRepublicationRequired;
    case 'INVALID':
      return dict.snapshotStateInvalid;
    default:
      return humanizeTechnicalSlug(trimmed, undefined, locale);
  }
}

export function snapshotStateTone(state: string | null | undefined): WorkstationStatusTone {
  switch (state?.trim().toUpperCase()) {
    case 'READY':
      return 'success';
    case 'REPUBLICATION_REQUIRED':
      return 'warning';
    case 'RUNTIME_INCOMPATIBLE':
    case 'WITHDRAWN':
    case 'INVALID':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function humanizeEnforcementMode(
  mode: string | null | undefined,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  const trimmed = mode?.trim() ?? '';
  if (!trimmed) {
    return '—';
  }
  if (viewDepth === 'technical') {
    return trimmed;
  }
  const dict = POLICY_STUDIO_COPY[locale];
  switch (trimmed.toUpperCase()) {
    case 'OBSERVE_ONLY':
      return dict.enforcementObserveOnly;
    case 'REQUIRED':
      return dict.enforcementRequired;
    default:
      return humanizeTechnicalSlug(trimmed, undefined, locale);
  }
}

export function humanizeRolloutStatus(
  status: string | null | undefined,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  const trimmed = status?.trim() ?? '';
  if (!trimmed) {
    return '—';
  }
  if (viewDepth === 'technical') {
    return trimmed;
  }
  const dict = POLICY_STUDIO_COPY[locale];
  switch (trimmed.toUpperCase()) {
    case 'READY':
      return dict.rolloutStatusReady;
    case 'WAITING':
    case 'PENDING':
    case 'OBSERVING':
      return dict.rolloutStatusWaiting;
    case 'BLOCKED':
    case 'FAILED':
      return dict.rolloutStatusBlocked;
    case 'EXPIRED':
      return dict.rolloutStatusExpired;
    case 'CANCELLED':
    case 'CANCELED':
      return dict.rolloutStatusCancelled;
    case 'ACTIVE':
      return dict.rolloutStatusActive;
    case 'DRAFT':
      return dict.rolloutStatusDraft;
    case 'APPROVED':
      return dict.rolloutStatusApproved;
    default:
      return humanizeTechnicalSlug(trimmed, undefined, locale);
  }
}

export function rolloutStatusTone(status: string | null | undefined): WorkstationStatusTone {
  switch (status?.trim().toUpperCase()) {
    case 'READY':
    case 'ACTIVE':
    case 'APPROVED':
      return 'success';
    case 'BLOCKED':
    case 'FAILED':
    case 'EXPIRED':
    case 'CANCELLED':
    case 'CANCELED':
      return 'danger';
    case 'WAITING':
    case 'PENDING':
    case 'OBSERVING':
      return 'warning';
    case 'DRAFT':
      return 'info';
    default:
      return 'neutral';
  }
}

export function humanizeDecisionOutcome(
  outcome: string | null | undefined,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  const trimmed = outcome?.trim() ?? '';
  if (!trimmed) {
    return '—';
  }
  if (viewDepth === 'technical') {
    return trimmed;
  }
  const dict = POLICY_STUDIO_COPY[locale];
  switch (trimmed.toUpperCase()) {
    case 'ALLOW':
      return dict.outcomeAllow;
    case 'DENY':
      return dict.outcomeDeny;
    case 'NOT_APPLICABLE':
      return dict.outcomeNotApplicable;
    case 'INCONCLUSIVE':
      return dict.outcomeInconclusive;
    case 'TECHNICAL_ERROR':
      return dict.outcomeTechnicalError;
    default:
      return humanizeTechnicalSlug(trimmed, undefined, locale);
  }
}

export function humanizeEvidenceKind(
  kind: string | null | undefined,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  const trimmed = kind?.trim() ?? '';
  if (!trimmed) {
    return '—';
  }
  if (viewDepth === 'technical') {
    return trimmed;
  }
  return humanizeTechnicalSlug(trimmed, undefined, locale);
}

export function humanizeOperationMode(
  mode: string | null | undefined,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  const trimmed = mode?.trim() ?? '';
  if (!trimmed) {
    return '—';
  }
  if (viewDepth === 'technical') {
    return trimmed;
  }
  const dict = POLICY_STUDIO_COPY[locale];
  switch (trimmed.toUpperCase()) {
    case 'CREATE':
      return dict.createOperation;
    case 'UPDATE':
      return dict.updateOperation;
    default:
      return humanizeTechnicalSlug(trimmed, undefined, locale);
  }
}
