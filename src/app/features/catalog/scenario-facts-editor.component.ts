import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import {
  formatFactDisplayLabel,
  resolveFactGroup,
  splitFactDescriptionAndHint,
  type SplitFactDescription
} from '../../core/fact-presentation';
import { localizeGenericUnit } from '../../core/humanize-labels';
import { PolicyStudioI18n } from '../../core/i18n';
import type { StudioViewDepth } from '../../core/studio-shell-state.service';
import type { DecisionFact } from './catalog.fixture';

export interface ScenarioFactValueChange {
  readonly fact: DecisionFact;
  readonly value: string | boolean | undefined;
}

export interface ScenarioFactNullChange {
  readonly fact: DecisionFact;
  readonly useNull: boolean;
}

export interface PartitionedScenarioFacts {
  readonly primary: readonly DecisionFact[];
  readonly other: readonly DecisionFact[];
}

export interface ScenarioFactGroupBucket {
  readonly key: string;
  readonly label: string;
  readonly showHeading: boolean;
  readonly facts: readonly DecisionFact[];
}

export interface ScenarioFactPrivacyNotice {
  readonly tone: 'sensitive' | 'restricted';
  readonly message: string;
}

const SAFE_PATTERN_MAX_LENGTH = 256;
const NESTED_QUANTIFIER_PATTERN = /(\([^)]*[+*][^)]*\)\s*[+*{])|([+*]\s*[+*])/;

function normalizeFactComparisonPath(path: string): string {
  return path.trim().replace(/:/g, '.').toLowerCase();
}

function compileSafeValidationRegex(rawPattern: string): RegExp | null {
  const trimmed = rawPattern.trim();
  if (!trimmed || trimmed.length > SAFE_PATTERN_MAX_LENGTH || NESTED_QUANTIFIER_PATTERN.test(trimmed)) {
    return null;
  }
  const normalized = trimmed.replace(/^\(\?[imsux]+\)/, '').replace(/^\\A/, '^').replace(/\\z$/, '$');
  try {
    return new RegExp(normalized);
  } catch {
    return null;
  }
}

@Component({
  selector: 'pax-scenario-facts-editor',
  imports: [NgTemplateOutlet],
  templateUrl: './scenario-facts-editor.component.html',
  styleUrl: './scenario-facts-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScenarioFactsEditorComponent {
  readonly facts = input.required<readonly DecisionFact[]>();
  readonly values = input.required<Readonly<Record<string, unknown>>>();
  readonly preview = input<string | null>(null);
  readonly viewDepth = input<StudioViewDepth>('business');
  readonly primaryFactPaths = input<readonly string[]>([]);
  readonly valueChanged = output<ScenarioFactValueChange>();
  readonly nullChanged = output<ScenarioFactNullChange>();
  readonly i18n = inject(PolicyStudioI18n);

  readonly filterQuery = signal('');

  readonly partitionedFacts = computed<PartitionedScenarioFacts>(() => {
    const allFacts = this.facts();
    const primaryRefs = this.primaryFactPaths()
      .map(normalizeFactComparisonPath)
      .filter(Boolean);
    if (allFacts.length === 0 || primaryRefs.length === 0) {
      return { primary: allFacts, other: [] };
    }

    const primary: DecisionFact[] = [];
    const other: DecisionFact[] = [];
    for (const fact of allFacts) {
      const normalized = normalizeFactComparisonPath(fact.path);
      const matchesRule = primaryRefs.some(ref =>
        normalized === ref
        || normalized.startsWith(`${ref}.`)
        || ref.startsWith(`${normalized}.`)
      );
      // Keep non-nullable facts visible so native form constraints stay focusable.
      if (matchesRule || !fact.nullable) {
        primary.push(fact);
      } else {
        other.push(fact);
      }
    }

    if (primary.length === 0 || other.length === 0) {
      return { primary: allFacts, other: [] };
    }
    return { primary, other };
  });

  readonly showSearchInput = computed(() => this.facts().length >= 10);

  readonly primaryGroups = computed<readonly ScenarioFactGroupBucket[]>(() =>
    this.groupBucketFacts(this.filterBucketFacts(this.partitionedFacts().primary))
  );

  readonly otherGroups = computed<readonly ScenarioFactGroupBucket[]>(() =>
    this.groupBucketFacts(this.filterBucketFacts(this.partitionedFacts().other))
  );

  isNull(path: string): boolean {
    return this.values()[path] === null;
  }

  displayValue(path: string): string {
    const value = this.values()[path];
    return Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
  }

  factLabel(fact: Pick<DecisionFact, 'label' | 'path'>): string {
    return formatFactDisplayLabel(fact, this.i18n.locale(), this.viewDepth(), true);
  }

  factDescription(fact: Pick<DecisionFact, 'description' | 'hint'>): SplitFactDescription {
    return splitFactDescriptionAndHint(fact.description, fact.hint);
  }

  localizedUnit(fact: Pick<DecisionFact, 'unit'>): string | null {
    const raw = fact.unit?.trim();
    if (!raw) return null;
    if (this.viewDepth() === 'technical') return raw;
    return localizeGenericUnit(raw, this.i18n.locale()) || raw;
  }

  hasScalarAllowedValues(fact: DecisionFact): boolean {
    if (fact.sensitivity === 'SECRET' || fact.redaction === 'OMIT') {
      return false;
    }
    if (!fact.allowedValues?.length) {
      return false;
    }
    return fact.valueType === 'string'
      || fact.valueType === 'number'
      || fact.valueType === 'date'
      || fact.valueType === 'boolean';
  }

  hasMatchingAllowedOption(fact: DecisionFact): boolean {
    const raw = this.displayValue(fact.path).trim();
    if (!raw) return false;
    const numeric = Number.isFinite(Number(raw)) ? Number(raw) : null;
    return (fact.allowedValues ?? []).some(opt =>
      String(opt.value) === raw || (typeof opt.value === 'number' && numeric !== null && opt.value === numeric));
  }

  hasDynamicLookupHint(fact: DecisionFact): boolean {
    return !this.hasScalarAllowedValues(fact)
      && Boolean(fact.optionSourceRef?.sourceKey?.trim() || fact.optionSourceRef?.resourceKey?.trim());
  }

  privacyNotice(fact: DecisionFact): ScenarioFactPrivacyNotice | null {
    if (fact.sensitivity === 'SECRET' || fact.redaction === 'OMIT') {
      return { tone: 'restricted', message: this.i18n.text('scenarioPrivacyNoticeRestricted') };
    }
    if (
      fact.sensitivity === 'PERSONAL'
      || fact.sensitivity === 'SENSITIVE'
      || fact.redaction === 'MASK'
      || fact.redaction === 'HASH'
    ) {
      return { tone: 'sensitive', message: this.i18n.text('scenarioPrivacyNoticeSensitive') };
    }
    return null;
  }

  constraintWarnings(fact: DecisionFact): readonly string[] {
    const constraints = fact.constraints;
    if (!constraints) return [];
    const current = this.values()[fact.path];
    if (current === null || current === undefined) return [];
    const rawText = Array.isArray(current) ? current.join(', ').trim() : String(current).trim();
    if (!rawText) return [];

    const warnings: string[] = [];
    if (fact.valueType === 'number') {
      const numeric = Number(rawText);
      if (Number.isFinite(numeric)) {
        if (constraints.min != null && numeric < constraints.min) {
          warnings.push(this.i18n.format('scenarioConstraintMinWarning', { min: constraints.min }));
        }
        if (constraints.max != null && numeric > constraints.max) {
          warnings.push(this.i18n.format('scenarioConstraintMaxWarning', { max: constraints.max }));
        }
        if (constraints.step != null && constraints.step > 0) {
          const origin = constraints.min ?? 0;
          const quotient = (numeric - origin) / constraints.step;
          if (Number.isFinite(quotient) && Math.abs(quotient - Math.round(quotient)) > 1e-6) {
            warnings.push(this.i18n.format('scenarioConstraintStepWarning', { step: constraints.step }));
          }
        }
      }
      return warnings;
    }

    if (fact.valueType === 'string' && !this.hasScalarAllowedValues(fact)) {
      if (constraints.minLength != null && rawText.length < constraints.minLength) {
        warnings.push(this.i18n.format('scenarioConstraintMinLengthWarning', { min: constraints.minLength }));
      }
      if (constraints.maxLength != null && rawText.length > constraints.maxLength) {
        warnings.push(this.i18n.format('scenarioConstraintMaxLengthWarning', { max: constraints.maxLength }));
      }
      if (constraints.pattern?.trim()) {
        const regex = compileSafeValidationRegex(constraints.pattern);
        if (regex && !regex.test(rawText)) {
          warnings.push(this.i18n.text('scenarioConstraintPatternWarning'));
        }
      }
    }
    return warnings;
  }

  factDescriptionId(fact: DecisionFact): string {
    return `scenario-fact-desc-${fact.path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  hasFactHelpBlock(fact: DecisionFact): boolean {
    const desc = this.factDescription(fact);
    return (this.viewDepth() === 'technical' || (!desc.isTemplatePlaceholder && Boolean(desc.description)))
      || Boolean(desc.hint)
      || this.hasDynamicLookupHint(fact)
      || this.privacyNotice(fact) !== null
      || this.constraintWarnings(fact).length > 0
      || this.viewDepth() === 'technical';
  }

  examplePlaceholder(fact: DecisionFact): string {
    if (fact.sensitivity === 'SECRET' || fact.redaction === 'OMIT') {
      return '';
    }
    const example = fact.example?.trim();
    if (!example) return '';
    return this.i18n.format('factExamplePlaceholder', { example });
  }

  emitAllowedValueChange(fact: DecisionFact, rawValue: string): void {
    if (rawValue === '') {
      this.valueChanged.emit({ fact, value: undefined });
      return;
    }
    const coerced = fact.valueType === 'boolean' ? rawValue === 'true' : rawValue;
    this.valueChanged.emit({ fact, value: coerced });
  }

  emitBooleanChange(fact: DecisionFact, rawValue: string): void {
    if (rawValue === '') {
      this.valueChanged.emit({ fact, value: undefined });
      return;
    }
    this.valueChanged.emit({ fact, value: rawValue === 'true' });
  }

  private filterBucketFacts(bucket: readonly DecisionFact[]): readonly DecisionFact[] {
    const query = this.filterQuery().trim().toLowerCase();
    if (!query) return bucket;
    const locale = this.i18n.locale();
    const depth = this.viewDepth();
    return bucket.filter(fact => {
      const label = this.factLabel(fact).toLowerCase();
      const groupLabel = resolveFactGroup(fact, locale, depth).label.toLowerCase();
      return label.includes(query)
        || groupLabel.includes(query)
        || fact.path.toLowerCase().includes(query);
    });
  }

  private groupBucketFacts(bucket: readonly DecisionFact[]): readonly ScenarioFactGroupBucket[] {
    if (bucket.length === 0) return [];
    const locale = this.i18n.locale();
    const depth = this.viewDepth();
    const grouped = new Map<string, { label: string; facts: DecisionFact[]; order: number; firstSeen: number }>();
    bucket.forEach((fact, index) => {
      const group = resolveFactGroup(fact, locale, depth);
      const existing = grouped.get(group.key);
      if (existing) {
        existing.facts.push(fact);
      } else {
        grouped.set(group.key, {
          label: group.label,
          facts: [fact],
          order: group.order,
          firstSeen: index
        });
      }
    });
    const ordered = [...grouped.entries()]
      .sort((a, b) => a[1].order - b[1].order || a[1].firstSeen - b[1].firstSeen);
    const showHeading = ordered.length >= 2;
    return ordered.map(([key, value]) => ({
      key,
      label: value.label,
      showHeading,
      facts: value.facts
    }));
  }
}
