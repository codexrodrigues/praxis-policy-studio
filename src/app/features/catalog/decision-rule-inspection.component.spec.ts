import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import { buildRuleParameterDisplayEntries } from '../../core/rule-parameters-display';
import type { DecisionSummary } from './catalog.fixture';
import { DecisionRuleInspectionComponent } from './decision-rule-inspection.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

function makeDecision(): DecisionSummary {
  return {
    order: 1,
    totalDecisions: 1,
    key: 'workforce.attendance.retroactive',
    code: 'WF-10',
    name: 'Lançamento retroativo',
    domain: 'human-resources.attendance',
    ruleSet: 'Frequências · Lançamento',
    ruleSetKey: 'human-resources.attendance.launch',
    resourceKey: 'human-resources.attendance',
    serviceKey: 'attendance-service',
    state: 'verified',
    meaning: 'Permite lançamentos dentro da janela autorizada.',
    authority: 'CONFIG_AUTHORITATIVE',
    baselineAuthority: 'LEGACY_RECOVERED',
    source: 'config',
    evidenceCount: 1,
    authoringSupported: true,
    availableDefinitionActions: [],
    expression: 'retroactiveDays <= maxRetroactiveDays',
    condition: {
      '<=': [{ var: 'draft:retroactiveDays' }, { var: 'params.maxRetroactiveDays' }]
    },
    factPaths: ['draft:retroactiveDays'],
    facts: [
      {
        path: 'draft:retroactiveDays',
        valueType: 'number',
        nullable: false,
        label: 'retroactiveDays',
        description: 'Dias retroativos informados',
        providerRef: 'attendance',
        evidenceRefs: [],
        sensitivity: 'SENSITIVE',
        redaction: 'MASK'
      }
    ],
    nullSemantics: 'FAIL_CLOSED',
    operationKeys: ['CREATE'],
    hostContractVersion: '1.0',
    evidence: [],
    draftLifecycle: null,
    parameterCatalog: {
      definitionId: 'def-1',
      ruleKey: 'workforce.attendance.retroactive',
      version: 1,
      schemaVersion: '1.0',
      templateKey: 'retroactive-window',
      templateVersion: '1',
      parameters: [
        {
          name: 'maxRetroactiveDays',
          label: 'Limite máximo de dias',
          type: 'INTEGER',
          required: true,
          nullable: false,
          readOnly: false,
          defaultValue: 60,
          effectiveValue: 30,
          unit: 'days'
        }
      ]
    }
  };
}

describe('DecisionRuleInspectionComponent', () => {
  let fixture: ComponentFixture<DecisionRuleInspectionComponent>;

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DecisionRuleInspectionComponent],
      providers: [PolicyStudioI18n]
    }).compileComponents();
  });

  it('renders business-readable clauses with collapsed criteria toggle by default and opens technical disclosure when toggled', () => {
    const decision = makeDecision();
    const params = buildRuleParameterDisplayEntries(decision, {}, 'pt-BR', 'padrão');

    fixture = TestBed.createComponent(DecisionRuleInspectionComponent);
    fixture.componentRef.setInput('decision', decision);
    fixture.componentRef.setInput('viewDepth', 'business');
    fixture.componentRef.setInput('parameters', params);
    fixture.componentRef.setInput('maturityPosture', {
      technicalMaturity: 'STRUCTURAL_VERIFIED',
      approvalStage: 'PROMOTED_READY',
      operationalAuthority: 'CONFIG_ACTIVE_SNAPSHOT',
      activeSnapshotKey: 'snap-1',
      sensitiveFactsCount: 1,
      redactedFactsCount: 1,
      totalFacts: 1
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const clauses = el.querySelectorAll('[data-testid="rule-readable-clause"]');
    expect(clauses.length).toBe(1);
    expect(clauses[0]?.textContent).toContain('Retroactive Days');
    expect(clauses[0]?.textContent).toContain('30 dias');
    expect(el.textContent).not.toContain('JSON Logic');

    const disclosure = el.querySelector('[data-testid="rule-expression-disclosure"]');
    expect(disclosure?.hasAttribute('open')).toBe(false);
    expect(disclosure?.querySelector('summary')?.textContent?.trim()).toBe('Ver critério lógico completo');
    expect(el.querySelector('[data-testid="fact-redaction-summary"]')?.textContent).toContain(
      '1/1 fatos sensíveis/restritos · 1/1 com política de redaction'
    );

    const privacySpy = vi.fn();
    fixture.componentInstance.openAccessPrivacyRequested.subscribe(privacySpy);
    const privacyBtn = fixture.debugElement.query(By.css('[data-testid="rule-privacy-bridge-btn"]'))
      .nativeElement as HTMLButtonElement;
    privacyBtn.click();
    expect(privacySpy).toHaveBeenCalledOnce();

    fixture.componentRef.setInput('viewDepth', 'technical');
    fixture.detectChanges();
    expect(disclosure?.hasAttribute('open')).toBe(true);
    expect(disclosure?.querySelector('summary')?.textContent?.trim()).toBe('Expressão lógica da decisão');
    expect(el.textContent).toContain('draft:retroactiveDays');
  });

  it('renders compound substr/toNumber expressions without question marks and toggles reference pill while editing', () => {
    const decision = makeDecision();
    const complexDecision: DecisionSummary = {
      ...decision,
      condition: {
        and: [
          { '!=': [{ var: 'draft.horaEntrada' }, null] },
          {
            '>=': [
              { '+': [{ '*': [{ toNumber: [{ substr: [{ var: 'draft.horaSaida' }, 0, 2] }] }, 60] }, { toNumber: [{ substr: [{ var: 'draft.horaSaida' }, 3, 2] }] }] },
              { '+': [{ '*': [{ toNumber: [{ substr: [{ var: 'draft.horaEntrada' }, 0, 2] }] }, 60] }, { toNumber: [{ substr: [{ var: 'draft.horaEntrada' }, 3, 2] }] }] }
            ]
          }
        ]
      },
      facts: [
        {
          path: 'draft.horaEntrada',
          valueType: 'string',
          nullable: true,
          label: 'Hora Entrada',
          description: 'Hora de início.',
          providerRef: 'attendance',
          evidenceRefs: [],
          sensitivity: 'NON_SENSITIVE',
          redaction: 'NONE'
        },
        {
          path: 'draft.horaSaida',
          valueType: 'string',
          nullable: true,
          label: 'Hora Saída',
          description: 'Hora de término.',
          providerRef: 'attendance',
          evidenceRefs: [],
          sensitivity: 'NON_SENSITIVE',
          redaction: 'NONE'
        }
      ]
    };

    fixture = TestBed.createComponent(DecisionRuleInspectionComponent);
    fixture.componentRef.setInput('decision', complexDecision);
    fixture.componentRef.setInput('viewDepth', 'business');
    fixture.componentRef.setInput('canEditRule', true);
    fixture.componentRef.setInput('editingActive', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const formatted = el.querySelector('[data-testid="rule-formatted-expression"]')?.textContent ?? '';
    expect(formatted).not.toContain('?');
    expect(formatted).toContain('minutos(Hora Saída) ≥ minutos(Hora Entrada)');
    expect(el.querySelector('[data-testid="rule-reference-pill"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="rule-edit-draft-btn"]')).toBeNull();

    fixture.componentRef.setInput('viewDepth', 'technical');
    fixture.detectChanges();
    const techFormatted = el.querySelector('[data-testid="rule-formatted-expression"]')?.textContent ?? '';
    expect(techFormatted).not.toContain('?');
    expect(techFormatted).toContain('toNumber(substr(draft.horaSaida, 0, 2)) * 60');
  });

  it('filters rule fact cards from catalog-only facts and hides technical path details in business mode', () => {
    const decision = makeDecision();
    const extended: DecisionSummary = {
      ...decision,
      evaluatedFactPaths: ['draft:retroactiveDays'],
      facts: [
        {
          ...decision.facts[0]!,
          description: 'Dias retroativos informados. Orientação operacional: Informe inteiro positivo.'
        },
        {
          path: 'neighborhood.otherRecords',
          valueType: 'string-array',
          nullable: true,
          label: 'neighborhood: otherRecords',
          description: 'Outros registros da operação.',
          providerRef: 'attendance',
          evidenceRefs: [],
          sensitivity: 'NON_SENSITIVE',
          redaction: 'NONE'
        }
      ]
    };

    fixture = TestBed.createComponent(DecisionRuleInspectionComponent);
    fixture.componentRef.setInput('decision', extended);
    fixture.componentRef.setInput('viewDepth', 'business');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.rule-facts-col > section > .fact-cards > .fact-card').length).toBe(1);
    expect(el.querySelector('.fact-hint-note')?.textContent).toContain('Informe inteiro positivo.');
    const otherDisclosure = el.querySelector('[data-testid="rule-other-catalog-facts"]');
    expect(otherDisclosure).toBeTruthy();
    expect(otherDisclosure?.hasAttribute('open')).toBe(false);
    expect(otherDisclosure?.textContent).toContain('Outros dados disponíveis na operação (1)');
  });
});
