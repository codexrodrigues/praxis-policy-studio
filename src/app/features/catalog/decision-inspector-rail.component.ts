import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import type { DecisionDiscoveryCandidate } from '../../core/decision-discovery.service';
import { humanizeTechnicalSlug, looksLikeTechnicalSlug } from '../../core/humanize-labels';
import { PolicyStudioI18n } from '../../core/i18n';
import {
  buildRuleParameterDisplayEntries,
  type RuleParameterDisplayEntry
} from '../../core/rule-parameters-display';
import type { PolicyStudioRuntimeConfig } from '../../core/runtime-config';
import type { RuleDocumentationDescriptor } from '../../core/rule-documentation';
import { resolveGovernanceGlossaryEntry, type StudioGlossaryEntry, type StudioGovernanceTermKey } from '../../core/studio-glossary';
import type { StudioInspectorTab, StudioViewDepth } from '../../core/studio-shell-state.service';
import { StudioIconComponent } from '../../shared/studio-icon.component';
import { TermPopoverComponent } from '../../shared/term-popover.component';
import type { DecisionMaturityPosture } from './catalog-presentation';
import type { DecisionSummary } from './catalog.fixture';
import { DecisionDiscoveryComponent } from './decision-discovery.component';
import { DecisionExplanationComponent } from './decision-explanation.component';

@Component({
  selector: 'pax-decision-inspector-rail',
  imports: [DecisionExplanationComponent, DecisionDiscoveryComponent, StudioIconComponent, TermPopoverComponent],
  templateUrl: './decision-inspector-rail.component.html',
  styleUrl: './decision-inspector-rail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionInspectorRailComponent {
  readonly i18n = inject(PolicyStudioI18n);

  readonly activeTab = input.required<StudioInspectorTab>();
  readonly viewDepth = input<StudioViewDepth>('business');
  readonly decision = input<DecisionSummary | null>(null);
  readonly allDecisions = input<readonly DecisionSummary[]>([]);
  readonly policyConfig = input<PolicyStudioRuntimeConfig | null>(null);
  readonly maturityPosture = input<DecisionMaturityPosture | null>(null);
  readonly documentation = input<RuleDocumentationDescriptor | null>(null);
  readonly autonomyGuidance = input<string>('');
  readonly authorityText = input<string>('');
  readonly migrationStrategyText = input<string>('');
  readonly configStatusText = input<string>('');
  readonly nullSemanticsText = input<string>('');
  readonly technicalMaturityText = input<string>('');
  readonly approvalStageText = input<string>('');
  readonly operationalAuthorityText = input<string>('');

  readonly tabChanged = output<StudioInspectorTab>();
  readonly decisionSelected = output<DecisionSummary>();
  readonly candidateSelected = output<DecisionDiscoveryCandidate>();
  readonly enableTechnicalModeRequested = output<void>();
  readonly openAccessPrivacyRequested = output<void>();
  readonly collapseRequested = output<void>();

  readonly copiedField = signal<string | null>(null);

  readonly legalBasisCount = computed(() => this.documentation()?.legalBasis?.length ?? 0);

  copyText(fieldKey: string, value: string | null | undefined): void {
    const normalized = value?.trim();
    if (!normalized) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(normalized);
    }
    this.copiedField.set(fieldKey);
    setTimeout(() => {
      if (this.copiedField() === fieldKey) {
        this.copiedField.set(null);
      }
    }, 1800);
  }

  displayDomain(decision: DecisionSummary): string {
    if (this.viewDepth() === 'business' && decision.domainLabel?.trim()) {
      return decision.domainLabel.trim();
    }
    const raw = decision.domain?.trim() ?? '';
    if (this.viewDepth() === 'technical' || !looksLikeTechnicalSlug(raw)) return raw;
    return humanizeTechnicalSlug(raw, 2, this.i18n.locale()) || raw;
  }

  displayRuleSet(decision: DecisionSummary): string {
    if (this.viewDepth() === 'business' && decision.ruleSetLabel?.trim()) {
      return decision.ruleSetLabel.trim();
    }
    const raw = decision.ruleSet?.trim() ?? '';
    if (this.viewDepth() === 'technical' || !looksLikeTechnicalSlug(raw)) return raw;
    return humanizeTechnicalSlug(raw, 2, this.i18n.locale()) || raw;
  }

  hasExplicitAuthority(): boolean {
    const auth = this.decision()?.authority ?? '';
    return this.viewDepth() === 'technical' || auth.includes('LEGACY') || auth.includes('CONFIG');
  }

  hasExplicitPersistenceStrategy(): boolean {
    const auth = this.decision()?.authority ?? '';
    return this.viewDepth() === 'technical' || auth.includes('KEEP_DB_BACKED');
  }

  activeParameters(decision: DecisionSummary): readonly RuleParameterDisplayEntry[] {
    return buildRuleParameterDisplayEntries(
      decision,
      {},
      this.i18n.locale(),
      this.i18n.text('paramDefaultPrefix')
    );
  }

  governanceTerm(key: StudioGovernanceTermKey): StudioGlossaryEntry {
    return resolveGovernanceGlossaryEntry(key, this.i18n.locale());
  }
}
