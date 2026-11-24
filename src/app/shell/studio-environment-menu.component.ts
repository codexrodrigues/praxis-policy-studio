import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  computed,
  inject,
  signal
} from '@angular/core';
import { PolicyStudioI18n } from '../core/i18n';
import type { RulesStudioHostProfile } from '../core/runtime-config';
import { StudioIconComponent } from '../shared/studio-icon.component';

@Component({
  selector: 'pax-studio-environment-menu',
  standalone: true,
  imports: [StudioIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="env-pill" [class.popover-open]="popoverOpen()">
      @if (isRemoteModeSignal()) {
        <div
          class="host-select-wrap"
          data-testid="studio-host-profile-selector"
          [attr.title]="activeHostLabelSignal()">
          <pax-icon class="env-icon" name="host-switch" [size]="14" />
          <span class="host-label" aria-hidden="true">{{ activeHostLabelSignal() }}</span>
          <select
            [attr.aria-label]="i18n.text('environmentHostLabel')"
            (change)="onHostChanged($any($event.target).value)">
            @for (profile of hostProfilesSignal(); track profile.id) {
              <option [value]="profile.id" [selected]="profile.id === activeHostProfileIdSignal()">
                {{ i18n.locale() === 'pt-BR' ? profile.labelPtBr : profile.labelEnUs }}
              </option>
            }
          </select>
        </div>
        <span class="env-divider" aria-hidden="true"></span>
      }

      <button
        type="button"
        class="env-details-trigger"
        data-testid="studio-environment-trigger"
        [attr.aria-expanded]="popoverOpen()"
        [attr.aria-label]="i18n.text('environmentMenuTriggerLabel')"
        [attr.title]="i18n.text('environmentMenuTitle')"
        (click)="togglePopover()">
        @if (scopeBadges().length) {
          <span class="scope-inline studio-mono" data-testid="studio-scope-context">
            @for (part of scopeBadges(); track $index) {
              <span>{{ part }}</span>
              @if (!$last) { <i aria-hidden="true">·</i> }
            }
          </span>
        } @else {
          <span class="mode-inline">
            {{ i18n.text(isRemoteModeSignal() ? 'environmentDefaultScope' : 'fixture') }}
          </span>
        }
        <pax-icon class="env-chevron" name="chevron-down" [size]="12" />
      </button>

      @if (popoverOpen()) {
        <div
          class="env-popover"
          role="dialog"
          data-testid="studio-environment-popover"
          [attr.aria-label]="i18n.text('environmentMenuTitle')">
          <p class="popover-eyebrow">{{ i18n.text('environmentMenuTitle') }}</p>
          <dl class="env-kv">
            <div>
              <dt>{{ i18n.text('environmentModeLabel') }}</dt>
              <dd>{{ i18n.text(isRemoteModeSignal() ? 'governedConfig' : 'fixture') }}</dd>
            </div>
            @if (isRemoteModeSignal() && activeHostLabelSignal()) {
              <div>
                <dt>{{ i18n.text('environmentHostLabel') }}</dt>
                <dd>{{ activeHostLabelSignal() }}</dd>
              </div>
            }
            @if (tenantIdSignal()) {
              <div>
                <dt>{{ i18n.text('scopeTenant') }}</dt>
                <dd class="studio-mono">{{ tenantIdSignal() }}</dd>
              </div>
            }
            @if (organizationIdSignal()) {
              <div>
                <dt>{{ i18n.text('scopeOrganization') }}</dt>
                <dd class="studio-mono">{{ organizationIdSignal() }}</dd>
              </div>
            }
            @if (environmentSignal()) {
              <div>
                <dt>{{ i18n.text('scopeEnvironment') }}</dt>
                <dd class="studio-mono">{{ environmentSignal() }}</dd>
              </div>
            }
          </dl>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
      min-width: 0;
    }

    .env-pill {
      position: relative;
      display: inline-flex;
      align-items: center;
      min-height: 2rem;
      border-radius: var(--pax-radius-pill);
      border: 1px solid var(--pax-color-outline-variant);
      background: var(--pax-color-surface-container-low);
      color: var(--pax-color-on-surface);
      font-size: var(--pax-text-xs);
      line-height: var(--pax-lh-xs);
      font-weight: 600;
      min-width: 0;
    }

    .host-select-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      min-height: 2rem;
      padding-inline: 0.625rem 0.5rem;
      max-width: 11.5rem;
      min-width: 0;
    }

    .env-icon {
      color: var(--pax-color-primary);
      flex-shrink: 0;
      pointer-events: none;
    }

    .host-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      pointer-events: none;
    }

    .host-select-wrap select {
      position: absolute;
      inset: 0;
      z-index: 1;
      width: 100%;
      height: 100%;
      opacity: 0;
      border: 0;
      margin: 0;
      padding: 0;
      font: inherit;
      cursor: pointer;
    }

    .host-select-wrap select option {
      background: var(--pax-color-surface);
      color: var(--pax-color-on-surface);
    }

    .env-divider {
      width: 1px;
      height: 1rem;
      background: var(--pax-color-outline-variant);
      flex-shrink: 0;
    }

    .env-details-trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      min-height: 2rem;
      border: 0;
      border-radius: 0 var(--pax-radius-pill) var(--pax-radius-pill) 0;
      background: transparent;
      color: var(--pax-color-on-surface-variant);
      padding-inline: 0.5rem 0.625rem;
      font: inherit;
      font-size: var(--pax-text-xs);
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
    }

    .env-details-trigger:hover {
      color: var(--pax-color-on-surface);
    }

    .host-select-wrap:focus-within,
    .env-details-trigger:focus-visible {
      outline: 2px solid var(--pax-color-primary);
      outline-offset: 2px;
      border-radius: var(--pax-radius-pill);
    }

    .scope-inline {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .scope-inline i {
      font-style: normal;
      opacity: 0.6;
    }

    .env-chevron {
      flex-shrink: 0;
    }

    .env-popover {
      position: absolute;
      right: 0;
      top: calc(100% + 0.375rem);
      z-index: 80;
      min-width: 16.5rem;
      max-width: min(21rem, calc(100vw - 1.5rem));
      padding: var(--pax-space-4);
      border-radius: var(--pax-radius-lg);
      border: 1px solid var(--pax-color-popover-border);
      background: var(--pax-color-popover-bg);
      color: var(--pax-color-on-surface);
      box-shadow: var(--pax-shadow-popover);
      display: grid;
      gap: var(--pax-space-3);
    }

    .popover-eyebrow {
      margin: 0;
      color: var(--pax-color-primary);
      font-size: var(--pax-text-xs);
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .env-kv {
      margin: 0;
      display: grid;
      gap: var(--pax-space-2);
    }

    .env-kv div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--pax-space-3);
    }

    .env-kv dt {
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      font-weight: 600;
    }

    .env-kv dd {
      margin: 0;
      font-size: var(--pax-text-xs);
      font-weight: 700;
      text-align: right;
      overflow-wrap: anywhere;
    }

    @media (max-width: 1180px) {
      .scope-inline {
        display: none;
      }
      .host-select-wrap {
        max-width: 9rem;
      }
    }

    @media (max-width: 760px) {
      .host-select-wrap {
        max-width: 4.5rem;
        padding-inline: 0.45rem 0.35rem;
        gap: 0.25rem;
      }
      .env-details-trigger {
        padding-inline: 0.35rem 0.45rem;
      }
    }

    @media (forced-colors: active) {
      .host-select-wrap select {
        position: static;
        width: auto;
        height: auto;
        opacity: 1;
        appearance: auto;
      }
      .host-label {
        display: none;
      }
    }
  `]
})
export class StudioEnvironmentMenuComponent {
  readonly i18n = inject(PolicyStudioI18n);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly isRemoteModeSignal = signal(false);
  readonly hostProfilesSignal = signal<readonly RulesStudioHostProfile[]>([]);
  readonly activeHostProfileIdSignal = signal<string | null>(null);
  readonly activeHostLabelSignal = signal('');
  readonly tenantIdSignal = signal<string | null>(null);
  readonly organizationIdSignal = signal<string | null>(null);
  readonly environmentSignal = signal<string | null>(null);
  readonly popoverOpen = signal(false);

  @Input()
  set isRemoteMode(value: boolean | undefined) {
    this.isRemoteModeSignal.set(Boolean(value));
  }

  @Input()
  set hostProfiles(value: readonly RulesStudioHostProfile[] | undefined) {
    this.hostProfilesSignal.set(value ?? []);
  }

  @Input()
  set activeHostProfileId(value: string | null | undefined) {
    this.activeHostProfileIdSignal.set(value ?? null);
  }

  @Input()
  set activeHostLabel(value: string | undefined) {
    this.activeHostLabelSignal.set(value ?? '');
  }

  @Input()
  set tenantId(value: string | null | undefined) {
    this.tenantIdSignal.set(value ?? null);
  }

  @Input()
  set organizationId(value: string | null | undefined) {
    this.organizationIdSignal.set(value ?? null);
  }

  @Input()
  set environment(value: string | null | undefined) {
    this.environmentSignal.set(value ?? null);
  }

  @Output() readonly hostProfileSelected = new EventEmitter<string>();

  readonly scopeBadges = computed(() => {
    const parts: string[] = [];
    if (this.tenantIdSignal()) parts.push(this.tenantIdSignal()!);
    if (this.organizationIdSignal()) parts.push(this.organizationIdSignal()!);
    if (this.environmentSignal()) parts.push(this.environmentSignal()!);
    return parts;
  });

  togglePopover(): void {
    this.popoverOpen.update(open => !open);
  }

  onHostChanged(profileId: string): void {
    this.popoverOpen.set(false);
    this.hostProfileSelected.emit(profileId);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.popoverOpen()) {
      this.popoverOpen.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.popoverOpen()) return;
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.popoverOpen.set(false);
    }
  }
}
