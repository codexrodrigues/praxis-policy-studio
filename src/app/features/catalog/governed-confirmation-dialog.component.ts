import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

export interface GovernedConfirmationView {
  readonly title: string;
  readonly message: string;
  readonly target: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

@Component({
  selector: 'pax-governed-confirmation-dialog',
  templateUrl: './governed-confirmation-dialog.component.html',
  styleUrl: './governed-confirmation-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GovernedConfirmationDialogComponent {
  readonly confirmation = input<GovernedConfirmationView | null>(null);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const confirmation = this.confirmation();
      const dialog = this.dialog().nativeElement;
      if (confirmation && !dialog.open) dialog.showModal();
      if (!confirmation && dialog.open) dialog.close();
    });
  }

  cancel(event?: Event): void {
    event?.preventDefault();
    this.cancelled.emit();
  }
}
