import { HttpErrorResponse } from '@angular/common/http';
import { Inject, Injectable, Optional } from '@angular/core';
import {
  AgenticAuthoringTurnClientService,
  type AgenticAuthoringTurnClientEvent,
  type AgenticAuthoringTurnStreamRequest,
  type AiJsonObject
} from '@praxisui/ai';
import { Observable, catchError, filter, map, of, switchMap, takeWhile } from 'rxjs';
import { AuthSessionService } from './auth-session.service';
import type { PolicyStudioRuntimeConfig, SupportedLocale } from './runtime-config';
import { createClientRequestId } from './client-request-id';

export interface DecisionExplanationRequest {
  readonly definitionId: string;
  readonly ruleKey: string;
  readonly version: number;
  readonly locale: SupportedLocale;
  readonly config: PolicyStudioRuntimeConfig;
}

export interface DecisionExplanationSafeFact {
  readonly path: string;
  readonly label: string;
  readonly valueType: string;
  readonly nullable: boolean;
  readonly sensitivity: string;
  readonly redaction: string;
  readonly description?: string;
  readonly hint?: string;
  readonly unit?: string;
  readonly valuePresentation?: string;
  readonly mask?: string;
  readonly example?: string;
}

export interface DecisionExplanationEvidence {
  readonly schemaVersion: string;
  readonly definitionHash: string;
  readonly conditionHash: string;
  readonly resolvedVersion: number;
  readonly exposureMode: string;
  readonly redactionMode: string;
  readonly sourceRefCount: number;
  readonly facts?: readonly DecisionExplanationSafeFact[];
  readonly omittedFields?: readonly string[];
}

export type DecisionExplanationProgressPhase =
  | 'connecting'
  | 'inspecting_evidence'
  | 'synthesizing';

export type DecisionExplanationEvent =
  | {
      readonly kind: 'progress';
      readonly phase?: DecisionExplanationProgressPhase;
      readonly eventSeq?: number;
    }
  | {
      readonly kind: 'completed';
      readonly message: string;
      readonly evidence: DecisionExplanationEvidence;
      readonly canApply: false;
    }
  | {
      readonly kind: 'failed';
      readonly reason: 'authentication' | 'forbidden' | 'unavailable' | 'cancelled' | 'evidence-mismatch' | 'unsafe-terminal' | 'failed';
    };

@Injectable({ providedIn: 'root' })
export class DecisionExplanationService {
  private static readonly EVIDENCE_SCHEMA = 'praxis-domain-decision-explanation-evidence.v1';
  private static readonly EVIDENCE_SOURCE = 'inspectDomainDecision';

  constructor(
    @Inject(AgenticAuthoringTurnClientService)
    private readonly turns: AgenticAuthoringTurnClientService,
    @Optional() @Inject(AuthSessionService)
    private readonly authSession?: AuthSessionService
  ) {}

  explain(request: DecisionExplanationRequest): Observable<DecisionExplanationEvent> {
    const turnRequest: AgenticAuthoringTurnStreamRequest = {
      clientTurnId: createClientRequestId(),
      userPrompt: this.prompt(request.locale),
      targetApp: 'praxis-rules-studio',
      targetComponentId: 'rules-decision-explanation',
      currentRoute: '/catalog',
      contextHints: {
        selectedDomainDecisionRef: {
          schemaVersion: 'praxis.ai.context-hints.domain-decision/v1',
          definitionId: request.definitionId,
          ruleKey: request.ruleKey,
          version: request.version,
          source: 'rules-studio-selection' as unknown as 'policy-studio-selection'
        }
      }
    };
    const baseUrl = `${(request.config.configApiBaseUrl ?? '').replace(/\/$/, '')}/api/praxis/config/ai/authoring`;

    return (this.authSession ? this.authSession.ensureCsrf(request.config) : of(undefined)).pipe(
      switchMap(() => this.turns.streamEvents(turnRequest, {
        baseUrl,
        resultTimeoutMs: 75_000,
        streamTimeoutMs: 90_000
      })),
      map(event => this.mapEvent(event, request)),
      filter((event): event is DecisionExplanationEvent => event !== null),
      takeWhile(event => event.kind === 'progress', true),
      catchError(error => of({ kind: 'failed', reason: this.failureReason(error) } as const))
    );
  }

  private mapEvent(
    event: AgenticAuthoringTurnClientEvent,
    request: DecisionExplanationRequest
  ): DecisionExplanationEvent | null {
    if (event.kind !== 'stream-event') return { kind: 'progress', phase: 'connecting' };
    if (event.event.type === 'cancelled') return { kind: 'failed', reason: 'cancelled' };
    if (event.event.type === 'error') return { kind: 'failed', reason: 'failed' };
    if (event.event.type !== 'result') {
      const eventType = String(event.event.type ?? '');
      const phase: DecisionExplanationProgressPhase =
        eventType.includes('tool') || eventType === 'status'
          ? 'inspecting_evidence'
          : 'synthesizing';
      const seq = typeof event.event.seq === 'number' ? event.event.seq : undefined;
      return { kind: 'progress', phase, ...(seq !== undefined ? { eventSeq: seq } : {}) };
    }

    const payload = this.object(event.event.payload);
    if (!payload) return { kind: 'failed', reason: 'failed' };
    if (payload['canApply'] !== false) return { kind: 'failed', reason: 'unsafe-terminal' };

    const evidenceBundle = this.object(payload['evidenceBundle']);
    const domainDecision = this.object(evidenceBundle?.['domainDecision']);
    const decisionRef = this.object(domainDecision?.['decisionRef']);
    const versionAttestation = this.object(domainDecision?.['versionAttestation']);
    const definitionHash = this.text(decisionRef?.['definitionHash']);
    const conditionHash = this.text(decisionRef?.['conditionHash']);
    if (evidenceBundle?.['source'] !== DecisionExplanationService.EVIDENCE_SOURCE
      || domainDecision?.['schemaVersion'] !== DecisionExplanationService.EVIDENCE_SCHEMA
      || !domainDecision || !decisionRef || !versionAttestation
      || decisionRef['definitionId'] !== request.definitionId
      || decisionRef['ruleKey'] !== request.ruleKey
      || decisionRef['version'] !== request.version
      || !definitionHash
      || !conditionHash
      || versionAttestation['requestedVersion'] !== request.version
      || versionAttestation['resolvedVersion'] !== request.version
      || versionAttestation['exactMatch'] !== true) {
      return { kind: 'failed', reason: 'evidence-mismatch' };
    }

    const message = this.text(payload['assistantMessage']);
    const conditionEvidence = this.object(domainDecision['conditionEvidence']);
    const redaction = this.object(domainDecision['redaction']);
    const sourceRefs = Array.isArray(domainDecision['sourceRefs']) ? domainDecision['sourceRefs'] : [];
    const facts = this.parseSafeFacts(domainDecision['facts']);
    const omittedFields = this.parseOmittedFields(redaction?.['omittedFields']);
    if (!message) return { kind: 'failed', reason: 'failed' };

    return {
      kind: 'completed',
      message,
      canApply: false,
      evidence: {
        schemaVersion: this.text(domainDecision['schemaVersion']),
        definitionHash,
        conditionHash,
        resolvedVersion: request.version,
        exposureMode: this.text(conditionEvidence?.['exposureMode']),
        redactionMode: this.text(redaction?.['mode']),
        sourceRefCount: sourceRefs.length,
        facts,
        omittedFields
      }
    };
  }

  private parseSafeFacts(rawFacts: unknown): readonly DecisionExplanationSafeFact[] {
    if (!Array.isArray(rawFacts)) return [];
    const parsed: DecisionExplanationSafeFact[] = [];
    for (const candidate of rawFacts) {
      const rec = this.object(candidate);
      if (!rec) continue;
      const path = this.text(rec['path']);
      if (!path) continue;
      const label = this.text(rec['label']) || path;
      const valueType = this.text(rec['valueType']) || 'string';
      const nullable = typeof rec['nullable'] === 'boolean' ? rec['nullable'] : true;
      const sensitivity = this.text(rec['sensitivity']) || 'NON_SENSITIVE';
      const redaction = this.text(rec['redaction']) || 'NONE';
      const description = this.text(rec['description']);
      const hint = this.text(rec['hint']);
      const unit = this.text(rec['unit']);
      const valuePresentation = this.text(rec['valuePresentation']);
      const mask = this.text(rec['mask']);
      const example = this.text(rec['example']);
      parsed.push({
        path,
        label,
        valueType,
        nullable,
        sensitivity,
        redaction,
        ...(description ? { description } : {}),
        ...(hint ? { hint } : {}),
        ...(unit ? { unit } : {}),
        ...(valuePresentation ? { valuePresentation } : {}),
        ...(mask ? { mask } : {}),
        ...(example ? { example } : {})
      });
    }
    return parsed;
  }

  private parseOmittedFields(rawOmitted: unknown): readonly string[] {
    if (!Array.isArray(rawOmitted)) return [];
    const seen = new Set<string>();
    const omitted: string[] = [];
    for (const item of rawOmitted) {
      if (typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      omitted.push(trimmed);
    }
    return omitted;
  }

  private prompt(locale: SupportedLocale): string {
    return locale === 'en-US'
      ? 'Explain the selected governed decision in business language. Cover its condition and only the facts, null behavior, precedence, and authority attested by the tool evidence. State clearly when evidence is unavailable; do not infer missing semantics. Return plain text without Markdown or HTML.'
      : 'Explique a decisão governada selecionada em linguagem de negócio. Descreva a condição e somente os facts, comportamento de nulo, precedência e autoridade atestados pela evidência da tool. Informe claramente quando a evidência estiver ausente; não infira semântica faltante. Responda em texto simples, sem Markdown ou HTML.';
  }

  private failureReason(error: unknown): 'authentication' | 'forbidden' | 'unavailable' | 'failed' {
    const status = error instanceof HttpErrorResponse
      ? error.status
      : typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : 0;
    if (status === 401) return 'authentication';
    if (status === 403) return 'forbidden';
    if (status === 404 || status === 501) return 'unavailable';
    return 'failed';
  }

  private object(value: unknown): AiJsonObject | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as AiJsonObject
      : null;
  }

  private text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
