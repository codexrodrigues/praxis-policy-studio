import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { DecisionExplanationService, type DecisionExplanationEvent } from '../../core/decision-explanation.service';
import { PolicyStudioI18n } from '../../core/i18n';
import type { PolicyStudioRuntimeConfig } from '../../core/runtime-config';
import type { DecisionSummary } from './catalog.fixture';

@Component({
  selector: 'pax-decision-explanation',
  templateUrl: './decision-explanation.component.html',
  styleUrl: './decision-explanation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionExplanationComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) decision!: DecisionSummary;
  @Input({ required: true }) config!: PolicyStudioRuntimeConfig;

  private readonly explanations = inject(DecisionExplanationService);
  private subscription: Subscription | null = null;
  private activeRequestKey: string | null = null;
  readonly state = signal<DecisionExplanationEvent | { readonly kind: 'idle' }>({ kind: 'idle' });

  constructor(readonly i18n: PolicyStudioI18n) {}

  ngOnChanges(): void {
    this.reset();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  available(): boolean {
    return this.config?.mode === 'remote'
      && !!this.decision?.configDefinitionId
      && Number.isInteger(this.decision?.configVersion)
      && (this.decision.configVersion ?? 0) > 0;
  }

  explain(): void {
    if (!this.available() || this.state().kind === 'progress') return;
    const definitionId = this.decision.configDefinitionId as string;
    const version = this.decision.configVersion as number;
    const requestKey = `${definitionId}:${this.decision.key}:${version}`;
    this.subscription?.unsubscribe();
    this.activeRequestKey = requestKey;
    this.state.set({ kind: 'progress' });
    this.subscription = this.explanations.explain({
      definitionId,
      ruleKey: this.decision.key,
      version,
      locale: this.i18n.locale(),
      config: this.config
    }).subscribe(event => {
      if (this.activeRequestKey !== requestKey) return;
      this.state.set(event);
    });
  }

  retry(): void {
    this.explain();
  }

  evidenceModeLabel(mode: string): string {
    const key = mode === 'full'
      ? 'aiEvidenceFull'
      : mode === 'summary_only'
        ? 'aiEvidenceSummaryOnly'
        : mode === 'masked'
          ? 'aiEvidenceMasked'
          : mode === 'denied'
            ? 'aiEvidenceDenied'
            : 'aiEvidenceUnavailable';
    return this.i18n.text(key);
  }

  failureMessage(reason: Extract<DecisionExplanationEvent, { kind: 'failed' }>['reason']): string {
    const key = reason === 'authentication'
      ? 'aiExplanationAuthenticationRequired'
      : reason === 'forbidden'
        ? 'aiExplanationPermissionLimited'
        : reason === 'evidence-mismatch' || reason === 'unsafe-terminal'
          ? 'aiExplanationEvidenceRejected'
          : 'aiExplanationFailed';
    return this.i18n.text(key);
  }

  private reset(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.activeRequestKey = null;
    this.state.set({ kind: 'idle' });
  }
}
