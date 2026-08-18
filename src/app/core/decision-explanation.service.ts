import { HttpErrorResponse } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import {
  AgenticAuthoringTurnClientService,
  type AgenticAuthoringTurnClientEvent,
  type AgenticAuthoringTurnStreamRequest,
  type AiJsonObject
} from '@praxisui/ai';
import { Observable, catchError, filter, map, of, takeWhile } from 'rxjs';
import type { PolicyStudioRuntimeConfig, SupportedLocale } from './runtime-config';
import { createClientRequestId } from './client-request-id';

export interface DecisionExplanationRequest {
  readonly definitionId: string;
  readonly ruleKey: string;
  readonly version: number;
  readonly locale: SupportedLocale;
  readonly config: PolicyStudioRuntimeConfig;
}

export interface DecisionExplanationEvidence {
  readonly schemaVersion: string;
  readonly definitionHash: string;
  readonly conditionHash: string;
  readonly resolvedVersion: number;
  readonly exposureMode: string;
  readonly redactionMode: string;
  readonly sourceRefCount: number;
}

export type DecisionExplanationEvent =
  | { readonly kind: 'progress' }
  | {
      readonly kind: 'completed';
      readonly message: string;
      readonly evidence: DecisionExplanationEvidence;
      readonly canApply: false;
    }
  | {
      readonly kind: 'failed';
      readonly reason: 'authentication' | 'forbidden' | 'cancelled' | 'evidence-mismatch' | 'unsafe-terminal' | 'failed';
    };

@Injectable({ providedIn: 'root' })
export class DecisionExplanationService {
  private static readonly EVIDENCE_SCHEMA = 'praxis-domain-decision-explanation-evidence.v1';
  private static readonly EVIDENCE_SOURCE = 'inspectDomainDecision';

  constructor(
    @Inject(AgenticAuthoringTurnClientService)
    private readonly turns: AgenticAuthoringTurnClientService
  ) {}

  explain(request: DecisionExplanationRequest): Observable<DecisionExplanationEvent> {
    const turnRequest: AgenticAuthoringTurnStreamRequest = {
      clientTurnId: createClientRequestId(),
      userPrompt: this.prompt(request.locale),
      targetApp: 'praxis-policy-studio',
      targetComponentId: 'policy-decision-explanation',
      currentRoute: '/catalog',
      contextHints: {
        selectedDomainDecisionRef: {
          schemaVersion: 'praxis.ai.context-hints.domain-decision/v1',
          definitionId: request.definitionId,
          ruleKey: request.ruleKey,
          version: request.version,
          source: 'policy-studio-selection'
        }
      }
    };
    const baseUrl = `${(request.config.configApiBaseUrl ?? '').replace(/\/$/, '')}/api/praxis/config/ai/authoring`;

    return this.turns.streamEvents(turnRequest, {
      baseUrl,
      resultTimeoutMs: 75_000,
      streamTimeoutMs: 90_000
    }).pipe(
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
    if (event.kind !== 'stream-event') return { kind: 'progress' };
    if (event.event.type === 'cancelled') return { kind: 'failed', reason: 'cancelled' };
    if (event.event.type === 'error') return { kind: 'failed', reason: 'failed' };
    if (event.event.type !== 'result') return { kind: 'progress' };

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
        sourceRefCount: sourceRefs.length
      }
    };
  }

  private prompt(locale: SupportedLocale): string {
    return locale === 'en-US'
      ? 'Explain the selected governed decision in business language. Cover its condition and only the facts, null behavior, precedence, and authority attested by the tool evidence. State clearly when evidence is unavailable; do not infer missing semantics. Return plain text without Markdown or HTML.'
      : 'Explique a decisão governada selecionada em linguagem de negócio. Descreva a condição e somente os facts, comportamento de nulo, precedência e autoridade atestados pela evidência da tool. Informe claramente quando a evidência estiver ausente; não infira semântica faltante. Responda em texto simples, sem Markdown ou HTML.';
  }

  private failureReason(error: unknown): 'authentication' | 'forbidden' | 'failed' {
    const status = error instanceof HttpErrorResponse
      ? error.status
      : typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : 0;
    if (status === 401) return 'authentication';
    if (status === 403) return 'forbidden';
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
