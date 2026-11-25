import '@angular/compiler';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DecisionExplanationService, type DecisionExplanationEvent } from '../../core/decision-explanation.service';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DecisionSummary } from './catalog.fixture';
import { DecisionExplanationComponent } from './decision-explanation.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const config = {
  mode: 'remote' as const,
  configApiBaseUrl: '',
  locale: 'pt-BR' as const,
  projectionPath: '/projections/test.json',
  initialDecisionKey: null
};

function decision(version = 2): DecisionSummary {
  return {
    order: 1, totalDecisions: 1, key: 'grant.amount-parameters', code: 'GRANT-10',
    name: 'Limite do auxílio', domain: 'benefits', ruleSet: 'Extraordinary grant',
    ruleSetKey: 'grant-rules', state: 'verified', meaning: 'Limita o valor solicitado.',
    resourceKey: 'test-resource', serviceKey: 'test-service',
    authority: 'CONFIG', baselineAuthority: 'SYNTHETIC_BASELINE', source: 'quickstart',
    evidenceCount: 1, authoringSupported: true, availableDefinitionActions: [],
    configDefinitionId: '7b0fca89-cb64-40bf-8eea-d3467083bbf4', configVersion: version,
    expression: null, condition: { '<=': [{ var: 'requestedAmount' }, 1000] },
    factPaths: ['requestedAmount'], facts: [], nullSemantics: 'fail_closed',
    operationKeys: ['CREATE'], hostContractVersion: 'v1', evidence: [], draftLifecycle: null
  };
}

describe('DecisionExplanationComponent', () => {
  const explanationEvents = new Subject<DecisionExplanationEvent>();
  const explain = vi.fn();

  beforeAll(async () => {
    const fsModule = (
      globalThis as unknown as {
        process?: {
          getBuiltinModule?: (id: string) => {
            readFileSync: (file: URL, encoding: string) => string;
          };
        };
      }
    ).process?.getBuiltinModule?.('node:fs');

    await resolveComponentResources(async url => {
      if (url.endsWith('.scss')) {
        return '';
      }
      return fsModule?.readFileSync(new URL(url, import.meta.url), 'utf8') ?? '';
    });
  });

  beforeEach(async () => {
    explain.mockReset();
    explain.mockReturnValue(explanationEvents.asObservable());
    await TestBed.configureTestingModule({
      imports: [DecisionExplanationComponent],
      providers: [
        PolicyStudioI18n,
        { provide: DecisionExplanationService, useValue: { explain } }
      ]
    }).compileComponents();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('requests the exact selected version and exposes only a consultative result', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionExplanationComponent());
    component.decision = decision();
    component.config = config;
    component.explain();

    expect(explain).toHaveBeenCalledWith(expect.objectContaining({
      definitionId: '7b0fca89-cb64-40bf-8eea-d3467083bbf4',
      ruleKey: 'grant.amount-parameters',
      version: 2
    }));
    explanationEvents.next({
      kind: 'completed', message: 'Explicação segura.', canApply: false,
      evidence: {
        schemaVersion: 'v1', definitionHash: 'd', conditionHash: 'c', resolvedVersion: 2,
        exposureMode: 'summary_only', redactionMode: 'summary_only', sourceRefCount: 1
      }
    });
    expect(component.state()).toMatchObject({ kind: 'completed', canApply: false });
  });

  it('drops a response that arrives after the selected decision changes', () => {
    const first = new Subject<DecisionExplanationEvent>();
    const second = new Subject<DecisionExplanationEvent>();
    explain.mockReturnValueOnce(first.asObservable()).mockReturnValueOnce(second.asObservable());
    const component = TestBed.runInInjectionContext(() => new DecisionExplanationComponent());
    component.decision = decision(2);
    component.config = config;
    component.explain();
    component.decision = decision(3);
    component.ngOnChanges();
    component.explain();

    first.next({ kind: 'failed', reason: 'failed' });
    second.next({ kind: 'progress' });
    expect(component.state()).toEqual({ kind: 'progress' });
  });

  it('does not expose the command for fixture or unversioned decisions', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionExplanationComponent());
    component.decision = { ...decision(), configVersion: undefined };
    component.config = config;
    expect(component.available()).toBe(false);
    component.config = { ...config, mode: 'fixture', configApiBaseUrl: null };
    expect(component.available()).toBe(false);
  });

  it('lets the user cancel a request that is still in progress', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionExplanationComponent());
    component.decision = decision();
    component.config = config;
    component.explain();
    component.cancel();

    expect(component.state()).toEqual({ kind: 'failed', reason: 'cancelled' });
  });

  it('leaves progress with a recoverable failure after the absolute timeout', () => {
    vi.useFakeTimers();
    const component = TestBed.runInInjectionContext(() => new DecisionExplanationComponent());
    component.decision = decision();
    component.config = config;
    component.explain();
    vi.advanceTimersByTime(90_000);

    expect(component.state()).toEqual({ kind: 'failed', reason: 'failed' });
    vi.useRealTimers();
  });

  it('surfaces observable progress phase labels before terminal completion', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionExplanationComponent());
    component.decision = decision();
    component.config = config;
    component.explain();

    explanationEvents.next({ kind: 'progress', phase: 'inspecting_evidence', eventSeq: 2 });
    expect(component.progressPhaseLabel(component.state())).toContain('Inspecionando evidências');

    explanationEvents.next({ kind: 'progress', phase: 'synthesizing', eventSeq: 3 });
    expect(component.progressPhaseLabel(component.state())).toContain('Sintetizando explicação');
  });

  it('renders attested safe facts and omittedFields disclosures without nested cards in DOM', () => {
    const fixture = TestBed.createComponent(DecisionExplanationComponent);
    fixture.componentRef.setInput('decision', decision());
    fixture.componentRef.setInput('config', config);
    fixture.componentRef.setInput('viewDepth', 'business');
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.explain-button') as HTMLButtonElement;
    trigger.click();
    explanationEvents.next({
      kind: 'completed',
      message: 'Regra avaliada com segurança.',
      canApply: false,
      evidence: {
        schemaVersion: 'v1',
        definitionHash: 'd',
        conditionHash: 'c',
        resolvedVersion: 2,
        exposureMode: 'summary_only',
        redactionMode: 'summary_only',
        sourceRefCount: 1,
        omittedFields: ['factCatalog.secretOrDeniedFacts', 'conditionAst.containsRestrictedFacts'],
        facts: [
          {
            path: 'request.days',
            label: 'Dias solicitados',
            valueType: 'number',
            nullable: false,
            sensitivity: 'NON_SENSITIVE',
            redaction: 'NONE',
            unit: 'days',
            mask: '999',
            description: 'Total de dias pedidos.',
            hint: 'Até 30 dias.'
          }
        ]
      }
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const omittedEl = el.querySelector('[data-testid="ai-explanation-omitted-fields"]');
    expect(omittedEl?.textContent).toContain('Fatos secretos ou vedados para IA omitidos');
    expect(omittedEl?.textContent).toContain('Expressão completa omitida por referenciar dado restrito');

    const attestedEl = el.querySelector('[data-testid="ai-explanation-attested-facts"]');
    expect(attestedEl?.textContent).toContain('Dias solicitados');
    expect(attestedEl?.textContent).toContain('dias');
    expect(attestedEl?.textContent).toContain('999');
    fixture.destroy();
  });
});
