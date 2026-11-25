import { collectFactPaths } from './decision-inspection';
import { humanizeTechnicalSlug, localizeGenericUnit, looksLikeTechnicalSlug } from './humanize-labels';
import { POLICY_STUDIO_COPY } from './i18n';
import type { SupportedLocale } from './runtime-config';
import type { StudioViewDepth } from './studio-shell-state.service';
import type { DecisionFact, DecisionSummary } from '../features/catalog/catalog.fixture';
import type { StudioIconName } from '../shared/studio-icon.component';
import type { TermPopoverMetaTag, TermPopoverTone } from '../shared/term-popover.component';

export interface SplitFactDescription {
  readonly description: string;
  readonly hint: string | null;
  readonly isTemplatePlaceholder: boolean;
}

export interface PartitionedDecisionFacts {
  readonly evaluatedFacts: readonly DecisionFact[];
  readonly catalogOnlyFacts: readonly DecisionFact[];
  readonly scopedByRule: boolean;
}

export interface FactOriginGroup {
  readonly key: string;
  readonly label: string;
  readonly icon: StudioIconName;
  readonly order: number;
}

export interface FactPopoverModel {
  readonly chipLabel: string;
  readonly fullLabel: string;
  readonly category: string;
  readonly title: string;
  readonly summary: string;
  readonly hint: string | null;
  readonly metaTags: readonly TermPopoverMetaTag[];
  readonly detail: string | null;
  readonly tone: TermPopoverTone;
  readonly requiredBadge: string | null;
  readonly group: FactOriginGroup;
}

export interface GroupedDecisionFactItem {
  readonly fact: DecisionFact;
  readonly popover: FactPopoverModel;
}

export interface DecisionFactGroup {
  readonly group: FactOriginGroup;
  readonly items: readonly GroupedDecisionFactItem[];
}

const KNOWN_TECHNICAL_ROOTS = new Set([
  'draft',
  'tenant',
  'context',
  'record',
  'subject',
  'request',
  'input',
  'fato',
  'actor',
  'neighborhood',
  'params',
  'parameters',
  'param'
]);

const PARAMETER_PATH_PATTERN = /^para(ms?|meters)\./i;

const SEED_TEMPLATE_DESCRIPTION_PATTERN =
  /^(?:Fato (?:de avaliação|governado) do RuleSet|(?:Governed )?(?:Evaluation )?fact for RuleSet)\s+.+\(.+\)\.?$/i;

const EMBEDDED_HINT_PATTERN =
  /(?:^|(?:[.;|]\s+|\n+\s*))(?:Orientação operacional|Operational guidance|Orientação|Guidance|Dica|Hint)\s*:\s*([\s\S]+)$/i;

const PT_BR_WHOLE_WORD_HINTS = new Set([
  'administracao',
  'frequencia',
  'frequencias',
  'lancamento',
  'lancamentos',
  'ferias',
  'licenca',
  'licencas',
  'previdencia',
  'saude',
  'pericia',
  'beneficio',
  'beneficios',
  'vacancia',
  'vacancias',
  'fiscalizacao',
  'concessao',
  'orgao',
  'orgaos',
  'codigo',
  'codigos',
  'numero',
  'inicio',
  'salario',
  'pensao',
  'decisao',
  'decisoes',
  'validacao',
  'aprovacao',
  'publicacao',
  'operacao',
  'configuracao',
  'parametrizacao',
  'padrao',
  'gestao',
  'revisao',
  'admissao',
  'rescisao',
  'remuneracao',
  'contribuicao',
  'autorizacao',
  'solicitacao',
  'excecao',
  'restricao',
  'extensao',
  'substituicao',
  'alteracao',
  'inclusao',
  'exclusao',
  'juridico',
  'economico',
  'publico',
  'horario',
  'periodo',
  'calculo',
  'relatorio',
  'usuario',
  'historico',
  'catalogo',
  'vinculo',
  'vinculos',
  'saida',
  'saidas',
  'minimo',
  'maximo',
  'estatutaria',
  'estatutarias',
  'ocorrencia',
  'ocorrencias',
  'duracao',
  'vigencia',
  'referencia',
  'competencia',
  'dependencia',
  'situacao',
  'matricula',
  'exercicio',
  'obrigatorio',
  'obrigatoria',
  'criterio',
  'criterios',
  'quantidade'
]);

export function isParameterFactPath(path: string | null | undefined): boolean {
  return PARAMETER_PATH_PATTERN.test(path?.trim() ?? '');
}

export function splitFactDescriptionAndHint(
  description: string | null | undefined,
  explicitHint?: string | null
): SplitFactDescription {
  const normalizedHint = explicitHint?.trim() || null;
  const raw = description?.trim() ?? '';
  if (!raw) {
    return {
      description: '',
      hint: normalizedHint,
      isTemplatePlaceholder: false
    };
  }

  if (SEED_TEMPLATE_DESCRIPTION_PATTERN.test(raw)) {
    return {
      description: '',
      hint: normalizedHint,
      isTemplatePlaceholder: true
    };
  }

  const hintMatch = EMBEDDED_HINT_PATTERN.exec(raw);
  if (!hintMatch) {
    const dedupHint = normalizedHint && normalizedHint.toLowerCase() === raw.toLowerCase() ? null : normalizedHint;
    return {
      description: raw,
      hint: dedupHint,
      isTemplatePlaceholder: false
    };
  }

  const extractedHint = hintMatch[1]?.trim() || null;
  const before = raw.slice(0, hintMatch.index).trim();
  const cleanDescription =
    before && hintMatch[0].trimStart().startsWith('.') && !/[.!?]$/.test(before)
      ? `${before}.`
      : before;
  const candidateHint = normalizedHint ?? extractedHint;
  const dedupHint = candidateHint && cleanDescription && candidateHint.toLowerCase() === cleanDescription.toLowerCase()
    ? null
    : candidateHint;

  return {
    description: cleanDescription,
    hint: dedupHint,
    isTemplatePlaceholder: false
  };
}

function normalizeComparisonPath(path: string): string {
  return path.trim().replace(/:/g, '.').toLowerCase();
}

export function partitionDecisionFacts(
  decision: Pick<DecisionSummary, 'facts' | 'condition' | 'workspaceCondition' | 'evaluatedFactPaths'> | null | undefined,
  activeCondition?: unknown
): PartitionedDecisionFacts {
  if (!decision || decision.facts.length === 0) {
    return { evaluatedFacts: decision?.facts ?? [], catalogOnlyFacts: [], scopedByRule: false };
  }

  const effectiveCondition = activeCondition ?? decision.workspaceCondition ?? decision.condition;
  const referencedFromCondition = effectiveCondition != null
    ? collectFactPaths(effectiveCondition).filter(path => !isParameterFactPath(path))
    : [];
  const referencedFromDecision = (decision.evaluatedFactPaths ?? [])
    .map(path => path.trim())
    .filter(path => path.length > 0 && !isParameterFactPath(path));

  const referencePaths = [
    ...new Set([...referencedFromCondition, ...referencedFromDecision].map(normalizeComparisonPath))
  ];

  if (referencePaths.length === 0) {
    return { evaluatedFacts: decision.facts, catalogOnlyFacts: [], scopedByRule: false };
  }

  const evaluatedFacts: DecisionFact[] = [];
  const catalogOnlyFacts: DecisionFact[] = [];

  for (const fact of decision.facts) {
    const normalizedFactPath = normalizeComparisonPath(fact.path);
    const isMatched = referencePaths.some(ref =>
      normalizedFactPath === ref
      || normalizedFactPath.startsWith(`${ref}.`)
      || ref.startsWith(`${normalizedFactPath}.`)
    );
    if (isMatched) {
      evaluatedFacts.push(fact);
    } else {
      catalogOnlyFacts.push(fact);
    }
  }

  if (evaluatedFacts.length === 0) {
    return { evaluatedFacts: decision.facts, catalogOnlyFacts: [], scopedByRule: false };
  }

  return {
    evaluatedFacts,
    catalogOnlyFacts,
    scopedByRule: catalogOnlyFacts.length > 0
  };
}

function extractPathRootSegment(path: string): { readonly root: string; readonly hasNestedSegment: boolean } {
  const trimmed = path.trim();
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx > 0) {
    return {
      root: trimmed.slice(0, colonIdx).trim(),
      hasNestedSegment: true
    };
  }
  const dotIdx = trimmed.indexOf('.');
  if (dotIdx > 0) {
    return {
      root: trimmed.slice(0, dotIdx).trim(),
      hasNestedSegment: true
    };
  }
  return { root: trimmed, hasNestedSegment: false };
}

export function resolveFactGroup(
  fact: Pick<DecisionFact, 'path' | 'groupKey' | 'groupLabel'>,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): FactOriginGroup {
  const dict = POLICY_STUDIO_COPY[locale];
  const { root, hasNestedSegment } = extractPathRootSegment(fact.path);
  const rootLower = root.toLowerCase();

  if (viewDepth === 'technical') {
    if (!hasNestedSegment) {
      return { key: 'record', label: dict.factGroupPrimaryRecord, icon: 'file-edit', order: 0 };
    }
    return {
      key: rootLower,
      label: root,
      icon: rootLower === 'neighborhood' ? 'layers' : rootLower === 'draft' || rootLower === 'fato' ? 'file-edit' : 'database',
      order: rootLower === 'draft' || rootLower === 'fato' ? 0 : 1
    };
  }

  const explicitGroup = fact.groupLabel?.trim();
  const explicitKey = fact.groupKey?.trim();
  if (explicitGroup || explicitKey) {
    return {
      key: (explicitKey || explicitGroup!).toLowerCase(),
      label: explicitGroup || humanizeTechnicalSlug(explicitKey!, undefined, locale),
      icon: rootLower === 'neighborhood' ? 'layers' : 'database',
      order: rootLower === 'draft' || rootLower === 'fato' || !hasNestedSegment ? 0 : 1
    };
  }

  if (!hasNestedSegment || rootLower === 'draft' || rootLower === 'record' || rootLower === 'request' || rootLower === 'input' || rootLower === 'fato') {
    return { key: 'primary', label: dict.factGroupPrimaryRecord, icon: 'file-edit', order: 0 };
  }
  if (rootLower === 'neighborhood') {
    return { key: 'neighborhood', label: dict.factGroupNeighborhood, icon: 'layers', order: 2 };
  }
  if (rootLower === 'tenant') {
    return { key: 'tenant', label: dict.factGroupTenant, icon: 'building', order: 3 };
  }
  if (rootLower === 'context') {
    return { key: 'context', label: dict.factGroupContext, icon: 'sliders', order: 3 };
  }
  if (rootLower === 'actor' || rootLower === 'subject') {
    return { key: 'actor', label: dict.factGroupActor, icon: 'shield-check', order: 3 };
  }
  if (rootLower === 'params' || rootLower === 'parameters' || rootLower === 'param') {
    return { key: 'parameters', label: dict.factGroupParameters, icon: 'sliders', order: 3 };
  }

  return {
    key: rootLower,
    label: humanizeTechnicalSlug(root, 1, locale),
    icon: 'database',
    order: 1
  };
}

function stripLeadingEntityPrefix(
  rawLabel: string,
  factPath: string
): { readonly value: string; readonly prefixWasStripped: boolean } {
  const { root } = extractPathRootSegment(factPath);
  const rootLower = root.toLowerCase();
  const pathNormalized = factPath.trim().toLowerCase().replace(/:/g, '.');

  const colonMatch = /^([a-zA-Z][a-zA-Z0-9_.]*)\s*:\s*(.+)$/.exec(rawLabel);
  if (colonMatch) {
    const prefix = colonMatch[1]!.trim();
    const remainder = colonMatch[2]!.trim();
    const prefixLower = prefix.toLowerCase();
    const startsLowerTechnical = /^[a-z]/.test(prefix);
    const matchesKnownRoot =
      KNOWN_TECHNICAL_ROOTS.has(prefixLower)
      || prefixLower === rootLower
      || pathNormalized.startsWith(`${prefixLower}.`);

    if (remainder && (startsLowerTechnical || matchesKnownRoot)) {
      return { value: remainder, prefixWasStripped: true };
    }
  }

  const dotMatch = /^([a-zA-Z][a-zA-Z0-9_-]*)\.(.+)$/.exec(rawLabel);
  if (dotMatch) {
    const prefix = dotMatch[1]!.trim();
    const remainder = dotMatch[2]!.trim();
    const prefixLower = prefix.toLowerCase();
    const startsLowerTechnical = /^[a-z]/.test(prefix);
    const matchesKnownRoot =
      KNOWN_TECHNICAL_ROOTS.has(prefixLower)
      || (startsLowerTechnical && prefixLower === rootLower);

    if (remainder && matchesKnownRoot) {
      return { value: remainder, prefixWasStripped: true };
    }
  }

  const middleDotMatch = /^([a-zA-Z][a-zA-Z0-9_-]*)\s*·\s*(.+)$/.exec(rawLabel);
  if (middleDotMatch) {
    const prefix = middleDotMatch[1]!.trim();
    const remainder = middleDotMatch[2]!.trim();
    const prefixLower = prefix.toLowerCase();

    if (remainder && KNOWN_TECHNICAL_ROOTS.has(prefixLower) && prefixLower === rootLower) {
      return { value: remainder, prefixWasStripped: true };
    }
  }

  return { value: rawLabel, prefixWasStripped: false };
}

export function formatFactDisplayLabel(
  fact: Pick<DecisionFact, 'label' | 'path'>,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth,
  stripGroupPrefix = true
): string {
  const raw = fact.label?.trim() ?? '';
  if (viewDepth === 'technical') {
    return raw || fact.path;
  }

  const sourceLabel = raw || fact.path;
  const { value: candidate, prefixWasStripped } = stripGroupPrefix
    ? stripLeadingEntityPrefix(sourceLabel, fact.path)
    : { value: sourceLabel, prefixWasStripped: false };

  const isCamelCaseIdentifier = !/\s/.test(candidate) && /[a-z][A-Z]/.test(candidate);
  const isKnownLowerWord =
    !/\s/.test(candidate) && locale === 'pt-BR' && PT_BR_WHOLE_WORD_HINTS.has(candidate.toLowerCase());
  const matchesRawPathTail =
    prefixWasStripped &&
    !/\s/.test(candidate) &&
    extractPathTail(fact.path).toLowerCase() === candidate.toLowerCase();
  const matchesBareLowerPathTail =
    !/\s/.test(candidate) &&
    candidate === candidate.toLowerCase() &&
    fact.path.trim().toLowerCase() === candidate;

  if (
    looksLikeTechnicalSlug(candidate)
    || isCamelCaseIdentifier
    || isKnownLowerWord
    || matchesRawPathTail
    || matchesBareLowerPathTail
  ) {
    return humanizeTechnicalSlug(candidate, undefined, locale);
  }
  return candidate;
}

function extractPathTail(path: string): string {
  const parts = path.trim().split(/[.:]/).filter(Boolean);
  return parts.at(-1) ?? path;
}

export function humanizeFactValueTypeLabel(
  valueType: string | null | undefined,
  locale: SupportedLocale
): string {
  const normalized = valueType?.trim().toLowerCase() ?? '';
  const dict = POLICY_STUDIO_COPY[locale];
  switch (normalized) {
    case 'integer':
    case 'int':
    case 'int32':
    case 'int64':
      return dict.factTypeInteger;
    case 'number':
      return locale === 'pt-BR' ? 'Número' : 'Number';
    case 'decimal':
    case 'float':
    case 'double':
      return dict.factTypeDecimal;
    case 'string':
    case 'text':
      return dict.factTypeString;
    case 'boolean':
    case 'bool':
      return dict.factTypeBoolean;
    case 'date':
      return dict.factTypeDate;
    case 'datetime':
    case 'timestamp':
      return dict.factTypeDateTime;
    case 'string-array':
    case 'date-array':
    case 'number-array':
    case 'array<number>':
    case 'array':
      return dict.factTypeList;
    default:
      return valueType?.trim() || (locale === 'pt-BR' ? 'Valor' : 'Value');
  }
}

export function humanizeFactSensitivityPosture(
  sensitivity: string | null | undefined,
  locale: SupportedLocale
): { readonly label: string; readonly tone: 'neutral' | 'info' | 'warning' | 'danger' } {
  const normalized = sensitivity?.trim().toUpperCase() ?? '';
  const dict = POLICY_STUDIO_COPY[locale];
  switch (normalized) {
    case 'NON_SENSITIVE':
    case 'PUBLIC':
      return { label: dict.factSensitivityPublic, tone: 'neutral' };
    case 'PERSONAL':
      return { label: locale === 'pt-BR' ? 'Dado pessoal' : 'Personal data', tone: 'info' };
    case 'INTERNAL':
      return { label: dict.factSensitivityInternal, tone: 'info' };
    case 'SENSITIVE':
    case 'PII':
      return { label: dict.factSensitivitySensitive, tone: 'warning' };
    case 'SECRET':
    case 'RESTRICTED':
      return { label: dict.factSensitivityRestricted, tone: 'danger' };
    default:
      return { label: dict.factSensitivityDefault, tone: 'neutral' };
  }
}

export function humanizeFactRedaction(
  redaction: DecisionFact['redaction'] | string | null | undefined,
  locale: SupportedLocale
): string | null {
  const dict = POLICY_STUDIO_COPY[locale];
  switch ((redaction ?? '').toUpperCase()) {
    case 'MASK':
      return dict.factRedactionMasked;
    case 'HASH':
      return dict.factRedactionHashed;
    case 'OMIT':
      return dict.factRedactionOmitted;
    default:
      return null;
  }
}

function humanizeValuePresentationTag(
  fact: Pick<DecisionFact, 'valueType' | 'valuePresentation'>,
  locale: SupportedLocale
): string | null {
  const presentation = fact.valuePresentation?.trim().toLowerCase();
  if (!presentation) {
    return null;
  }
  const dict = POLICY_STUDIO_COPY[locale];
  switch (presentation) {
    case 'currency':
      return dict.factPresentationCurrency;
    case 'percentage':
      return dict.factPresentationPercentage;
    case 'integer':
      return fact.valueType === 'number' ? dict.factTypeInteger : null;
    case 'datetime':
      return dict.factPresentationDateTime;
    case 'time':
      return dict.factPresentationTime;
    case 'duration':
      return dict.factPresentationDuration;
    case 'identifier':
      return dict.factPresentationIdentifier;
    case 'date':
      return fact.valueType !== 'date' ? dict.factPresentationDate : null;
    default:
      return null;
  }
}

function formatConstraintsMetaTag(
  constraints: DecisionFact['constraints'] | null | undefined,
  locale: SupportedLocale
): string | null {
  if (!constraints) {
    return null;
  }
  const dict = POLICY_STUDIO_COPY[locale];
  if (constraints.min != null && constraints.max != null) {
    return dict.factConstraintsRange
      .replaceAll('{min}', String(constraints.min))
      .replaceAll('{max}', String(constraints.max));
  }
  if (constraints.min != null) {
    return dict.factConstraintsMin.replaceAll('{min}', String(constraints.min));
  }
  if (constraints.max != null) {
    return dict.factConstraintsMax.replaceAll('{max}', String(constraints.max));
  }
  if (constraints.minLength != null && constraints.maxLength != null) {
    return dict.factConstraintsLengthRange
      .replaceAll('{min}', String(constraints.minLength))
      .replaceAll('{max}', String(constraints.maxLength));
  }
  if (constraints.minLength != null) {
    return dict.factConstraintsLengthMin.replaceAll('{min}', String(constraints.minLength));
  }
  if (constraints.maxLength != null) {
    return dict.factConstraintsLengthMax.replaceAll('{max}', String(constraints.maxLength));
  }
  return null;
}

function deduplicateMetaTags(tags: readonly TermPopoverMetaTag[]): readonly TermPopoverMetaTag[] {
  const seen = new Set<string>();
  const unique: TermPopoverMetaTag[] = [];
  for (const tag of tags) {
    const key = tag.label.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(tag);
  }
  return unique;
}

function formatTechnicalDetail(fact: DecisionFact): string {
  const parts: string[] = [
    `Path: ${fact.path}${fact.providerRef?.trim() ? ` · ${fact.providerRef.trim()}` : ''}`
  ];
  const lineageParts = [
    fact.lineage?.sourceResourceKey?.trim(),
    fact.lineage?.attributeId?.trim(),
    fact.lineage?.transformation?.trim() ? `(${fact.lineage.transformation.trim()})` : null
  ].filter((item): item is string => Boolean(item));
  if (lineageParts.length > 0) {
    parts.push(`Lineage: ${lineageParts.join(' · ')}`);
  }
  const optionKey = fact.optionSourceRef?.sourceKey?.trim();
  const optionResource = fact.optionSourceRef?.resourceKey?.trim();
  if (optionKey || optionResource) {
    const lookupParts = [optionKey, optionResource].filter((item): item is string => Boolean(item));
    parts.push(`Lookup: ${lookupParts.join(' · ')}`);
  }
  return parts.join(' · ');
}

function appendStructuredFactMetaTags(
  metaTags: TermPopoverMetaTag[],
  fact: DecisionFact,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): void {
  const dict = POLICY_STUDIO_COPY[locale];
  const presentationLabel = humanizeValuePresentationTag(fact, locale);
  if (presentationLabel) {
    metaTags.push({ label: presentationLabel, tone: 'info' });
  }
  const constraintsLabel = formatConstraintsMetaTag(fact.constraints, locale);
  if (constraintsLabel) {
    metaTags.push({ label: constraintsLabel, tone: 'neutral' });
  }
  if (fact.constraints?.step != null && fact.constraints.step > 0) {
    metaTags.push({
      label: dict.factConstraintsStep.replaceAll('{step}', String(fact.constraints.step)),
      tone: 'neutral'
    });
  }
  const rawPattern = fact.constraints?.pattern?.trim();
  if (rawPattern) {
    const compactPattern = rawPattern.length > 36 ? `${rawPattern.slice(0, 35)}…` : rawPattern;
    metaTags.push({
      label: viewDepth === 'technical'
        ? dict.factConstraintsPatternTechnical.replaceAll('{pattern}', compactPattern)
        : dict.factConstraintsPatternBusiness,
      tone: 'neutral'
    });
  }
  const rawMask = fact.mask?.trim();
  if (rawMask) {
    metaTags.push({
      label: dict.factMaskPrefix.replaceAll('{mask}', rawMask),
      tone: 'neutral'
    });
  }
  const restricted = fact.sensitivity === 'SECRET' || fact.redaction === 'OMIT';
  if (!restricted && fact.allowedValues && fact.allowedValues.length > 0) {
    const preview = fact.allowedValues
      .slice(0, 3)
      .map(opt => opt.label?.trim() || String(opt.value))
      .join(', ');
    const remaining = fact.allowedValues.length - 3;
    const suffix = remaining > 0 ? ` +${remaining}` : '';
    metaTags.push({ label: `${dict.factAllowedValuesPrefix}: ${preview}${suffix}`, tone: 'neutral' });
  }
  if (fact.optionSourceRef?.sourceKey?.trim() || fact.optionSourceRef?.resourceKey?.trim()) {
    metaTags.push({ label: dict.factDynamicLookupBadge, tone: 'info' });
  }
  const classification = fact.governance?.classification?.trim().toLowerCase();
  if (classification === 'restricted') {
    metaTags.push({ label: dict.factGovernanceRestricted, tone: 'danger' });
  } else if (classification === 'confidential') {
    metaTags.push({ label: dict.factGovernanceConfidential, tone: 'warning' });
  }
  const aiVisibility = fact.governance?.aiVisibility?.trim().toLowerCase();
  if (aiVisibility === 'deny' || restricted) {
    metaTags.push({ label: dict.factAiDeniedBadge, tone: 'warning' });
  } else if (aiVisibility === 'mask') {
    metaTags.push({ label: dict.factGovernanceAiMasked, tone: 'info' });
  } else if (aiVisibility === 'summarize_only') {
    metaTags.push({ label: dict.factGovernanceAiSummaryOnly, tone: 'info' });
  }
  if (fact.governance?.exportable === false) {
    metaTags.push({ label: dict.factGovernanceExportBlocked, tone: 'warning' });
  }
  for (const complianceTag of (fact.governance?.complianceTags ?? []).slice(0, 3)) {
    const cleanTag = humanizeComplianceTag(complianceTag, locale);
    if (cleanTag) {
      metaTags.push({ label: cleanTag, tone: 'info' });
    }
  }
}

export function humanizeComplianceTag(
  tag: string | null | undefined,
  locale: SupportedLocale
): string {
  const trimmed = tag?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  const normalized = trimmed.replace(/[.:\s-]+/g, '_').toUpperCase();
  const dict = POLICY_STUDIO_COPY[locale];
  switch (normalized) {
    case 'COMPLIANCE':
      return dict.complianceTagCompliance;
    case 'INTERNAL_POLICY':
      return dict.complianceTagInternalPolicy;
    case 'REGULATORY':
      return dict.complianceTagRegulatory;
    case 'AUDIT':
      return dict.complianceTagAudit;
    case 'PRIVACY':
      return dict.complianceTagPrivacy;
    case 'SECURITY':
      return dict.complianceTagSecurity;
    case 'FINANCIAL':
      return dict.complianceTagFinancial;
    case 'STATUTORY':
      return dict.complianceTagStatutory;
    case 'CONTRACTUAL':
      return dict.complianceTagContractual;
    case 'PUBLIC_TRANSPARENCY':
      return dict.complianceTagPublicTransparency;
    case 'PUBLIC_TRANSPARENCY_REMUNERATION':
      return dict.complianceTagPublicTransparencyRemuneration;
    default:
      return trimmed;
  }
}

export function formatFactPopoverModel(
  fact: DecisionFact,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): FactPopoverModel {
  const dict = POLICY_STUDIO_COPY[locale];
  const group = resolveFactGroup(fact, locale, viewDepth);
  const chipLabel = formatFactDisplayLabel(fact, locale, viewDepth, true);
  const fullLabel = formatFactDisplayLabel(fact, locale, viewDepth, false);
  const parsed = splitFactDescriptionAndHint(fact.description, fact.hint);
  const sensitivity = humanizeFactSensitivityPosture(fact.sensitivity, locale);
  const redactionLabel = humanizeFactRedaction(fact.redaction, locale);
  const localizedUnit = localizeGenericUnit(fact.unit, locale);

  const chipTone: TermPopoverTone =
    sensitivity.tone === 'warning' || sensitivity.tone === 'danger'
      ? 'warning'
      : 'info';

  if (viewDepth === 'technical') {
    const metaTags: TermPopoverMetaTag[] = [
      { label: fact.valueType, tone: 'neutral' },
      { label: fact.nullable ? 'nullable' : 'required', tone: fact.nullable ? 'neutral' : 'info' }
    ];
    if (fact.unit?.trim()) {
      metaTags.push({ label: fact.unit.trim(), tone: 'neutral' });
    }
    appendStructuredFactMetaTags(metaTags, fact, locale, viewDepth);
    metaTags.push({
      label: fact.sensitivity,
      tone: sensitivity.tone
    });
    if (fact.redaction && fact.redaction !== 'NONE') {
      metaTags.push({ label: fact.redaction, tone: 'warning' });
    }

    const technicalSummary =
      fact.description?.trim()
      || dict.factGenericDescriptionInGroup.replaceAll('{group}', group.label);

    return {
      chipLabel,
      fullLabel,
      category: `${group.label} · ${fact.valueType}`,
      title: chipLabel,
      summary: parsed.hint && !parsed.isTemplatePlaceholder && parsed.description
        ? parsed.description
        : technicalSummary,
      hint: parsed.hint,
      metaTags: deduplicateMetaTags(metaTags),
      detail: formatTechnicalDetail(fact),
      tone: chipTone,
      requiredBadge: fact.nullable ? null : '*',
      group
    };
  }

  const businessSummary =
    parsed.description && !parsed.isTemplatePlaceholder
      ? parsed.description
      : dict.factGenericDescriptionInGroup.replaceAll('{group}', group.label);

  const metaTags: TermPopoverMetaTag[] = [
    { label: humanizeFactValueTypeLabel(fact.valueType, locale), tone: 'neutral' },
    { label: fact.nullable ? dict.factNullable : dict.factRequired, tone: fact.nullable ? 'neutral' : 'info' }
  ];

  if (localizedUnit) {
    metaTags.push({ label: localizedUnit, tone: 'neutral' });
  }
  appendStructuredFactMetaTags(metaTags, fact, locale, viewDepth);

  if (fact.sensitivity !== 'NON_SENSITIVE') {
    const combined = redactionLabel ? `${sensitivity.label} · ${redactionLabel}` : sensitivity.label;
    metaTags.push({ label: combined, tone: sensitivity.tone });
  } else if (redactionLabel) {
    metaTags.push({ label: redactionLabel, tone: 'info' });
  }

  return {
    chipLabel,
    fullLabel,
    category: group.label,
    title: chipLabel,
    summary: businessSummary,
    hint: parsed.hint,
    metaTags: deduplicateMetaTags(metaTags),
    detail: null,
    tone: chipTone,
    requiredBadge: fact.nullable ? null : '*',
    group
  };
}

export function groupFactsForDisplay(
  facts: readonly DecisionFact[],
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): readonly DecisionFactGroup[] {
  const buckets = new Map<string, { readonly group: FactOriginGroup; readonly items: GroupedDecisionFactItem[]; readonly firstSeen: number }>();

  facts.forEach((fact, index) => {
    const popover = formatFactPopoverModel(fact, locale, viewDepth);
    const existing = buckets.get(popover.group.key);
    if (existing) {
      existing.items.push({ fact, popover });
      return;
    }
    buckets.set(popover.group.key, {
      group: popover.group,
      items: [{ fact, popover }],
      firstSeen: index
    });
  });

  return [...buckets.values()]
    .sort((left, right) => left.group.order - right.group.order || left.firstSeen - right.firstSeen)
    .map(({ group, items }) => ({ group, items }));
}
