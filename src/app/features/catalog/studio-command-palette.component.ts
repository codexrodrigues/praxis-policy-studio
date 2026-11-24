import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { PolicyStudioI18n } from '../../core/i18n';
import {
  buildCommandPaletteResults,
  type CommandPaletteActionId,
  type CommandPaletteItem
} from '../../core/studio-command-palette';
import type { StudioViewDepth } from '../../core/studio-shell-state.service';
import { StudioIconComponent } from '../../shared/studio-icon.component';
import type { DecisionSummary } from './catalog.fixture';

interface CommandPaletteGroup {
  readonly kind: CommandPaletteItem['kind'];
  readonly title: string;
  readonly entries: readonly { readonly item: CommandPaletteItem; readonly index: number }[];
}

@Component({
  selector: 'pax-studio-command-palette',
  standalone: true,
  imports: [StudioIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (openSignal()) {
      <div
        class="palette-backdrop"
        data-testid="command-palette-backdrop"
        (click)="closed.emit()">
        <div
          class="palette-dialog"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="i18n.text('commandPaletteDialogLabel')"
          data-testid="command-palette-dialog"
          (click)="$event.stopPropagation()"
          (keydown)="onKeyDown($event)">
          <div class="palette-search-row">
            <pax-icon name="search" [size]="16" />
            <input
              #searchInput
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls="command-palette-listbox"
              [attr.aria-activedescendant]="activeOptionDomId()"
              [attr.aria-label]="i18n.text('commandPalettePlaceholder')"
              [placeholder]="i18n.text('commandPalettePlaceholder')"
              [value]="query()"
              data-testid="command-palette-input"
              (input)="updateQuery($any($event.target).value)" />
            <button
              type="button"
              class="palette-close-btn"
              [attr.aria-label]="i18n.text('closeModal')"
              data-testid="command-palette-close"
              (click)="closed.emit()">
              <pax-icon name="x" [size]="14" />
            </button>
          </div>

          <div
            class="palette-results studio-scroll-region"
            id="command-palette-listbox"
            role="listbox"
            [attr.aria-label]="i18n.text('commandPaletteDialogLabel')"
            data-testid="command-palette-results">
            @if (groups().length === 0) {
              <p class="palette-empty" data-testid="command-palette-empty">
                {{ i18n.text('commandPaletteEmpty') }}
              </p>
            } @else {
              @for (group of groups(); track group.kind) {
                <div
                  class="palette-group"
                  role="group"
                  [attr.aria-labelledby]="'palette-group-' + group.kind"
                  [attr.data-group]="group.kind">
                  <div class="palette-group-title" [id]="'palette-group-' + group.kind" role="presentation">
                    {{ group.title }}
                  </div>
                  @for (entry of group.entries; track entry.item.id) {
                    <button
                      type="button"
                      role="option"
                      class="palette-option"
                      [id]="optionDomId(entry.index)"
                      [class.active]="entry.index === clampedActiveIndex()"
                      [attr.aria-selected]="entry.index === clampedActiveIndex()"
                      [attr.data-testid]="'command-palette-option-' + entry.item.id"
                      (mouseenter)="activeIndex.set(entry.index)"
                      (click)="activateItem(entry.item)">
                      <span class="option-icon">
                        <pax-icon [name]="entry.item.icon" [size]="14" />
                      </span>
                      <span class="option-copy">
                        <strong>{{ entry.item.title }}</strong>
                        @if (entry.item.subtitle) {
                          <small>{{ entry.item.subtitle }}</small>
                        }
                      </span>
                      @if (entry.item.badge) {
                        <span class="option-badge studio-mono">{{ entry.item.badge }}</span>
                      }
                    </button>
                  }
                </div>
              }
            }
          </div>

          <footer class="palette-footer" aria-hidden="true">
            <span><kbd class="studio-mono">↑↓</kbd> {{ i18n.text('commandPaletteHintNavigate') }}</span>
            <span><kbd class="studio-mono">Enter</kbd> {{ i18n.text('commandPaletteHintSelect') }}</span>
            <span><kbd class="studio-mono">Esc</kbd> {{ i18n.text('commandPaletteHintClose') }}</span>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [`
    .palette-backdrop {
      position: fixed;
      inset: 0;
      z-index: 90;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: min(12vh, 5.5rem) var(--pax-space-3) var(--pax-space-4);
      background: color-mix(in oklab, var(--pax-color-surface-canvas) 35%, rgba(15, 23, 42, 0.45));
      backdrop-filter: blur(4px);
      overscroll-behavior: contain;
    }

    .palette-dialog {
      width: min(40rem, 100%);
      max-height: min(76vh, 34rem);
      max-height: min(76dvh, 34rem);
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      border-radius: var(--pax-radius-lg);
      border: 1px solid var(--pax-color-outline);
      background: var(--pax-color-surface);
      color: var(--pax-color-on-surface);
      box-shadow: var(--pax-shadow-popover);
      overflow: hidden;
    }

    .palette-search-row {
      display: flex;
      align-items: center;
      gap: var(--pax-space-2);
      padding: var(--pax-space-3) var(--pax-space-4);
      border-bottom: 1px solid var(--pax-color-outline-variant);
      color: var(--pax-color-on-surface-variant);
    }

    .palette-search-row input {
      flex: 1 1 auto;
      min-width: 0;
      border: 0;
      background: transparent;
      color: var(--pax-color-on-surface);
      font: inherit;
      font-size: var(--pax-text-base);
      line-height: var(--pax-lh-base);
      outline: none;
    }

    .palette-search-row input::-webkit-search-cancel-button {
      display: none;
    }

    .palette-close-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      border: 1px solid var(--pax-color-outline-variant);
      border-radius: var(--pax-radius-sm);
      background: var(--pax-color-surface-container-low);
      color: var(--pax-color-on-surface-variant);
      cursor: pointer;
    }

    .palette-close-btn:hover {
      color: var(--pax-color-on-surface);
      border-color: var(--pax-color-outline);
    }

    .palette-close-btn:focus-visible,
    .palette-option:focus-visible {
      outline: 2px solid var(--pax-color-primary);
      outline-offset: -2px;
    }

    .palette-results {
      overflow-y: auto;
      overflow-x: clip;
      padding: var(--pax-space-2);
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--pax-space-3);
      align-content: start;
    }

    .palette-group {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0.125rem;
      min-width: 0;
    }

    .palette-group-title {
      margin: 0;
      padding: var(--pax-space-1) var(--pax-space-2);
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      line-height: var(--pax-lh-xs);
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .palette-option {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      overflow: hidden;
      display: flex;
      align-items: center;
      gap: var(--pax-space-3);
      padding: var(--pax-space-2) var(--pax-space-3);
      border: 0;
      border-radius: var(--pax-radius-md);
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }

    .palette-option.active {
      background: var(--pax-color-primary-container);
      color: var(--pax-color-on-primary-container);
    }

    .option-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      flex-shrink: 0;
      border-radius: var(--pax-radius-sm);
      background: var(--pax-color-surface-container-low);
      color: var(--pax-color-primary);
    }

    .palette-option.active .option-icon {
      background: var(--pax-color-surface);
    }

    .option-copy {
      flex: 1 1 auto;
      min-width: 0;
      display: grid;
      gap: 0.0625rem;
    }

    .option-copy strong {
      font-size: var(--pax-text-sm);
      line-height: var(--pax-lh-sm);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .option-copy small {
      font-size: var(--pax-text-xs);
      line-height: var(--pax-lh-xs);
      color: var(--pax-color-on-surface-variant);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .palette-option.active .option-copy small {
      color: inherit;
      opacity: 0.85;
    }

    .option-badge {
      flex-shrink: 0;
      max-width: 9.5rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 0.0625rem var(--pax-space-2);
      border-radius: var(--pax-radius-pill);
      background: var(--pax-color-surface-container);
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      font-weight: 700;
    }

    .palette-empty {
      margin: 0;
      padding: var(--pax-space-6) var(--pax-space-4);
      text-align: center;
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-sm);
    }

    .palette-footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--pax-space-3) var(--pax-space-4);
      padding: var(--pax-space-2) var(--pax-space-4);
      border-top: 1px solid var(--pax-color-outline-variant);
      background: var(--pax-color-surface-container-low);
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
    }

    .palette-footer kbd {
      padding: 0.0625rem 0.375rem;
      border-radius: var(--pax-radius-sm);
      border: 1px solid var(--pax-color-outline-variant);
      background: var(--pax-color-surface);
      font-size: 0.6875rem;
    }
  `]
})
export class StudioCommandPaletteComponent {
  readonly i18n = inject(PolicyStudioI18n);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly openSignal = signal(false);
  readonly decisionsSignal = signal<readonly DecisionSummary[]>([]);
  readonly selectedSignal = signal<DecisionSummary | null>(null);
  readonly viewDepthSignal = signal<StudioViewDepth>('business');
  readonly isDarkThemeSignal = signal(false);
  readonly isRemoteModeSignal = signal(false);

  @Input()
  set open(value: boolean | undefined) {
    this.openSignal.set(Boolean(value));
  }

  @Input()
  set decisions(value: readonly DecisionSummary[] | undefined) {
    this.decisionsSignal.set(value ?? []);
  }

  @Input()
  set selected(value: DecisionSummary | null | undefined) {
    this.selectedSignal.set(value ?? null);
  }

  @Input()
  set viewDepth(value: StudioViewDepth | undefined) {
    this.viewDepthSignal.set(value ?? 'business');
  }

  @Input()
  set isDarkTheme(value: boolean | undefined) {
    this.isDarkThemeSignal.set(Boolean(value));
  }

  @Input()
  set isRemoteMode(value: boolean | undefined) {
    this.isRemoteModeSignal.set(Boolean(value));
  }

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly decisionSelected = new EventEmitter<DecisionSummary>();
  @Output() readonly scopeSelected = new EventEmitter<string>();
  @Output() readonly actionTriggered = new EventEmitter<CommandPaletteActionId>();

  readonly query = signal('');
  readonly activeIndex = signal(0);

  private wasOpen = false;
  private previousFocused: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const isOpen = this.openSignal();
      if (isOpen && !this.wasOpen) {
        this.wasOpen = true;
        this.previousFocused =
          typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
        this.query.set('');
        this.activeIndex.set(0);
        const focusInput = () =>
          this.host.nativeElement
            .querySelector<HTMLInputElement>('[data-testid="command-palette-input"]')
            ?.focus();
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(focusInput);
        } else {
          focusInput();
        }
      } else if (!isOpen && this.wasOpen) {
        this.wasOpen = false;
        const restoreTarget = this.previousFocused;
        this.previousFocused = null;
        if (restoreTarget && typeof document !== 'undefined' && document.contains(restoreTarget)) {
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => restoreTarget.focus());
          } else {
            restoreTarget.focus();
          }
        }
      }
    });
  }

  readonly results = computed(() =>
    buildCommandPaletteResults({
      query: this.query(),
      decisions: this.decisionsSignal(),
      selected: this.selectedSignal(),
      viewDepth: this.viewDepthSignal(),
      locale: this.i18n.locale(),
      isRemoteMode: this.isRemoteModeSignal(),
      hasWorkspace: Boolean(this.selectedSignal()?.workspaceId),
      labels: {
        openPortfolioTitle: this.i18n.text('commandActionOpenPortfolio'),
        openPortfolioSubtitle: this.i18n.text('commandActionOpenPortfolioSub'),
        openReviewsTitle: this.i18n.text('commandActionOpenReviews'),
        openReviewsSubtitle: this.i18n.text('commandActionOpenReviewsSub'),
        toggleDepthTitle:
          this.viewDepthSignal() === 'business'
            ? this.i18n.text('commandActionToggleDepthTech')
            : this.i18n.text('commandActionToggleDepthBusiness'),
        toggleDepthSubtitle: this.i18n.text('commandActionDepthSub'),
        openAccessTitle: this.i18n.text('commandActionOpenAccessPrivacy'),
        openAccessSubtitle: this.i18n.text('commandActionOpenAccessPrivacySub'),
        openAiTitle: this.i18n.text('commandActionOpenAi'),
        openAiSubtitle: this.i18n.text('commandActionOpenAiSub'),
        toggleThemeTitle: this.i18n.text(
          this.isDarkThemeSignal() ? 'commandActionToggleThemeLight' : 'commandActionToggleThemeDark'
        ),
        navUnderstandTitle: this.i18n.text('commandActionNavUnderstand'),
        navRuleTitle: this.i18n.text('commandActionNavRule'),
        navTestTitle: this.i18n.text('commandActionNavTest'),
        navOperateTitle: this.i18n.text('commandActionNavOperate'),
        navHistoryTitle: this.i18n.text('commandActionNavHistory'),
        domainScopeSubtitle: this.i18n.text('portfolioKpiDomains'),
        functionalityScopeSubtitle: this.i18n.text('portfolioKpiFunctionalities'),
        rulesCountSuffix: this.i18n.text('portfolioRulesCountSuffix'),
        ruleSingularSuffix: this.i18n.text('portfolioRuleSingularSuffix')
      }
    })
  );

  readonly groups = computed<readonly CommandPaletteGroup[]>(() => {
    const flat = this.results();
    const order: readonly { readonly kind: CommandPaletteItem['kind']; readonly title: string }[] = [
      { kind: 'action', title: this.i18n.text('commandPaletteGroupActions') },
      { kind: 'scope', title: this.i18n.text('commandPaletteGroupScopes') },
      { kind: 'decision', title: this.i18n.text('commandPaletteGroupDecisions') }
    ];
    return order
      .map(bucket => ({
        kind: bucket.kind,
        title: bucket.title,
        entries: flat
          .map((item, index) => ({ item, index }))
          .filter(entry => entry.item.kind === bucket.kind)
      }))
      .filter(group => group.entries.length > 0);
  });

  readonly clampedActiveIndex = computed(() => {
    const count = this.results().length;
    if (count === 0) return -1;
    const raw = this.activeIndex();
    return raw < 0 ? 0 : raw >= count ? count - 1 : raw;
  });

  readonly activeOptionDomId = computed(() => {
    const index = this.clampedActiveIndex();
    return index >= 0 ? this.optionDomId(index) : null;
  });

  optionDomId(index: number): string {
    return `command-palette-opt-${index}`;
  }

  updateQuery(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  onKeyDown(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closed.emit();
      return;
    }
    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault();
      const next = (this.clampedActiveIndex() + 1) % count;
      this.activeIndex.set(next);
      this.scrollOptionIntoView(next);
      return;
    }
    if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault();
      const next = (this.clampedActiveIndex() - 1 + count) % count;
      this.activeIndex.set(next);
      this.scrollOptionIntoView(next);
      return;
    }
    if (event.key === 'Home' && count > 0) {
      event.preventDefault();
      this.activeIndex.set(0);
      this.scrollOptionIntoView(0);
      return;
    }
    if (event.key === 'End' && count > 0) {
      event.preventDefault();
      this.activeIndex.set(count - 1);
      this.scrollOptionIntoView(count - 1);
      return;
    }
    if (event.key === 'Enter' && count > 0) {
      const idx = this.clampedActiveIndex();
      const active = idx >= 0 ? this.results()[idx] : undefined;
      if (active) {
        event.preventDefault();
        this.activateItem(active);
      }
    }
  }

  activateItem(item: CommandPaletteItem): void {
    switch (item.kind) {
      case 'action':
        this.actionTriggered.emit(item.actionId);
        return;
      case 'scope':
        this.scopeSelected.emit(item.scopeKey);
        return;
      case 'decision':
        this.decisionSelected.emit(item.decision);
        return;
    }
  }

  private scrollOptionIntoView(index: number): void {
    const root = this.host.nativeElement as HTMLElement;
    const el = root.querySelector(`#${this.optionDomId(index)}`) as HTMLElement | null;
    el?.scrollIntoView?.({ block: 'nearest' });
  }
}
