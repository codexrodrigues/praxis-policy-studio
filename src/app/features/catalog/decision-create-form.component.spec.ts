import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import { RULE_DOCUMENTATION_LIMITS } from '../../core/rule-documentation';
import { DecisionCreateFormComponent } from './decision-create-form.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('DecisionCreateFormComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DecisionCreateFormComponent],
      providers: [PolicyStudioI18n]
    });
  });

  it('embeds normalized didactic documentation into definition.documentation on POST /definitions payload', () => {
    const fixture = TestBed.createComponent(DecisionCreateFormComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const createSpy = vi.fn();
    const errorSpy = vi.fn();
    fixture.componentInstance.createRequested.subscribe(createSpy);
    fixture.componentInstance.validationFailed.subscribe(errorSpy);

    host.querySelector<HTMLButtonElement>('[data-testid="toggle-new-decision"]')!.click();
    fixture.detectChanges();

    const setInput = (testId: string, value: string) => {
      const el = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-testid="${testId}"]`)!;
      el.value = value;
      el.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    setInput('new-decision-rule-key', 'workforce.leave.max-days');
    setInput('new-decision-resource-key', 'workforce.leave-requests');
    setInput('new-decision-service-key', 'workforce-service');

    host.querySelector<HTMLButtonElement>('[data-testid="create-doc-toggle"]')!.click();
    fixture.detectChanges();

    setInput('create-doc-title', 'Limite máximo de afastamento');
    setInput('create-doc-summary', 'Garante que a solicitação não ultrapasse 30 dias.');
    setInput('create-doc-when-applies', 'Ao registrar nova solicitação de afastamento.');
    setInput('create-doc-rationale', 'Cumpre norma interna de continuidade operacional.');
    setInput('create-doc-customization-guidance', 'Ajustável via workspace governado.');

    host.querySelector<HTMLButtonElement>('[data-testid="create-doc-legal-add"]')!.click();
    fixture.detectChanges();
    setInput('create-doc-legal-code-0', 'Portaria RH 42/2025');
    setInput('create-doc-legal-article-0', 'Art. 4º');

    host.querySelector<HTMLButtonElement>('[data-testid="submit-new-decision"]')!.click();
    fixture.detectChanges();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      ruleKey: 'workforce.leave.max-days',
      resourceKey: 'workforce.leave-requests',
      serviceKey: 'workforce-service',
      definition: {
        documentation: {
          title: 'Limite máximo de afastamento',
          summary: 'Garante que a solicitação não ultrapasse 30 dias.',
          whenApplies: 'Ao registrar nova solicitação de afastamento.',
          rationale: 'Cumpre norma interna de continuidade operacional.',
          customizationGuidance: 'Ajustável via workspace governado.',
          legalBasis: [{
            code: 'Portaria RH 42/2025',
            article: 'Art. 4º'
          }]
        }
      }
    }));
  });

  it('blocks submission and emits validationFailed when didactic documentation violates backend constraints', () => {
    const fixture = TestBed.createComponent(DecisionCreateFormComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const createSpy = vi.fn();
    const errorSpy = vi.fn();
    fixture.componentInstance.createRequested.subscribe(createSpy);
    fixture.componentInstance.validationFailed.subscribe(errorSpy);

    host.querySelector<HTMLButtonElement>('[data-testid="toggle-new-decision"]')!.click();
    fixture.detectChanges();

    const setInput = (testId: string, value: string) => {
      const el = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-testid="${testId}"]`)!;
      el.value = value;
      el.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    setInput('new-decision-rule-key', 'workforce.leave.invalid-doc');
    setInput('new-decision-resource-key', 'workforce.leave-requests');

    host.querySelector<HTMLButtonElement>('[data-testid="create-doc-toggle"]')!.click();
    fixture.detectChanges();

    setInput('create-doc-title', 'T'.repeat(RULE_DOCUMENTATION_LIMITS.titleMaxLength + 1));

    host.querySelector<HTMLButtonElement>('[data-testid="submit-new-decision"]')!.click();
    fixture.detectChanges();

    expect(createSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain('255');
  });
});
