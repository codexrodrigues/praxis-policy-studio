import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, inject, signal } from '@angular/core';
import { Subscription, map, merge, takeWhile, timer } from 'rxjs';
import {
  DecisionExplanationService,
  type DecisionExplanationEvent,
  type DecisionExplanationSafeFact
} from '../../core/decision-explanation.service';
import { localizeGenericUnit } from '../../core/humanize-labels';
import { PolicyStudioI18n } from '../../core/i18n';
import type { PolicyStudioRuntimeConfig } from '../../core/runtime-config';
import type { StudioViewDepth } from '../../core/studio-shell-state.service';
import type { DecisionSummary } from './catalog.fixture';

@Component({
  selector: 'pax-decision-explanation',
  templateUrl: './decision-explanation.component.html',
  styleUrl: './decision-explanation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionExplanationComponent implements OnChanges, OnDestroy {
  private static readonly REQUEST_TIMEOUT_MS = 90_000;
  @Input({ required: true }) decision!: DecisionSummary;
  @Input({ required: true }) config!: PolicyStudioRuntimeConfig;
  @Input() viewDepth: StudioViewDepth = 'business';

  private readonly explanations = inject(DecisionExplanationService);
  readonly i18n = inject(PolicyStudioI18n);
  private subscription: Subscription | null = null;
  private activeRequestKey: string | null = null;
  readonly state = signal<DecisionExplanationEvent | { readonly kind: 'idle' }>({ kind: 'idle' });

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
    const terminalTimeout: DecisionExplanationEvent = { kind: 'failed', reason: 'failed' };
    const explanationEvents = this.explanations.explain({
      definitionId,
      ruleKey: this.decision.key,
      version,
      locale: this.i18n.locale(),
      config: this.config
    });
    this.subscription = merge(
      explanationEvents,
      timer(DecisionExplanationComponent.REQUEST_TIMEOUT_MS).pipe(map(() => terminalTimeout))
    ).pipe(
      takeWhile(event => event.kind !== 'completed' && event.kind !== 'failed', true)
    ).subscribe(event => {
      if (this.activeRequestKey !== requestKey) return;
      this.state.set(event);
    });
  }

  cancel(): void {
    if (this.state().kind !== 'progress') return;
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.activeRequestKey = null;
    this.state.set({ kind: 'failed', reason: 'cancelled' });
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

  progressPhaseLabel(event: DecisionExplanationEvent | { readonly kind: 'idle' }): string | null {
    if (event.kind !== 'progress' || !event.phase) return null;
    if (event.phase === 'connecting') return this.i18n.text('aiExplanationPhaseConnecting');
    if (event.phase === 'inspecting_evidence') return this.i18n.text('aiExplanationPhaseInspectingEvidence');
    return this.i18n.text('aiExplanationPhaseSynthesizing');
  }

  omittedFieldLabel(code: string): string {
    const map: Readonly<Record<string, string>> = {
      'factCatalog.secretOrDeniedFacts': this.i18n.text('aiOmittedSecretOrDeniedFacts'),
      'factCatalog.summarizedOrMaskedFacts': this.i18n.text('aiOmittedSummarizedOrMaskedFacts'),
      'conditionAst.containsRestrictedFacts': this.i18n.text('aiOmittedConditionAstRestricted'),
      'conditionFactPaths.restrictedFacts': this.i18n.text('aiOmittedConditionPathsRestricted')
    };
    const translated = map[code] ?? this.i18n.text('aiOmittedOtherField');
    return this.viewDepth === 'technical' ? `${translated} (${code})` : translated;
  }

  safeFactMeta(fact: DecisionExplanationSafeFact): string | null {
    const parts: string[] = [];
    const localizedUnit = localizeGenericUnit(fact.unit, this.i18n.locale());
    if (localizedUnit) parts.push(localizedUnit);
    if (fact.mask?.trim()) parts.push(fact.mask.trim());
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  failureMessage(reason: Extract<DecisionExplanationEvent, { kind: 'failed' }>['reason']): string {
    const key = reason === 'authentication'
      ? 'aiExplanationAuthenticationRequired'
      : reason === 'forbidden'
        ? 'aiExplanationPermissionLimited'
        : reason === 'unavailable'
          ? 'aiServiceUnavailable'
          : reason === 'cancelled'
            ? 'aiExplanationCancelled'
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
