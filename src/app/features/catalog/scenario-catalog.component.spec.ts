import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { describe, expect, it } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import { ScenarioCatalogComponent } from './scenario-catalog.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('ScenarioCatalogComponent', () => {
  it('projects canonical scenario values as human labels without changing their transport values', () => {
    TestBed.configureTestingModule({ providers: [PolicyStudioI18n] });
    const component = TestBed.runInInjectionContext(() => new ScenarioCatalogComponent());
    const scenario = {
      expectedOutput: { granted: true },
      facts: { request: { amount: 500 } }
    } as any;

    expect(component.outcome('ALLOW')).toBe('Permitida');
    expect(component.status('DISABLED')).toBe('Desativado');
    expect(JSON.parse(component.expectedOutput(scenario))).toEqual({ granted: true });
    expect(JSON.parse(component.factsJson(scenario))).toEqual({ request: { amount: 500 } });
    expect(component.assertions(['A', 'B'])).toBe('A\nB');
  });
});
