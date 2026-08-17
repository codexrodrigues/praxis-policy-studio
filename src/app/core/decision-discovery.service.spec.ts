import '@angular/compiler';
import { HttpErrorResponse } from '@angular/common/http';
import type { AgenticAuthoringTurnClientService } from '@praxisui/ai';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { DecisionDiscoveryService } from './decision-discovery.service';

const config = {
  mode: 'remote' as const,
  configApiBaseUrl: '',
  locale: 'pt-BR' as const,
  projectionPath: '/projections/test.json',
  initialDecisionKey: null
};

function result(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'stream-event' as const,
    event: {
      type: 'result',
      payload: {
        assistantMessage: 'Encontrei uma decisão governada candidata.',
        canApply: false,
        evidenceBundle: {
          source: 'searchDomainRules',
          domainRuleSearch: {
            schemaVersion: 'praxis-domain-rule-search.v1',
            candidates: [{
              definitionId: '7b0fca89-cb64-40bf-8eea-d3467083bbf4',
              ruleKey: 'grant.amount-parameters',
              version: 3,
              ruleType: 'JSON_LOGIC_DECISION',
              status: 'approved',
              contextKey: 'benefits',
              resourceKey: 'extraordinary-benefit-requests',
              serviceKey: 'quickstart',
              semanticOwner: 'benefits-policy',
              updatedAt: '2026-08-16T12:00:00Z'
            }],
            page: 0,
            limit: 6,
            hasMore: false,
            ...overrides
          }
        }
      }
    }
  } as any;
}

describe('DecisionDiscoveryService', () => {
  it('delegates semantic discovery to the authoring runtime and accepts only safe governed evidence', () => {
    const streamEvents = vi.fn().mockReturnValue(of(result()));
    const service = new DecisionDiscoveryService({ streamEvents } as unknown as AgenticAuthoringTurnClientService);
    const events: unknown[] = [];

    service.discover({ prompt: 'Quais regras limitam o valor do auxílio?', locale: 'pt-BR', config })
      .subscribe(event => events.push(event));

    const [body, options] = streamEvents.mock.calls[0];
    expect(body.userPrompt).toBe('Quais regras limitam o valor do auxílio?');
    expect(body.contextHints).toEqual({ responseLocale: 'pt-BR' });
    expect(body.contextHints).not.toHaveProperty('selectedDomainDecisionRef');
    expect(body).not.toHaveProperty('currentPage');
    expect(options).toMatchObject({ baseUrl: '/api/praxis/config/ai/authoring' });
    expect(options).not.toHaveProperty('headers');
    expect(events).toEqual([expect.objectContaining({
      kind: 'completed', canApply: false, page: 0, hasMore: false,
      candidates: [expect.objectContaining({ ruleKey: 'grant.amount-parameters', version: 3 })]
    })]);
  });

  it('fails closed when the terminal enables apply', () => {
    const unsafe = result();
    unsafe.event.payload.canApply = true;
    const service = new DecisionDiscoveryService({ streamEvents: vi.fn().mockReturnValue(of(unsafe)) } as any);
    const events: unknown[] = [];
    service.discover({ prompt: 'Encontre regras', locale: 'pt-BR', config }).subscribe(event => events.push(event));
    expect(events).toEqual([{ kind: 'failed', reason: 'unsafe-terminal' }]);
  });

  it('rejects malformed candidate identity instead of partially trusting the list', () => {
    const service = new DecisionDiscoveryService({
      streamEvents: vi.fn().mockReturnValue(of(result({
        candidates: [{ definitionId: 'not-a-uuid', ruleKey: 'grant.amount', version: 3 }]
      })))
    } as any);
    const events: unknown[] = [];
    service.discover({ prompt: 'Encontre regras', locale: 'pt-BR', config }).subscribe(event => events.push(event));
    expect(events).toEqual([{ kind: 'failed', reason: 'evidence-mismatch' }]);
  });

  it('separates authentication and authorization failures', () => {
    for (const [status, reason] of [[401, 'authentication'], [403, 'forbidden']] as const) {
      const service = new DecisionDiscoveryService({
        streamEvents: vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status })))
      } as any);
      const events: unknown[] = [];
      service.discover({ prompt: 'Encontre regras', locale: 'pt-BR', config }).subscribe(event => events.push(event));
      expect(events).toEqual([{ kind: 'failed', reason }]);
    }
  });
});
