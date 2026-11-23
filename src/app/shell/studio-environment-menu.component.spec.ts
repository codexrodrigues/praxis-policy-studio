import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PolicyStudioI18n } from '../core/i18n';
import { StudioEnvironmentMenuComponent } from './studio-environment-menu.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('StudioEnvironmentMenuComponent', () => {
  let fixture: ComponentFixture<StudioEnvironmentMenuComponent>;

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('keeps accessible host combobox ready and reveals structured scope details inside popover', () => {
    TestBed.configureTestingModule({
      imports: [StudioEnvironmentMenuComponent],
      providers: [PolicyStudioI18n]
    });

    fixture = TestBed.createComponent(StudioEnvironmentMenuComponent);
    fixture.componentInstance.isRemoteMode = true;
    fixture.componentInstance.hostProfiles = [
      { id: 'primary', labelPtBr: 'Host Padrão', labelEnUs: 'Default Host', apiBaseUrl: '' },
      { id: 'enterprise', labelPtBr: 'Corporativo', labelEnUs: 'Enterprise', apiBaseUrl: 'http://127.0.0.1:8080' }
    ];
    fixture.componentInstance.activeHostProfileId = 'primary';
    fixture.componentInstance.activeHostLabel = 'Host Padrão';
    fixture.componentInstance.tenantId = 'rio';
    fixture.componentInstance.organizationId = 'ALL';
    fixture.componentInstance.environment = 'local';
    fixture.detectChanges();

    const select = fixture.debugElement.query(By.css('select')).nativeElement as HTMLSelectElement;
    expect(select.getAttribute('aria-label')).toBe('Host governado');
    expect(select.options).toHaveLength(2);

    const hostSelectedSpy = vi.fn();
    fixture.componentInstance.hostProfileSelected.subscribe(hostSelectedSpy);
    select.value = 'enterprise';
    select.dispatchEvent(new Event('change'));
    expect(hostSelectedSpy).toHaveBeenCalledWith('enterprise');

    expect(fixture.debugElement.query(By.css('[data-testid="studio-environment-popover"]'))).toBeNull();
    const trigger = fixture.debugElement.query(By.css('[data-testid="studio-environment-trigger"]')).nativeElement as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const popover = fixture.debugElement.query(By.css('[data-testid="studio-environment-popover"]')).nativeElement as HTMLElement;
    expect(popover.textContent).toContain('rio');
    expect(popover.textContent).toContain('ALL');
    expect(popover.textContent).toContain('local');
  });
});
