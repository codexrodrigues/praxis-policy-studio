import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, Output, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  DecisionDiscoveryService,
  type DecisionDiscoveryCandidate,
  type DecisionDiscoveryEvent
} from '../../core/decision-discovery.service';
import { PolicyStudioI18n } from '../../core/i18n';
import type { PolicyStudioRuntimeConfig } from '../../core/runtime-config';
import type { DecisionSummary } from './catalog.fixture';

@Component({
  selector: 'pax-decision-discovery',
  templateUrl: './decision-discovery.component.html',
  styleUrl: './decision-discovery.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionDiscoveryComponent implements OnDestroy {
  @Input({ required: true }) config!: PolicyStudioRuntimeConfig;
  @Input({ required: true }) decisions: readonly DecisionSummary[] = [];
  @Output() readonly decisionSelected = new EventEmitter<DecisionSummary>();

  private readonly discovery = inject(DecisionDiscoveryService);
  private subscription: Subscription | null = null;
  private activeRequestId: string | null = null;
  private lastPrompt = '';
  readonly state = signal<DecisionDiscoveryEvent | { readonly kind: 'idle' }>({ kind: 'idle' });
  readonly inputInvalid = signal(false);

  constructor(readonly i18n: PolicyStudioI18n) {}

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  available(): boolean {
    return this.config?.mode === 'remote';
  }

  discover(prompt: string): void {
    const normalized = prompt.trim();
    if (!this.available() || this.state().kind === 'progress') return;
    if (normalized.length < 3) {
      this.inputInvalid.set(true);
      return;
    }
    this.inputInvalid.set(false);
    this.lastPrompt = normalized;
    this.subscription?.unsubscribe();
    const requestId = crypto.randomUUID();
    this.activeRequestId = requestId;
    this.state.set({ kind: 'progress' });
    this.subscription = this.discovery.discover({
      prompt: normalized,
      locale: this.i18n.locale(),
      config: this.config
    }).subscribe(event => {
      if (this.activeRequestId !== requestId) return;
      this.state.set(event);
    });
  }

  retry(): void {
    if (this.lastPrompt) this.discover(this.lastPrompt);
  }

  select(candidate: DecisionDiscoveryCandidate): void {
    const decision = this.matchingDecision(candidate);
    if (decision) this.decisionSelected.emit(decision);
  }

  matchingDecision(candidate: DecisionDiscoveryCandidate): DecisionSummary | null {
    return this.decisions.find(decision =>
      decision.configDefinitionId === candidate.definitionId
      && decision.key === candidate.ruleKey
      && decision.configVersion === candidate.version) ?? null;
  }

  failureMessage(reason: Extract<DecisionDiscoveryEvent, { kind: 'failed' }>['reason']): string {
    const key = reason === 'authentication'
      ? 'aiDiscoveryAuthenticationRequired'
      : reason === 'forbidden'
        ? 'aiDiscoveryPermissionLimited'
        : reason === 'evidence-mismatch' || reason === 'unsafe-terminal'
          ? 'aiDiscoveryEvidenceRejected'
          : 'aiDiscoveryFailed';
    return this.i18n.text(key);
  }
}
