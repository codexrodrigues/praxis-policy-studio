import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PolicyStudioI18n } from '../core/i18n';
import { STUDIO_NAV_ITEMS, buildVisibleNavGroups } from '../core/studio-navigation';
import { StudioSidebarNavComponent } from './studio-sidebar-nav.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('StudioSidebarNavComponent', () => {
  let fixture: ComponentFixture<StudioSidebarNavComponent>;

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('renders grouped modules, active indicator, review badge, and emits collapse/selection events', () => {
    TestBed.configureTestingModule({
      imports: [StudioSidebarNavComponent],
      providers: [PolicyStudioI18n]
    });

    fixture = TestBed.createComponent(StudioSidebarNavComponent);
    fixture.componentInstance.groups = buildVisibleNavGroups(
      STUDIO_NAV_ITEMS,
      () => true,
      { reviewQueue: 5 }
    );
    fixture.componentInstance.activeItemId = 'reviews';
    fixture.componentInstance.isRemoteMode = true;
    fixture.detectChanges();

    const reviewsBtn = fixture.debugElement.query(By.css('[data-testid="nav-module-reviews"]')).nativeElement as HTMLButtonElement;
    expect(reviewsBtn.getAttribute('aria-current')).toBe('page');
    expect(reviewsBtn.getAttribute('aria-label')).toContain('5');
    expect(fixture.debugElement.query(By.css('[data-testid="nav-badge-reviews"]')).nativeElement.textContent?.trim()).toBe('5');
    expect(fixture.debugElement.query(By.css('[data-testid="nav-badge-dot-reviews"]'))).toBeNull();

    fixture.componentInstance.collapsed = true;
    fixture.detectChanges();
    expect(reviewsBtn.getAttribute('title')).toContain('5');
    expect(fixture.debugElement.query(By.css('[data-testid="nav-badge-dot-reviews"]'))).not.toBeNull();

    fixture.componentInstance.collapsed = false;
    fixture.detectChanges();

    const selectedSpy = vi.fn();
    const toggleSpy = vi.fn();
    fixture.componentInstance.itemSelected.subscribe(selectedSpy);
    fixture.componentInstance.toggleCollapseRequested.subscribe(toggleSpy);

    const accessBtn = fixture.debugElement.query(By.css('[data-testid="workspace-track-authorization"]')).nativeElement as HTMLButtonElement;
    accessBtn.click();
    expect(selectedSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'access', route: '/access' }));

    const collapseBtn = fixture.debugElement.query(By.css('[data-testid="studio-sidebar-toggle"]')).nativeElement as HTMLButtonElement;
    collapseBtn.click();
    expect(toggleSpy).toHaveBeenCalledOnce();
  });
});
