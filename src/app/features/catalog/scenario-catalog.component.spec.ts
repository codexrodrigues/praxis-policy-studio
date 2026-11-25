import '@angular/compiler';
import { ɵresolveComponentResources as resolveComponentResources, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import { ScenarioCatalogComponent } from './scenario-catalog.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('ScenarioCatalogComponent', () => {
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
    await TestBed.configureTestingModule({
      imports: [ScenarioCatalogComponent],
      providers: [PolicyStudioI18n]
    }).compileComponents();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('projects canonical scenario values as human labels without changing their transport values', () => {
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

  it('renders unified card action row, styled operation select, and primary-action save button', () => {
    const fixture = TestBed.createComponent(ScenarioCatalogComponent);
    const scenario = {
      id: 'scenario-1',
      workspaceId: 'ws-1',
      scenarioKey: 'limit-allow',
      name: 'Limite permitido',
      facts: { requestedAmount: 1000 },
      expectedDecision: 'ALLOW',
      status: 'ACTIVE',
      revision: 1,
      etag: 'etag-1'
    } as any;

    const setSig = <T>(name: string, val: T): void => {
      Object.defineProperty(fixture.componentInstance, name, { configurable: true, value: signal(val) });
    };
    setSig('scenarios', [scenario]);
    setSig('facts', []);
    setSig('editingScenarioId', 'scenario-1');
    setSig('editingFactValues', {});
    setSig('editingFactsJson', '{"requestedAmount": 1000}');
    setSig('canManage', true);
    setSig('operationalModeEnabled', true);
    setSig('operationalModes', { 'scenario-1': 'CREATE' });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const controlsRow = root.querySelector('.scenario-card-controls');
    expect(controlsRow).not.toBeNull();
    expect(controlsRow?.querySelector('button.quiet-button')).not.toBeNull();

    const modeSelect = controlsRow?.querySelector('.operation-mode select.studio-control.studio-select-inline');
    expect(modeSelect).not.toBeNull();

    const inlineEditor = root.querySelector('.scenario-inline-editor');
    expect(inlineEditor).not.toBeNull();
    expect(inlineEditor?.querySelectorAll('.studio-control').length).toBeGreaterThanOrEqual(7);

    const saveButton = inlineEditor?.querySelector('.authoring-actions button.primary-action');
    expect(saveButton?.textContent?.trim()).toBe('Salvar cenário');
  });

  it('defaults the operation select explicitly to the exclusion option when operationalModes omits a scenario id', () => {
    const fixture = TestBed.createComponent(ScenarioCatalogComponent);
    const scenario = {
      id: 'scenario-unset',
      workspaceId: 'ws-1',
      scenarioKey: 'unset-op',
      name: 'Sem operação selecionada',
      facts: {},
      expectedDecision: 'ALLOW',
      status: 'ACTIVE',
      revision: 1,
      etag: 'etag-2'
    } as any;

    const setSig = <T>(name: string, val: T): void => {
      Object.defineProperty(fixture.componentInstance, name, { configurable: true, value: signal(val) });
    };
    setSig('scenarios', [scenario]);
    setSig('facts', []);
    setSig('editingFactValues', {});
    setSig('editingFactsJson', '{}');
    setSig('canManage', true);
    setSig('operationalModeEnabled', true);
    setSig('operationalModes', {});
    fixture.detectChanges();

    const modeSelect = (fixture.nativeElement as HTMLElement).querySelector(
      '.operation-mode select.studio-control.studio-select-inline'
    ) as HTMLSelectElement | null;
    expect(modeSelect).not.toBeNull();
    expect(modeSelect?.value).toBe('');
    expect(modeSelect?.selectedIndex).toBe(0);
  });
});
