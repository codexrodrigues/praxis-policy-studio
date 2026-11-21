import '@angular/compiler';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { POLICY_STUDIO_COPY, PolicyStudioI18n } from '../../core/i18n';
import {
  isSafeLegalBasisUrl,
  RULE_DOCUMENTATION_LIMITS,
  type RuleDocumentationDescriptor
} from '../../core/rule-documentation';
import { DecisionDocumentationEditorComponent } from './decision-documentation-editor.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

@Component({
  imports: [DecisionDocumentationEditorComponent],
  template: `
    <pax-decision-documentation-editor
      [documentation]="doc()"
      [idPrefix]="prefix()"
      [collapsedByDefault]="collapsed()"
      (documentationChanged)="lastDoc = $event"
      (validationErrorsChanged)="lastErrors = $event" />
  `
})
class HostComponent {
  readonly doc = signal<RuleDocumentationDescriptor | null>(null);
  readonly prefix = signal('test-doc');
  readonly collapsed = signal(false);
  lastDoc: RuleDocumentationDescriptor | null = null;
  lastErrors: readonly string[] = [];
}

describe('DecisionDocumentationEditorComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [PolicyStudioI18n]
    });
  });

  it('maintains 100% pt-BR and en-US key and placeholder parity in i18n catalog', () => {
    const ptKeys = Object.keys(POLICY_STUDIO_COPY['pt-BR']).sort();
    const enKeys = Object.keys(POLICY_STUDIO_COPY['en-US']).sort();
    expect(ptKeys).toEqual(enKeys);

    const extractPlaceholders = (text: string): string[] =>
      [...(text.match(/\{[^}]+\}/g) ?? [])].sort();

    for (const key of ptKeys as (keyof typeof POLICY_STUDIO_COPY['pt-BR'])[]) {
      const ptPlaceholders = extractPlaceholders(POLICY_STUDIO_COPY['pt-BR'][key]);
      const enPlaceholders = extractPlaceholders(POLICY_STUDIO_COPY['en-US'][key]);
      expect(enPlaceholders, `Placeholder mismatch for i18n key ${String(key)}`).toEqual(ptPlaceholders);
    }
  });

  it('edits all 6 didactic fields, associates unique labels without spinbuttons, and clears to null when emptied', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('input[type="number"]').length).toBe(0);

    const setInput = (testId: string, value: string) => {
      const el = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-testid="${testId}"]`)!;
      expect(el).toBeTruthy();
      expect(host.querySelector(`label[for="${el.id}"]`)).toBeTruthy();
      el.value = value;
      el.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    setInput('test-doc-title', '  Teto para auxílio extraordinário  ');
    setInput('test-doc-summary', 'Verifica se o valor solicitado respeita o teto vigente.');
    setInput('test-doc-when-applies', 'Na criação e edição de solicitações.');
    setInput('test-doc-rationale', 'Assegura equilíbrio orçamentário.');
    setInput('test-doc-customization-guidance', 'Parametrizável pelo órgão via Studio.');

    host.querySelector<HTMLButtonElement>('[data-testid="test-doc-legal-add"]')!.click();
    fixture.detectChanges();

    setInput('test-doc-legal-code-0', 'Decreto 10.100/2024');
    setInput('test-doc-legal-title-0', 'Regulamento de Benefícios');
    setInput('test-doc-legal-article-0', 'Art. 12, § 2º');
    setInput('test-doc-legal-jurisdiction-0', 'Federal');
    setInput('test-doc-legal-summary-0', 'Limita o benefício ao teto anual.');
    setInput('test-doc-legal-url-0', 'https://legislacao.example.gov.br/decreto-10100');

    expect(fixture.componentInstance.lastErrors).toEqual([]);
    expect(fixture.componentInstance.lastDoc).toEqual({
      title: 'Teto para auxílio extraordinário',
      summary: 'Verifica se o valor solicitado respeita o teto vigente.',
      whenApplies: 'Na criação e edição de solicitações.',
      rationale: 'Assegura equilíbrio orçamentário.',
      customizationGuidance: 'Parametrizável pelo órgão via Studio.',
      legalBasis: [{
        code: 'Decreto 10.100/2024',
        title: 'Regulamento de Benefícios',
        article: 'Art. 12, § 2º',
        jurisdiction: 'Federal',
        summary: 'Limita o benefício ao teto anual.',
        url: 'https://legislacao.example.gov.br/decreto-10100'
      }]
    });
    expect(host.querySelector('a.doc-url-link')?.getAttribute('rel')).toBe('noopener noreferrer');

    // Clearing all fields returns null
    host.querySelector<HTMLButtonElement>('[data-testid="test-doc-legal-remove-0"]')!.click();
    fixture.detectChanges();
    setInput('test-doc-title', '');
    setInput('test-doc-summary', '');
    setInput('test-doc-when-applies', '');
    setInput('test-doc-rationale', '');
    setInput('test-doc-customization-guidance', '');

    expect(fixture.componentInstance.lastDoc).toBeNull();
    expect(fixture.componentInstance.lastErrors).toEqual([]);
  });

  it('enforces backend limits (255, 4000, 20), non-empty legalBasis identity, and safe http/https URLs', () => {
    expect(isSafeLegalBasisUrl('https://normas.example.gov/lei')).toBe(true);
    expect(isSafeLegalBasisUrl('http://normas.example.gov/lei')).toBe(true);
    expect(isSafeLegalBasisUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeLegalBasisUrl('//evil.example/lei')).toBe(false);
    expect(isSafeLegalBasisUrl('https://user:secret@example.gov/lei')).toBe(false);
    expect(isSafeLegalBasisUrl(`https://example.gov/${'a'.repeat(1020)}`)).toBe(false);

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const titleEl = host.querySelector<HTMLInputElement>('[data-testid="test-doc-title"]')!;
    titleEl.value = 'A'.repeat(RULE_DOCUMENTATION_LIMITS.titleMaxLength + 1);
    titleEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(host.querySelector('[data-testid="test-doc-title-error"]')?.getAttribute('role')).toBe('alert');
    expect(fixture.componentInstance.lastErrors.length).toBeGreaterThan(0);

    titleEl.value = 'Valid title';
    titleEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const summaryEl = host.querySelector<HTMLTextAreaElement>('[data-testid="test-doc-summary"]')!;
    summaryEl.value = 'S'.repeat(RULE_DOCUMENTATION_LIMITS.textMaxLength + 1);
    summaryEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.querySelector('[data-testid="test-doc-summary-error"]')).toBeTruthy();

    summaryEl.value = 'Valid summary';
    summaryEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // Add an empty legalBasis row -> triggers identity required error
    host.querySelector<HTMLButtonElement>('[data-testid="test-doc-legal-add"]')!.click();
    fixture.detectChanges();
    expect(host.querySelector('[data-testid="test-doc-legal-identity-error-0"]')).toBeTruthy();

    // Provide code + unsafe URL -> triggers URL error and does NOT render clickable <a>
    const codeEl = host.querySelector<HTMLInputElement>('[data-testid="test-doc-legal-code-0"]')!;
    codeEl.value = 'Lei 1/2025';
    codeEl.dispatchEvent(new Event('input'));
    const urlEl = host.querySelector<HTMLInputElement>('[data-testid="test-doc-legal-url-0"]')!;
    urlEl.value = 'javascript:alert(1)';
    urlEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(host.querySelector('[data-testid="test-doc-legal-url-error-0"]')).toBeTruthy();
    expect(host.querySelector('a.doc-url-link')).toBeNull();
    expect(fixture.componentInstance.lastErrors.length).toBe(1);

    // Fix URL -> errors clear; add up to 20 entries and verify add button disables
    urlEl.value = 'https://normas.example.gov/lei-1';
    urlEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.lastErrors).toEqual([]);

    for (let i = 1; i < RULE_DOCUMENTATION_LIMITS.legalBasisMaxEntries; i++) {
      host.querySelector<HTMLButtonElement>('[data-testid="test-doc-legal-add"]')!.click();
    }
    fixture.detectChanges();
    expect(host.querySelector<HTMLButtonElement>('[data-testid="test-doc-legal-add"]')!.disabled).toBe(true);
  });

  it('supports collapsedByDefault toggle and renders English validation messages when locale is en-US', () => {
    const i18n = TestBed.inject(PolicyStudioI18n);
    i18n.locale.set('en-US');

    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.collapsed.set(true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[data-testid="test-doc-fields"]')).toBeNull();
    host.querySelector<HTMLButtonElement>('[data-testid="test-doc-toggle"]')!.click();
    fixture.detectChanges();
    expect(host.querySelector('[data-testid="test-doc-fields"]')).toBeTruthy();

    host.querySelector<HTMLButtonElement>('[data-testid="test-doc-legal-add"]')!.click();
    fixture.detectChanges();
    expect(host.querySelector('[data-testid="test-doc-legal-identity-error-0"]')?.textContent)
      .toContain('Legal basis #1: provide at least code, title, article, or summary.');
  });
});
