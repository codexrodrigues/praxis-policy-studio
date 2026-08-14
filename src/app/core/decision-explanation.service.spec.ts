import '@angular/compiler';
import type { AgenticAuthoringTurnClientService } from '@praxisui/ai';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { DecisionExplanationService } from './decision-explanation.service';

const config = {
  mode: 'remote' as const,
  configApiBaseUrl: '',
  locale: 'pt-BR' as const,
  projectionPath: '/projections/test.json',
  initialDecisionKey: null
};

const request = {
  definitionId: '7b0fca89-cb64-40bf-8eea-d3467083bbf4',
  ruleKey: 'grant.amount-parameters',
  version: 3,
  locale: 'pt-BR' as const,
  config
};

function result(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'stream-event' as const,
    event: {
      type: 'result',
      payload: {
        assistantMessage: 'A decisão limita o valor solicitado.',
        canApply: false,
        evidenceBundle: {
          source: 'inspectDomainDecision',
          domainDecision: {
            schemaVersion: 'praxis-domain-decision-explanation-evidence.v1',
            decisionRef: {
              definitionId: request.definitionId,
              ruleKey: request.ruleKey,
              version: request.version,
              definitionHash: 'definition-hash',
              conditionHash: 'condition-hash'
            },
            conditionEvidence: { exposureMode: 'summary_only' },
            redaction: { mode: 'summary_only' },
            sourceRefs: ['config://definition/3'],
            versionAttestation: { requestedVersion: 3, resolvedVersion: 3, exactMatch: true },
            ...overrides
          }
        }
      }
    }
  } as any;
}

describe('DecisionExplanationService', () => {
  it('anchors the turn to the exact governed decision without sending rule payloads or scope headers', () => {
    const streamEvents = vi.fn().mockReturnValue(of(result()));
    const service = new DecisionExplanationService({ streamEvents } as unknown as AgenticAuthoringTurnClientService);
    const events: unknown[] = [];

    service.explain(request).subscribe(event => events.push(event));

    expect(streamEvents).toHaveBeenCalledOnce();
    const [body, options] = streamEvents.mock.calls[0];
    expect(body.contextHints.selectedDomainDecisionRef).toEqual({
      schemaVersion: 'praxis.ai.context-hints.domain-decision/v1',
      definitionId: request.definitionId,
      ruleKey: request.ruleKey,
      version: 3,
      source: 'policy-studio-selection'
    });
    expect(body.clientTurnId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(body.userPrompt).toContain('não infira semântica faltante');
    expect(body).not.toHaveProperty('currentPage');
    expect(options).toMatchObject({ baseUrl: '/api/praxis/config/ai/authoring' });
    expect(options).toMatchObject({ resultTimeoutMs: 75_000, streamTimeoutMs: 90_000 });
    expect(options).not.toHaveProperty('headers');
    expect(events).toEqual([expect.objectContaining({
      kind: 'completed', canApply: false,
      evidence: expect.objectContaining({ resolvedVersion: 3, sourceRefCount: 1 })
    })]);
  });

  it('rejects an explanation whose evidence does not attest the selected version', () => {
    const streamEvents = vi.fn().mockReturnValue(of(result({
      versionAttestation: { requestedVersion: 3, resolvedVersion: 2, exactMatch: false }
    })));
    const service = new DecisionExplanationService({ streamEvents } as unknown as AgenticAuthoringTurnClientService);
    const events: unknown[] = [];

    service.explain(request).subscribe(event => events.push(event));

    expect(events).toEqual([{ kind: 'failed', reason: 'evidence-mismatch' }]);
  });

  it('fails closed if a consultative explanation attempts to enable apply', () => {
    const unsafe = result();
    unsafe.event.payload.canApply = true;
    const streamEvents = vi.fn().mockReturnValue(of(unsafe));
    const service = new DecisionExplanationService({ streamEvents } as unknown as AgenticAuthoringTurnClientService);
    const events: unknown[] = [];

    service.explain(request).subscribe(event => events.push(event));

    expect(events).toEqual([{ kind: 'failed', reason: 'unsafe-terminal' }]);
  });

  it('fails closed when the terminal omits the explicit read-only marker', () => {
    const unsafe = result();
    delete unsafe.event.payload.canApply;
    const streamEvents = vi.fn().mockReturnValue(of(unsafe));
    const service = new DecisionExplanationService({ streamEvents } as unknown as AgenticAuthoringTurnClientService);
    const events: unknown[] = [];

    service.explain(request).subscribe(event => events.push(event));

    expect(events).toEqual([{ kind: 'failed', reason: 'unsafe-terminal' }]);
  });

  it('rejects a terminal that is not attested by the canonical inspection tool', () => {
    const untrusted = result();
    untrusted.event.payload.evidenceBundle.source = 'generic-resource-search';
    const streamEvents = vi.fn().mockReturnValue(of(untrusted));
    const service = new DecisionExplanationService({ streamEvents } as unknown as AgenticAuthoringTurnClientService);
    const events: unknown[] = [];

    service.explain(request).subscribe(event => events.push(event));

    expect(events).toEqual([{ kind: 'failed', reason: 'evidence-mismatch' }]);
  });

  it('separates authentication and authorization failures', () => {
    for (const [status, reason] of [[401, 'authentication'], [403, 'forbidden']] as const) {
      const streamEvents = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
      const service = new DecisionExplanationService({ streamEvents } as unknown as AgenticAuthoringTurnClientService);
      const events: unknown[] = [];
      service.explain(request).subscribe(event => events.push(event));
      expect(events).toEqual([{ kind: 'failed', reason }]);
    }
  });
});
