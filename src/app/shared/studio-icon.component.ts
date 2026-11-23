import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';

export type StudioIconName =
  | 'host-switch'
  | 'chevron-down'
  | 'shield-check'
  | 'sparkles'
  | 'sun'
  | 'moon'
  | 'search'
  | 'x'
  | 'arrow-left'
  | 'arrow-right'
  | 'sliders'
  | 'pencil'
  | 'lock'
  | 'circle-dot'
  | 'check-circle'
  | 'clock'
  | 'file-edit'
  | 'book-open'
  | 'database'
  | 'layout-grid'
  | 'layers'
  | 'activity'
  | 'shield-alert'
  | 'corner-down-left';

export type StudioIconSize = 12 | 14 | 16 | 18 | 20;

@Component({
  selector: 'pax-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
      [attr.width]="sizeSignal()"
      [attr.height]="sizeSignal()"
      [attr.aria-hidden]="labelSignal() ? null : 'true'"
      [attr.role]="labelSignal() ? 'img' : null"
      [attr.aria-label]="labelSignal() ?? null"
    >
      @switch (nameSignal()) {
        @case ('host-switch') {
          <path d="M16 3l4 4-4 4" />
          <path d="M20 7H4" />
          <path d="M8 21l-4-4 4-4" />
          <path d="M4 17h16" />
        }
        @case ('chevron-down') {
          <path d="M6 9l6 6 6-6" />
        }
        @case ('shield-check') {
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        }
        @case ('sparkles') {
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          <path d="M20 3v4" />
          <path d="M22 5h-4" />
        }
        @case ('sun') {
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.93 4.93l1.41 1.41" />
          <path d="M17.66 17.66l1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M6.34 17.66l-1.41 1.41" />
          <path d="M19.07 4.93l-1.41 1.41" />
        }
        @case ('moon') {
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.3-4.3" />
        }
        @case ('x') {
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        }
        @case ('arrow-left') {
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        }
        @case ('arrow-right') {
          <path d="M5 12h14" />
          <path d="M12 5l7 7-7 7" />
        }
        @case ('sliders') {
          <line x1="4" x2="20" y1="8" y2="8" />
          <line x1="4" x2="20" y1="16" y2="16" />
          <circle cx="9" cy="8" r="2.25" />
          <circle cx="15" cy="16" r="2.25" />
        }
        @case ('pencil') {
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="M15 5l4 4" />
        }
        @case ('lock') {
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        }
        @case ('circle-dot') {
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
        }
        @case ('check-circle') {
          <circle cx="12" cy="12" r="9" />
          <path d="M9 12l2 2 4-4" />
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        }
        @case ('file-edit') {
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        }
        @case ('book-open') {
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        }
        @case ('database') {
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14a9 3 0 0 0 18 0V5" />
          <path d="M3 12a9 3 0 0 0 18 0" />
        }
        @case ('layout-grid') {
          <rect width="7" height="7" x="3" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" />
          <rect width="7" height="7" x="3" y="14" rx="1" />
        }
        @case ('layers') {
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        }
        @case ('activity') {
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        }
        @case ('shield-alert') {
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        }
        @case ('corner-down-left') {
          <polyline points="9 10 4 15 9 20" />
          <path d="M20 4v7a4 4 0 0 1-4 4H4" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      line-height: 0;
      vertical-align: middle;
    }

    svg {
      display: block;
      flex-shrink: 0;
    }
  `
})
export class StudioIconComponent {
  readonly nameSignal = signal<StudioIconName>('circle-dot');
  readonly sizeSignal = signal<StudioIconSize>(16);
  readonly labelSignal = signal<string | null>(null);

  @Input({ required: true })
  set name(value: StudioIconName) {
    this.nameSignal.set(value);
  }

  @Input()
  set size(value: StudioIconSize | undefined) {
    this.sizeSignal.set(value ?? 16);
  }

  @Input()
  set label(value: string | null | undefined) {
    this.labelSignal.set(value?.trim() ? value.trim() : null);
  }
}
