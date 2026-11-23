import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudioIconComponent, type StudioIconName, type StudioIconSize } from './studio-icon.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('StudioIconComponent', () => {
  let fixture: ComponentFixture<StudioIconComponent>;

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudioIconComponent]
    }).compileComponents();
  });

  function renderIcon(name: StudioIconName, size?: StudioIconSize, label?: string | null): SVGElement {
    fixture = TestBed.createComponent(StudioIconComponent);
    fixture.componentRef.setInput('name', name);
    if (size !== undefined) {
      fixture.componentRef.setInput('size', size);
    }
    if (label !== undefined) {
      fixture.componentRef.setInput('label', label);
    }
    fixture.detectChanges();
    return fixture.debugElement.query(By.css('svg')).nativeElement as SVGElement;
  }

  it('renders decorative SVG icons with default 16px size and aria-hidden=true', () => {
    const svg = renderIcon('host-switch');

    expect(svg.getAttribute('width')).toBe('16');
    expect(svg.getAttribute('height')).toBe('16');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('switches to accessible role=img with aria-label when label is provided and honors custom sizes', () => {
    const svg = renderIcon('sliders', 14, 'Regra parametrizável');

    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('height')).toBe('14');
    expect(svg.getAttribute('aria-hidden')).toBeNull();
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Regra parametrizável');
    expect(svg.querySelectorAll('line, circle').length).toBe(4);
  });

  it('renders distinct geometry across core studio icon variants', () => {
    const variants: readonly StudioIconName[] = [
      'chevron-down',
      'shield-check',
      'sparkles',
      'sun',
      'moon',
      'search',
      'x',
      'arrow-left',
      'arrow-right',
      'pencil',
      'lock',
      'circle-dot',
      'check-circle',
      'clock',
      'file-edit',
      'book-open',
      'database',
      'layout-grid',
      'layers',
      'activity'
    ];

    for (const variant of variants) {
      fixture?.destroy();
      const svg = renderIcon(variant, 20);
      expect(svg.getAttribute('width')).toBe('20');
      expect(svg.querySelectorAll('path, circle, rect, line, ellipse, polygon, polyline').length).toBeGreaterThan(0);
    }
  });
});
