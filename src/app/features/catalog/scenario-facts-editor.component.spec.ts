import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { describe, expect, it } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import { ScenarioFactsEditorComponent } from './scenario-facts-editor.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('ScenarioFactsEditorComponent', () => {
  it('formats governed scalar and collection values without changing their canonical value', () => {
    TestBed.configureTestingModule({ providers: [PolicyStudioI18n] });
    const component = TestBed.runInInjectionContext(() => new ScenarioFactsEditorComponent());
    Object.defineProperty(component, 'values', { value: () => ({
      'request.amount': 500,
      'request.tags': ['priority', 'review'],
      'request.optional': null
    }) });

    expect(component.displayValue('request.amount')).toBe('500');
    expect(component.displayValue('request.tags')).toBe('priority, review');
    expect(component.displayValue('request.optional')).toBe('');
    expect(component.isNull('request.optional')).toBe(true);
  });
});
