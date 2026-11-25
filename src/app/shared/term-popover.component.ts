import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { StudioIconComponent, type StudioIconName } from './studio-icon.component';

export type TermPopoverTone =
  | 'default'
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'locked'
  | 'dev';

export type TermPopoverVariant = 'inline' | 'chip';

export interface TermPopoverMetaTag {
  readonly label: string;
  readonly tone?: 'neutral' | 'info' | 'warning' | 'danger' | 'success';
}

let nextTermPopoverId = 0;

@Component({
  selector: 'pax-term-popover',
  standalone: true,
  imports: [StudioIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-inline-host]': "variantSignal() === 'inline'"
  },
  template: `<span class="pax-term-host" (mouseenter)="scheduleOpen()" (mouseleave)="scheduleClose()"><button
        #triggerBtn
        type="button"
        class="pax-term-trigger"
        [class.is-chip]="variantSignal() === 'chip'"
        [class.is-inline]="variantSignal() === 'inline'"
        [attr.data-tone]="toneSignal()"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="open() ? cardId : null"
        (click)="toggleFromClick($event)"
        (blur)="onTriggerBlur($event)"
      >@if (iconSignal(); as iconName) {<pax-icon class="pax-term-icon" [name]="iconName" [size]="14" />}<span class="pax-term-label">{{ termSignal() }}</span>@if (badgeSignal()) {<span class="pax-term-badge">{{ badgeSignal() }}</span>}</button>@if (open()) {
        <div
          #popoverCard
          class="pax-term-card"
          [id]="cardId"
          [attr.role]="(pinnedByClick() || actionLabelSignal() || externalHrefSignal()) ? 'dialog' : 'tooltip'"
          [attr.aria-label]="resolvedTitle()"
          [style.left.px]="cardLeft()"
          [style.top.px]="cardTop()"
          (mouseenter)="cancelClose()"
          (mouseleave)="scheduleClose()"
        >
          @if (categorySignal()) {
            <span class="pax-term-card-category">{{ categorySignal() }}</span>
          }
          <strong class="pax-term-card-title">{{ resolvedTitle() }}</strong>
          <p class="pax-term-card-summary">{{ summarySignal() }}</p>
          @if (hintSignal(); as hintText) {
            <div class="pax-term-card-hint">
              <pax-icon name="info" [size]="14" />
              <div class="pax-term-card-hint-body">
                @if (hintLabelSignal(); as hLabel) {
                  <strong>{{ hLabel }}</strong>
                }
                <span>{{ hintText }}</span>
              </div>
            </div>
          }
          @if (metaTagsSignal().length > 0) {
            <div class="pax-term-card-meta">
              @for (tag of metaTagsSignal(); track tag.label + ':' + $index) {
                <span class="pax-term-card-meta-pill" [attr.data-tone]="tag.tone ?? 'neutral'">
                  {{ tag.label }}
                </span>
              }
            </div>
          }
          @if (detailSignal()) {
            <p class="pax-term-card-detail">{{ detailSignal() }}</p>
          }
          @if (actionLabelSignal() || externalHrefSignal()) {
            <footer class="pax-term-card-footer">
              @if (actionLabelSignal()) {
                <button
                  type="button"
                  class="pax-term-card-action"
                  (click)="triggerAction()"
                >
                  {{ actionLabelSignal() }}
                </button>
              }
              @if (externalHrefSignal()) {
                <a
                  class="pax-term-card-link"
                  [href]="externalHrefSignal()"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ termSignal() }} ↗
                </a>
              }
            </footer>
          }
        </div>
      }</span>`,
  styles: `
    :host {
      display: inline-flex;
      max-width: 100%;
      vertical-align: baseline;
    }

    :host.is-inline-host {
      display: inline;
      vertical-align: baseline;
    }

    .pax-term-host {
      position: relative;
      display: inline-flex;
      max-width: 100%;
      align-items: center;
    }

    :host.is-inline-host .pax-term-host {
      display: inline;
      position: relative;
    }

    .pax-term-trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      max-width: 100%;
      font: inherit;
      cursor: pointer;
      text-align: left;
      transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
    }

    .pax-term-trigger.is-inline {
      display: inline;
      border: 0;
      border-radius: 2px;
      padding: 0;
      margin: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: 600;
      line-height: inherit;
      text-decoration-line: underline;
      text-decoration-style: dotted;
      text-decoration-thickness: 1.5px;
      text-underline-offset: 3px;
      text-decoration-color: color-mix(in oklab, var(--pax-color-primary, #076487) 72%, transparent);
    }

    .pax-term-trigger.is-inline:hover,
    .pax-term-trigger.is-inline[aria-expanded='true'] {
      background: var(--pax-color-info-bg, #eef7fa);
      color: var(--pax-color-info-fg, #0a3b52);
      text-decoration-color: var(--pax-color-info-fg, #0a3b52);
    }

    .pax-term-trigger.is-chip {
      border: 1px solid var(--pax-color-outline-variant, #cbd5e1);
      border-radius: var(--pax-radius-pill, 999px);
      padding: 0.25rem 0.625rem;
      background: var(--pax-color-surface-container-low, #f1f5f9);
      color: var(--pax-color-on-surface, #0f172a);
      font-size: var(--pax-text-xs, 0.75rem);
      line-height: var(--pax-lh-xs, 1.4);
      font-weight: 600;
    }

    .pax-term-trigger.is-chip[data-tone='info'],
    .pax-term-trigger.is-chip[data-tone='brand'] {
      background: var(--pax-policy-param-bg, #eef7fa);
      color: var(--pax-policy-param-fg, #0a3b52);
      border-color: var(--pax-policy-param-border, #b4daea);
    }

    .pax-term-trigger.is-chip[data-tone='success'] {
      background: var(--pax-policy-custom-bg, #ecfdf5);
      color: var(--pax-policy-custom-fg, #065f46);
      border-color: var(--pax-policy-custom-border, #a7f3d0);
    }

    .pax-term-trigger.is-chip[data-tone='locked'] {
      background: var(--pax-policy-locked-bg, #f1f5f9);
      color: var(--pax-policy-locked-fg, #334155);
      border-color: var(--pax-policy-locked-border, #cbd5e1);
    }

    .pax-term-trigger.is-chip[data-tone='warning'] {
      background: var(--pax-color-warning-container, #fef3c7);
      color: var(--pax-color-on-warning-container, #451a03);
      border-color: color-mix(in oklab, var(--pax-color-warning, #8c5308) 32%, transparent);
    }

    .pax-term-trigger.is-chip[data-tone='dev'] {
      background: var(--pax-color-dev-container, #eef2ff);
      color: var(--pax-color-on-dev-container, #1e1b4b);
      border-color: color-mix(in oklab, var(--pax-color-dev-accent, #4338ca) 38%, transparent);
    }

    .pax-term-trigger:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--pax-color-primary, #076487) 38%, transparent);
      outline-offset: 2px;
    }

    .pax-term-label {
      overflow-wrap: anywhere;
    }

    .pax-term-icon {
      opacity: 0.9;
    }

    .pax-term-badge {
      padding: 0 0.35rem;
      border-radius: var(--pax-radius-pill, 999px);
      background: color-mix(in oklab, currentColor 12%, transparent);
      font-size: var(--pax-text-xs, 0.75rem);
      font-weight: 700;
    }

    .pax-term-card {
      position: fixed;
      z-index: 2000;
      width: min(21rem, calc(100vw - 1.5rem));
      max-height: calc(100vh - 24px);
      overflow-y: auto;
      display: grid;
      gap: var(--pax-space-2, 0.5rem);
      padding: var(--pax-space-4, 1rem);
      border: 1px solid var(--pax-color-popover-border, #cbd5e1);
      border-radius: var(--pax-radius-lg, 0.75rem);
      background: var(--pax-color-popover-bg, #ffffff);
      color: var(--pax-color-on-surface, #0f172a);
      box-shadow: var(--pax-shadow-popover, 0 12px 32px rgba(15, 23, 42, 0.18));
      opacity: 1;
      text-align: left;
    }

    .pax-term-card-category {
      color: var(--pax-color-primary, #076487);
      font-size: var(--pax-text-xs, 0.75rem);
      line-height: var(--pax-lh-xs, 1.4);
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .pax-term-card-title {
      font-family: var(--pax-font-display, inherit);
      font-size: var(--pax-text-base, 0.875rem);
      line-height: 1.35;
      font-weight: 700;
      color: var(--pax-color-on-surface, #0f172a);
    }

    .pax-term-card-summary,
    .pax-term-card-detail {
      margin: 0;
      font-size: var(--pax-text-sm, 0.8125rem);
      line-height: var(--pax-lh-sm, 1.45);
      color: var(--pax-color-on-surface, #0f172a);
      overflow-wrap: anywhere;
    }

    .pax-term-card-detail {
      padding-top: var(--pax-space-2, 0.5rem);
      border-top: 1px solid var(--pax-color-outline-variant, #e2e8f0);
      color: var(--pax-color-on-surface-variant, #475569);
      font-size: var(--pax-text-xs, 0.75rem);
    }

    .pax-term-card-hint {
      display: flex;
      align-items: flex-start;
      gap: var(--pax-space-2, 0.5rem);
      padding: var(--pax-space-2, 0.5rem) var(--pax-space-3, 0.75rem);
      border-radius: var(--pax-radius-sm, 0.375rem);
      border-left: 3px solid var(--pax-color-primary, #076487);
      background: var(--pax-color-surface-container-low, #f1f5f9);
      color: var(--pax-color-on-surface, #0f172a);
      font-size: var(--pax-text-xs, 0.75rem);
      line-height: var(--pax-lh-xs, 1.4);
    }

    .pax-term-card-hint pax-icon {
      margin-top: 0.1rem;
      color: var(--pax-color-primary, #076487);
    }

    .pax-term-card-hint-body {
      display: grid;
      gap: 0.125rem;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .pax-term-card-hint-body strong {
      font-size: var(--pax-text-xs, 0.75rem);
      color: var(--pax-color-primary, #076487);
    }

    .pax-term-card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      min-width: 0;
    }

    .pax-term-card-meta-pill {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      padding: 0.125rem 0.5rem;
      border-radius: var(--pax-radius-pill, 999px);
      background: var(--pax-color-surface-container, #e2e8f0);
      color: var(--pax-color-on-surface-variant, #334155);
      font-size: var(--pax-text-xs, 0.75rem);
      font-weight: 600;
      overflow-wrap: anywhere;
      text-align: left;
    }

    .pax-term-card-meta-pill[data-tone='info'] {
      background: var(--pax-policy-param-bg, #eef7fa);
      color: var(--pax-policy-param-fg, #0a3b52);
    }

    .pax-term-card-meta-pill[data-tone='warning'] {
      background: var(--pax-color-warning-container, #fef3c7);
      color: var(--pax-color-on-warning-container, #451a03);
    }

    .pax-term-card-meta-pill[data-tone='danger'] {
      background: var(--pax-color-error-container, #fee2e2);
      color: var(--pax-color-on-error-container, #7f1d1d);
    }

    .pax-term-card-meta-pill[data-tone='success'] {
      background: var(--pax-policy-custom-bg, #ecfdf5);
      color: var(--pax-policy-custom-fg, #065f46);
    }

    .pax-term-card-footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--pax-space-2, 0.5rem);
      padding-top: var(--pax-space-1, 0.25rem);
    }

    .pax-term-card-action,
    .pax-term-card-link {
      border: 1px solid var(--pax-color-outline-variant, #cbd5e1);
      border-radius: var(--pax-radius-sm, 0.375rem);
      padding: var(--pax-space-1, 0.25rem) var(--pax-space-2, 0.5rem);
      background: var(--pax-color-surface-container-low, #f1f5f9);
      color: var(--pax-color-primary, #076487);
      font-size: var(--pax-text-xs, 0.75rem);
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
    }
  `
})
export class TermPopoverComponent implements OnDestroy {
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly triggerBtn = viewChild<ElementRef<HTMLButtonElement>>('triggerBtn');
  private readonly popoverCard = viewChild<ElementRef<HTMLDivElement>>('popoverCard');

  readonly termSignal = signal('');
  readonly categorySignal = signal<string | null>(null);
  readonly titleSignal = signal<string | null>(null);
  readonly summarySignal = signal('');
  readonly hintSignal = signal<string | null>(null);
  readonly hintLabelSignal = signal<string | null>(null);
  readonly metaTagsSignal = signal<readonly TermPopoverMetaTag[]>([]);
  readonly detailSignal = signal<string | null>(null);
  readonly badgeSignal = signal<string | null>(null);
  readonly toneSignal = signal<TermPopoverTone>('default');
  readonly variantSignal = signal<TermPopoverVariant>('inline');
  readonly iconSignal = signal<StudioIconName | null>(null);
  readonly actionLabelSignal = signal<string | null>(null);
  readonly externalHrefSignal = signal<string | null>(null);

  @Input({ required: true })
  set term(value: string) {
    this.termSignal.set(value);
  }

  @Input()
  set category(value: string | null | undefined) {
    this.categorySignal.set(value ?? null);
  }

  @Input()
  set title(value: string | null | undefined) {
    this.titleSignal.set(value ?? null);
  }

  @Input({ required: true })
  set summary(value: string) {
    this.summarySignal.set(value);
  }

  @Input()
  set hint(value: string | null | undefined) {
    this.hintSignal.set(value?.trim() ? value.trim() : null);
  }

  @Input()
  set hintLabel(value: string | null | undefined) {
    this.hintLabelSignal.set(value?.trim() ? value.trim() : null);
  }

  @Input()
  set metaTags(value: readonly TermPopoverMetaTag[] | null | undefined) {
    this.metaTagsSignal.set(value ?? []);
  }

  @Input()
  set detail(value: string | null | undefined) {
    this.detailSignal.set(value ?? null);
  }

  @Input()
  set badge(value: string | null | undefined) {
    this.badgeSignal.set(value ?? null);
  }

  @Input()
  set tone(value: TermPopoverTone | undefined) {
    this.toneSignal.set(value ?? 'default');
  }

  @Input()
  set variant(value: TermPopoverVariant | undefined) {
    this.variantSignal.set(value ?? 'inline');
  }

  @Input()
  set icon(value: StudioIconName | null | undefined) {
    this.iconSignal.set(value ?? null);
  }

  @Input()
  set actionLabel(value: string | null | undefined) {
    this.actionLabelSignal.set(value ?? null);
  }

  @Input()
  set externalHref(value: string | null | undefined) {
    this.externalHrefSignal.set(value ?? null);
  }

  @Output() readonly actionTriggered = new EventEmitter<void>();

  readonly cardId = `pax-term-card-${++nextTermPopoverId}`;
  readonly open = signal(false);
  readonly pinnedByClick = signal(false);
  readonly cardLeft = signal(12);
  readonly cardTop = signal(12);

  readonly resolvedTitle = computed(() => this.titleSignal()?.trim() || this.termSignal());

  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private measureFrameId: number | null = null;

  ngOnDestroy(): void {
    this.clearTimers();
  }

  scheduleOpen(): void {
    this.cancelClose();
    if (this.open()) {
      return;
    }
    this.openTimer = setTimeout(() => {
      this.openTimer = null;
      this.openPopover();
    }, 140);
  }

  scheduleClose(): void {
    this.clearOpenTimer();
    if (this.pinnedByClick()) {
      return;
    }
    this.cancelClose();
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      this.open.set(false);
    }, 180);
  }

  cancelClose(): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  openImmediately(): void {
    this.cancelClose();
    this.clearOpenTimer();
    this.openPopover();
  }

  toggleFromClick(event: MouseEvent): void {
    event.stopPropagation();
    this.clearTimers();
    if (this.open() && this.pinnedByClick()) {
      this.closePopover();
      return;
    }
    this.pinnedByClick.set(true);
    this.openPopover();
  }

  onTriggerBlur(event: FocusEvent): void {
    const related = event.relatedTarget as Node | null;
    if (related && this.hostRef.nativeElement.contains(related)) {
      return;
    }
    if (!this.pinnedByClick()) {
      this.scheduleClose();
    }
  }

  triggerAction(): void {
    this.actionTriggered.emit();
    this.closePopover();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.closePopover();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && !this.hostRef.nativeElement.contains(target)) {
      this.closePopover();
    }
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  repositionIfOpen(): void {
    if (this.open()) {
      const measuredHeight = this.readMeasuredCardHeight();
      this.updateCardPosition(measuredHeight);
    }
  }

  private openPopover(): void {
    this.updateCardPosition(240);
    this.open.set(true);
    this.scheduleMeasuredReposition();
  }

  private closePopover(): void {
    this.clearTimers();
    this.pinnedByClick.set(false);
    this.open.set(false);
  }

  private readMeasuredCardHeight(): number {
    const card = this.popoverCard()?.nativeElement;
    if (!card || typeof card.getBoundingClientRect !== 'function') {
      return 240;
    }
    const measured = card.getBoundingClientRect().height;
    return measured > 0 ? measured : 240;
  }

  private scheduleMeasuredReposition(): void {
    this.cancelMeasureFrame();
    if (typeof requestAnimationFrame !== 'function') {
      return;
    }
    this.measureFrameId = requestAnimationFrame(() => {
      this.measureFrameId = null;
      if (!this.open()) return;
      this.updateCardPosition(this.readMeasuredCardHeight());
    });
  }

  private updateCardPosition(estimatedHeight = 240): void {
    const trigger = this.triggerBtn()?.nativeElement;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 720;
    const margin = 12;
    const estimatedWidth = Math.min(336, Math.max(220, viewportWidth - margin * 2));
    const boundedHeight = Math.min(estimatedHeight, Math.max(120, viewportHeight - margin * 2));

    if (!trigger || typeof trigger.getBoundingClientRect !== 'function') {
      this.cardLeft.set(margin);
      this.cardTop.set(margin);
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const maxLeft = Math.max(margin, viewportWidth - estimatedWidth - margin);
    const left = Math.min(maxLeft, Math.max(margin, rect.left));
    const belowTop = rect.bottom + 8;
    const fitsBelow = belowTop + boundedHeight <= viewportHeight - margin;
    const aboveTop = Math.max(margin, rect.top - boundedHeight - 8);
    const maxTop = Math.max(margin, viewportHeight - boundedHeight - margin);
    const rawTop = fitsBelow ? belowTop : aboveTop;
    const top = Math.min(maxTop, Math.max(margin, rawTop));

    this.cardLeft.set(Math.round(left));
    this.cardTop.set(Math.round(top));
  }

  private cancelMeasureFrame(): void {
    if (this.measureFrameId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.measureFrameId);
      this.measureFrameId = null;
    }
  }

  private clearOpenTimer(): void {
    if (this.openTimer !== null) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearOpenTimer();
    this.cancelClose();
    this.cancelMeasureFrame();
  }
}
