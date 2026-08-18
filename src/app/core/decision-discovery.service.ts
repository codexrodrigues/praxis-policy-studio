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

export interface DecisionDiscoveryRequest {
  readonly prompt: string;
  readonly locale: SupportedLocale;
  readonly config: PolicyStudioRuntimeConfig;
}

export interface DecisionDiscoveryCandidate {
  readonly definitionId: string;
  readonly ruleKey: string;
  readonly version: number;
  readonly ruleType: string;
  readonly status: string;
  readonly contextKey: string;
  readonly resourceKey: string;
  readonly serviceKey: string;
  readonly semanticOwner: string;
  readonly updatedAt: string;
}

export type DecisionDiscoveryEvent =
  | { readonly kind: 'progress' }
  | {
      readonly kind: 'completed';
      readonly message: string;
      readonly candidates: readonly DecisionDiscoveryCandidate[];
      readonly page: number;
      readonly hasMore: boolean;
      readonly canApply: false;
    }
  | {
      readonly kind: 'failed';
      readonly reason: 'authentication' | 'forbidden' | 'cancelled' | 'evidence-mismatch' | 'unsafe-terminal' | 'failed';
    };

@Injectable({ providedIn: 'root' })
export class DecisionDiscoveryService {
  private static readonly EVIDENCE_SCHEMA = 'praxis-domain-rule-search.v1';
  private static readonly EVIDENCE_SOURCE = 'searchDomainRules';
  private static readonly UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(
    @Inject(AgenticAuthoringTurnClientService)
    private readonly turns: AgenticAuthoringTurnClientService
  ) {}

  discover(request: DecisionDiscoveryRequest): Observable<DecisionDiscoveryEvent> {
    const turnRequest: AgenticAuthoringTurnStreamRequest = {
      clientTurnId: createClientRequestId(),
      userPrompt: request.prompt.trim(),
      targetApp: 'praxis-policy-studio',
      targetComponentId: 'policy-decision-discovery',
      currentRoute: '/catalog',
      contextHints: { responseLocale: request.locale }
    };
    const baseUrl = `${(request.config.configApiBaseUrl ?? '').replace(/\/$/, '')}/api/praxis/config/ai/authoring`;

    return this.turns.streamEvents(turnRequest, {
      baseUrl,
      resultTimeoutMs: 75_000,
      streamTimeoutMs: 90_000
    }).pipe(
      map(event => this.mapEvent(event)),
      filter((event): event is DecisionDiscoveryEvent => event !== null),
      takeWhile(event => event.kind === 'progress', true),
      catchError(error => of({ kind: 'failed', reason: this.failureReason(error) } as const))
    );
  }

  private mapEvent(event: AgenticAuthoringTurnClientEvent): DecisionDiscoveryEvent | null {
    if (event.kind !== 'stream-event') return { kind: 'progress' };
    if (event.event.type === 'cancelled') return { kind: 'failed', reason: 'cancelled' };
    if (event.event.type === 'error') return { kind: 'failed', reason: 'failed' };
    if (event.event.type !== 'result') return { kind: 'progress' };

    const payload = this.object(event.event.payload);
    if (!payload) return { kind: 'failed', reason: 'failed' };
    if (payload['canApply'] !== false) return { kind: 'failed', reason: 'unsafe-terminal' };
    const evidenceBundle = this.object(payload['evidenceBundle']);
    const search = this.object(evidenceBundle?.['domainRuleSearch']);
    const rawCandidates = search?.['candidates'];
    const page = search?.['page'];
    const limit = search?.['limit'];
    const hasMore = search?.['hasMore'];
    if (evidenceBundle?.['source'] !== DecisionDiscoveryService.EVIDENCE_SOURCE
      || search?.['schemaVersion'] !== DecisionDiscoveryService.EVIDENCE_SCHEMA
      || !Array.isArray(rawCandidates)
      || rawCandidates.length > 12
      || !Number.isInteger(page) || Number(page) < 0
      || !Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 12
      || typeof hasMore !== 'boolean') {
      return { kind: 'failed', reason: 'evidence-mismatch' };
    }

    const candidates = rawCandidates.map(candidate => this.candidate(candidate));
    if (candidates.some(candidate => candidate === null)) {
      return { kind: 'failed', reason: 'evidence-mismatch' };
    }
    const message = this.text(payload['assistantMessage']);
    if (!message) return { kind: 'failed', reason: 'failed' };
    return {
      kind: 'completed',
      message,
      candidates: candidates as DecisionDiscoveryCandidate[],
      page: Number(page),
      hasMore,
      canApply: false
    };
  }

  private candidate(value: unknown): DecisionDiscoveryCandidate | null {
    const candidate = this.object(value);
    const definitionId = this.text(candidate?.['definitionId']);
    const ruleKey = this.text(candidate?.['ruleKey']);
    const version = candidate?.['version'];
    if (!DecisionDiscoveryService.UUID.test(definitionId)
      || !ruleKey
      || !Number.isInteger(version)
      || Number(version) < 1) {
      return null;
    }
    return {
      definitionId,
      ruleKey,
      version: Number(version),
      ruleType: this.text(candidate?.['ruleType']),
      status: this.text(candidate?.['status']),
      contextKey: this.text(candidate?.['contextKey']),
      resourceKey: this.text(candidate?.['resourceKey']),
      serviceKey: this.text(candidate?.['serviceKey']),
      semanticOwner: this.text(candidate?.['semanticOwner']),
      updatedAt: this.text(candidate?.['updatedAt'])
    };
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
