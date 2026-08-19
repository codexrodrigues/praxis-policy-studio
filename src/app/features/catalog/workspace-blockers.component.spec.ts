import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { describe, expect, it } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import { WorkspaceBlockersComponent } from './workspace-blockers.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('WorkspaceBlockersComponent', () => {
  it('maps stable blocker codes and fails closed for unknown codes', () => {
    TestBed.configureTestingModule({ providers: [PolicyStudioI18n] });
    const component = TestBed.runInInjectionContext(() => new WorkspaceBlockersComponent());
    expect(component.label('ACTIVE_SCENARIO_REQUIRED'))
      .toBe('Cadastre e ative ao menos um cenário antes de solicitar revisão.');
    expect(component.label('FUTURE_BLOCKER')).toContain('ainda não reconhece');
  });
});
