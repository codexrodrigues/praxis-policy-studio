import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { describe, expect, it } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import { ScenarioCreateFormComponent } from './scenario-create-form.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('ScenarioCreateFormComponent', () => {
  it('projects canonical outcomes as human labels', () => {
    TestBed.configureTestingModule({ providers: [PolicyStudioI18n] });
    const component = TestBed.runInInjectionContext(() => new ScenarioCreateFormComponent());
    expect(component.outcome('ALLOW')).toBe('Permitida');
    expect(component.outcome('TECHNICAL_ERROR')).toBe('Erro técnico');
  });
});
