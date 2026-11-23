import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioIconName } from './studio-icon.component';
import { TermPopoverComponent } from './term-popover.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('TermPopoverComponent', () => {
  let fixture: ComponentFixture<TermPopoverComponent>;

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TermPopoverComponent]
    }).compileComponents();
  });

  function createComponent(overrides?: {
    term?: string;
    summary?: string;
    detail?: string | null;
    variant?: 'inline' | 'chip';
    icon?: StudioIconName | null;
    actionLabel?: string | null;
  }): TermPopoverComponent {
    fixture = TestBed.createComponent(TermPopoverComponent);
    fixture.componentRef.setInput('term', overrides?.term ?? 'Parametrizável');
    fixture.componentRef.setInput(
      'summary',
      overrides?.summary ?? 'Você pode ajustar limites e prazos sem alterar a lógica central.'
    );
    fixture.componentRef.setInput('detail', overrides?.detail ?? 'Passa por revisão 4-olhos.');
    fixture.componentRef.setInput('variant', overrides?.variant ?? 'chip');
    fixture.componentRef.setInput('icon', overrides?.icon ?? null);
    fixture.componentRef.setInput('actionLabel', overrides?.actionLabel ?? null);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('opens on click toggle, renders summary/detail, omits decorative ? dot, and closes cleanly on Escape', () => {
    const component = createComponent({ icon: 'sliders' });
    const trigger = fixture.debugElement.query(By.css('.pax-term-trigger')).nativeElement as HTMLButtonElement;

    expect(fixture.debugElement.query(By.css('.pax-term-hint-dot'))).toBeNull();
    expect(fixture.debugElement.query(By.css('pax-icon svg'))).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.debugElement.query(By.css('.pax-term-card'))).toBeNull();

    trigger.click();
    fixture.detectChanges();

    const card = fixture.debugElement.query(By.css('.pax-term-card')).nativeElement as HTMLElement;
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(card.textContent).toContain('Parametrizável');
    expect(card.textContent).toContain('Você pode ajustar limites e prazos');
    expect(card.textContent).toContain('Passa por revisão 4-olhos.');

    component.onEscape();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.debugElement.query(By.css('.pax-term-card'))).toBeNull();
  });

  it('clamps the floating popover inside the viewport near right/bottom edges and emits actionTriggered', () => {
    const component = createComponent({ variant: 'inline', actionLabel: 'Ver detalhes técnicos' });
    const hostElement = fixture.debugElement.nativeElement as HTMLElement;
    expect(hostElement.classList.contains('is-inline-host')).toBe(true);
    expect(fixture.debugElement.query(By.css('pax-icon'))).toBeNull();
    const trigger = fixture.debugElement.query(By.css('.pax-term-trigger')).nativeElement as HTMLButtonElement;
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      x: 1180,
      y: 660,
      width: 140,
      height: 24,
      top: 660,
      right: 1320,
      bottom: 684,
      left: 1180,
      toJSON: () => ({})
    } as DOMRect);

    const actionSpy = vi.fn();
    component.actionTriggered.subscribe(actionSpy);

    trigger.click();
    fixture.detectChanges();

    expect(component.cardLeft()).toBeLessThanOrEqual(window.innerWidth - 336 - 12);
    expect(component.cardTop()).toBeLessThan(660);

    const actionBtn = fixture.debugElement.query(By.css('.pax-term-card-action')).nativeElement as HTMLButtonElement;
    actionBtn.click();
    fixture.detectChanges();

    expect(actionSpy).toHaveBeenCalledTimes(1);
    expect(component.open()).toBe(false);
  });
});
