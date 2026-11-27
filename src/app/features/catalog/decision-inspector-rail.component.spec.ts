import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DecisionDiscoveryService } from '../../core/decision-discovery.service';
import { DecisionExplanationService } from '../../core/decision-explanation.service';
import { PolicyStudioI18n } from '../../core/i18n';
import type { RuleDocumentationDescriptor } from '../../core/rule-documentation';
import { DecisionInspectorRailComponent } from './decision-inspector-rail.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('DecisionInspectorRailComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PolicyStudioI18n,
        { provide: DecisionExplanationService, useValue: { explain: () => new Subject().asObservable() } },
        { provide: DecisionDiscoveryService, useValue: { discover: () => new Subject().asObservable() } }
      ]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('tracks copied canonical identifiers with timed reset and computes legalBasisCount', () => {
    vi.useFakeTimers();
    const component = TestBed.runInInjectionContext(() => new DecisionInspectorRailComponent());
    const doc = signal<RuleDocumentationDescriptor | null>({
      title: 'Limite de dias',
      legalBasis: [
        { code: 'Decreto 10/2025' },
        { code: 'Portaria 20/2025' }
      ]
    });
    Object.defineProperty(component, 'documentation', { configurable: true, value: doc });

    expect(component.legalBasisCount()).toBe(2);

    const writeText = vi.fn().mockResolvedValue(void 0);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    component.copyText('ruleKey', 'workforce.leave.max-days');
    expect(writeText).toHaveBeenCalledWith('workforce.leave.max-days');
    expect(component.copiedField()).toBe('ruleKey');

    vi.advanceTimersByTime(1800);
    expect(component.copiedField()).toBeNull();
  });

  it('prefers domainLabel and ruleSetLabel in business mode and falls back to raw slugs in technical mode', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionInspectorRailComponent());
    const decision = {
      domain: 'administracao-pessoal',
      domainLabel: 'Frequência e Afastamentos',
      ruleSet: 'administracao-pessoal.afastamentos',
      ruleSetLabel: 'Concessão de Afastamentos'
    } as import('../../features/catalog/catalog.fixture').DecisionSummary;

    expect(component.displayDomain(decision)).toBe('Frequência e Afastamentos');
    expect(component.displayRuleSet(decision)).toBe('Concessão de Afastamentos');

    Object.defineProperty(component, 'viewDepth', {
      configurable: true,
      value: signal<'business' | 'technical'>('technical')
    });
    expect(component.displayDomain(decision)).toBe('administracao-pessoal');
    expect(component.displayRuleSet(decision)).toBe('administracao-pessoal.afastamentos');
  });
});
