export interface RuleLegalBasisDescriptor {
  readonly code: string;
  readonly title?: string | null;
  readonly article?: string | null;
  readonly jurisdiction?: string | null;
  readonly summary?: string | null;
  readonly url?: string | null;
}

export interface RuleDocumentationDescriptor {
  readonly title?: string | null;
  readonly summary?: string | null;
  readonly whenApplies?: string | null;
  readonly rationale?: string | null;
  readonly legalBasis?: readonly RuleLegalBasisDescriptor[] | null;
  readonly customizationGuidance?: string | null;
}

export const DOMAIN_RULE_DOCUMENTATION_KEY = 'documentation' as const;

export const RULE_DOCUMENTATION_LIMITS = {
  titleMaxLength: 255,
  textMaxLength: 4000,
  legalBasisMaxEntries: 20,
  legalBasisShortMaxLength: 255,
  legalBasisSummaryMaxLength: 4000,
  legalBasisUrlMaxLength: 1024
} as const;

export interface RuleDocumentationValidationMessages {
  readonly titleLabel: string;
  readonly summaryLabel: string;
  readonly whenAppliesLabel: string;
  readonly rationaleLabel: string;
  readonly customizationGuidanceLabel: string;
  readonly legalBasisCodeLabel: string;
  readonly legalBasisTitleLabel: string;
  readonly legalBasisArticleLabel: string;
  readonly legalBasisJurisdictionLabel: string;
  readonly legalBasisSummaryLabel: string;
  readonly legalBasisUrlLabel: string;
  readonly maxLengthExceeded: (field: string, max: number) => string;
  readonly legalBasisMaxEntries: (max: number) => string;
  readonly legalBasisIdentityRequired: (index: number) => string;
  readonly legalBasisInvalidUrl: (index: number) => string;
}

export interface RuleLegalBasisEntryValidation {
  readonly index: number;
  readonly identityError?: string;
  readonly codeError?: string;
  readonly titleError?: string;
  readonly articleError?: string;
  readonly jurisdictionError?: string;
  readonly summaryError?: string;
  readonly urlError?: string;
}

export interface RuleDocumentationValidationResult {
  readonly errors: readonly string[];
  readonly fieldErrors: Readonly<Partial<Record<'title' | 'summary' | 'whenApplies' | 'rationale' | 'customizationGuidance' | 'legalBasis', string>>>;
  readonly legalBasisErrors: readonly RuleLegalBasisEntryValidation[];
}

function asPlainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function rawTrimmedLength(value: unknown): number {
  return typeof value === 'string' ? value.trim().length : 0;
}

/**
 * Validates an external legal-basis reference URL fail-closed: only absolute
 * `http:` or `https:` URLs without embedded credentials and within max length are accepted.
 */
export function isSafeLegalBasisUrl(url: string | null | undefined): boolean {
  const clean = cleanText(url);
  if (!clean || clean.startsWith('//') || clean.length > RULE_DOCUMENTATION_LIMITS.legalBasisUrlMaxLength) {
    return false;
  }
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    return !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function normalizeRuleLegalBasisList(raw: unknown): RuleLegalBasisDescriptor[] {
  if (raw === null || raw === undefined) {
    return [];
  }
  const items = Array.isArray(raw) ? raw : [raw];
  const normalized: RuleLegalBasisDescriptor[] = [];
  const seen = new Set<string>();

  for (const entry of items) {
    if (typeof entry === 'string') {
      const code = cleanText(entry);
      if (code && !seen.has(code)) {
        seen.add(code);
        normalized.push({ code });
      }
      continue;
    }
    const record = asPlainRecord(entry);
    if (!record) {
      continue;
    }
    const title = cleanText(record['title']);
    const article = cleanText(record['article']);
    const jurisdiction = cleanText(record['jurisdiction']);
    const summary = cleanText(record['summary']);
    const rawUrl = cleanText(record['url']);
    const url = rawUrl && isSafeLegalBasisUrl(rawUrl) ? rawUrl : undefined;
    const code = cleanText(record['code']) ?? title ?? article ?? summary;
    if (!code) {
      continue;
    }
    const dedupeKey = `${code}::${article ?? ''}::${jurisdiction ?? ''}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    normalized.push({
      code,
      ...(title ? { title } : {}),
      ...(article ? { article } : {}),
      ...(jurisdiction ? { jurisdiction } : {}),
      ...(summary ? { summary } : {}),
      ...(url ? { url } : {})
    });
  }

  return normalized;
}

export function extractRuleDocumentation(
  definitionOrRecord: unknown
): RuleDocumentationDescriptor | null {
  const record = asPlainRecord(definitionOrRecord);
  if (!record) {
    return null;
  }
  const nested = asPlainRecord(record[DOMAIN_RULE_DOCUMENTATION_KEY]);
  const candidate = nested ?? (DOMAIN_RULE_DOCUMENTATION_KEY in record && record[DOMAIN_RULE_DOCUMENTATION_KEY] === null
    ? null
    : record);
  if (!candidate) {
    return null;
  }

  const title = cleanText(candidate['title']);
  const summary = cleanText(candidate['summary']);
  const whenApplies = cleanText(candidate['whenApplies']);
  const rationale = cleanText(candidate['rationale']);
  const customizationGuidance = cleanText(candidate['customizationGuidance']);
  const legalBasis = normalizeRuleLegalBasisList(candidate['legalBasis']);

  if (
    !title
    && !summary
    && !whenApplies
    && !rationale
    && !customizationGuidance
    && legalBasis.length === 0
  ) {
    return null;
  }

  return {
    ...(title ? { title } : {}),
    ...(summary ? { summary } : {}),
    ...(whenApplies ? { whenApplies } : {}),
    ...(rationale ? { rationale } : {}),
    ...(legalBasis.length > 0 ? { legalBasis } : {}),
    ...(customizationGuidance ? { customizationGuidance } : {})
  };
}

export function normalizeAndCompactDocumentation(
  documentation: RuleDocumentationDescriptor | Record<string, unknown> | null | undefined
): RuleDocumentationDescriptor | null {
  if (!documentation) {
    return null;
  }
  const record = asPlainRecord(documentation);
  if (!record) {
    return null;
  }
  const title = cleanText(record['title']);
  const summary = cleanText(record['summary']);
  const whenApplies = cleanText(record['whenApplies']);
  const rationale = cleanText(record['rationale']);
  const customizationGuidance = cleanText(record['customizationGuidance']);
  const legalBasis = normalizeRuleLegalBasisList(record['legalBasis']);

  if (
    !title
    && !summary
    && !whenApplies
    && !rationale
    && !customizationGuidance
    && legalBasis.length === 0
  ) {
    return null;
  }

  return {
    ...(title ? { title } : {}),
    ...(summary ? { summary } : {}),
    ...(whenApplies ? { whenApplies } : {}),
    ...(rationale ? { rationale } : {}),
    ...(legalBasis.length > 0 ? { legalBasis } : {}),
    ...(customizationGuidance ? { customizationGuidance } : {})
  };
}

export function mergeRuleDocumentation(
  definition: Record<string, unknown> | null | undefined,
  documentation: RuleDocumentationDescriptor | Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const base: Record<string, unknown> = asPlainRecord(definition) ? { ...definition } : {};
  const normalized = normalizeAndCompactDocumentation(documentation);
  if (!normalized) {
    delete base[DOMAIN_RULE_DOCUMENTATION_KEY];
    return base;
  }
  return {
    ...base,
    [DOMAIN_RULE_DOCUMENTATION_KEY]: normalized
  };
}

export function validateRuleDocumentationDetailed(
  documentation: RuleDocumentationDescriptor | null | undefined,
  messages: RuleDocumentationValidationMessages
): RuleDocumentationValidationResult {
  if (!documentation) {
    return { errors: [], fieldErrors: {}, legalBasisErrors: [] };
  }

  const errors: string[] = [];
  const fieldErrors: Partial<Record<'title' | 'summary' | 'whenApplies' | 'rationale' | 'customizationGuidance' | 'legalBasis', string>> = {};
  const legalBasisErrors: RuleLegalBasisEntryValidation[] = [];

  if (rawTrimmedLength(documentation.title) > RULE_DOCUMENTATION_LIMITS.titleMaxLength) {
    const msg = messages.maxLengthExceeded(messages.titleLabel, RULE_DOCUMENTATION_LIMITS.titleMaxLength);
    fieldErrors.title = msg;
    errors.push(msg);
  }
  const textChecks: ReadonlyArray<readonly ['summary' | 'whenApplies' | 'rationale' | 'customizationGuidance', string]> = [
    ['summary', messages.summaryLabel],
    ['whenApplies', messages.whenAppliesLabel],
    ['rationale', messages.rationaleLabel],
    ['customizationGuidance', messages.customizationGuidanceLabel]
  ];
  for (const [key, label] of textChecks) {
    if (rawTrimmedLength(documentation[key]) > RULE_DOCUMENTATION_LIMITS.textMaxLength) {
      const msg = messages.maxLengthExceeded(label, RULE_DOCUMENTATION_LIMITS.textMaxLength);
      fieldErrors[key] = msg;
      errors.push(msg);
    }
  }

  const entries = Array.isArray(documentation.legalBasis) ? documentation.legalBasis : [];
  if (entries.length > RULE_DOCUMENTATION_LIMITS.legalBasisMaxEntries) {
    const msg = messages.legalBasisMaxEntries(RULE_DOCUMENTATION_LIMITS.legalBasisMaxEntries);
    fieldErrors.legalBasis = msg;
    errors.push(msg);
  }

  entries.forEach((entry, index) => {
    const oneBased = index + 1;
    const code = cleanText(entry?.code);
    const title = cleanText(entry?.title);
    const article = cleanText(entry?.article);
    const jurisdiction = cleanText(entry?.jurisdiction);
    const summary = cleanText(entry?.summary);
    const url = cleanText(entry?.url);

    let entryValidation: RuleLegalBasisEntryValidation = { index };
    let hasEntryError = false;

    if (!code && !title && !article && !summary) {
      const msg = messages.legalBasisIdentityRequired(oneBased);
      entryValidation = { ...entryValidation, identityError: msg };
      errors.push(msg);
      hasEntryError = true;
    }
    if (code && code.length > RULE_DOCUMENTATION_LIMITS.legalBasisShortMaxLength) {
      const msg = messages.maxLengthExceeded(`${messages.legalBasisCodeLabel} (#${oneBased})`, RULE_DOCUMENTATION_LIMITS.legalBasisShortMaxLength);
      entryValidation = { ...entryValidation, codeError: msg };
      errors.push(msg);
      hasEntryError = true;
    }
    if (title && title.length > RULE_DOCUMENTATION_LIMITS.legalBasisShortMaxLength) {
      const msg = messages.maxLengthExceeded(`${messages.legalBasisTitleLabel} (#${oneBased})`, RULE_DOCUMENTATION_LIMITS.legalBasisShortMaxLength);
      entryValidation = { ...entryValidation, titleError: msg };
      errors.push(msg);
      hasEntryError = true;
    }
    if (article && article.length > RULE_DOCUMENTATION_LIMITS.legalBasisShortMaxLength) {
      const msg = messages.maxLengthExceeded(`${messages.legalBasisArticleLabel} (#${oneBased})`, RULE_DOCUMENTATION_LIMITS.legalBasisShortMaxLength);
      entryValidation = { ...entryValidation, articleError: msg };
      errors.push(msg);
      hasEntryError = true;
    }
    if (jurisdiction && jurisdiction.length > RULE_DOCUMENTATION_LIMITS.legalBasisShortMaxLength) {
      const msg = messages.maxLengthExceeded(`${messages.legalBasisJurisdictionLabel} (#${oneBased})`, RULE_DOCUMENTATION_LIMITS.legalBasisShortMaxLength);
      entryValidation = { ...entryValidation, jurisdictionError: msg };
      errors.push(msg);
      hasEntryError = true;
    }
    if (summary && summary.length > RULE_DOCUMENTATION_LIMITS.legalBasisSummaryMaxLength) {
      const msg = messages.maxLengthExceeded(`${messages.legalBasisSummaryLabel} (#${oneBased})`, RULE_DOCUMENTATION_LIMITS.legalBasisSummaryMaxLength);
      entryValidation = { ...entryValidation, summaryError: msg };
      errors.push(msg);
      hasEntryError = true;
    }
    if (url) {
      if (url.length > RULE_DOCUMENTATION_LIMITS.legalBasisUrlMaxLength) {
        const msg = messages.maxLengthExceeded(`${messages.legalBasisUrlLabel} (#${oneBased})`, RULE_DOCUMENTATION_LIMITS.legalBasisUrlMaxLength);
        entryValidation = { ...entryValidation, urlError: msg };
        errors.push(msg);
        hasEntryError = true;
      } else if (!isSafeLegalBasisUrl(url)) {
        const msg = messages.legalBasisInvalidUrl(oneBased);
        entryValidation = { ...entryValidation, urlError: msg };
        errors.push(msg);
        hasEntryError = true;
      }
    }

    if (hasEntryError) {
      legalBasisErrors.push(entryValidation);
    }
  });

  return { errors, fieldErrors, legalBasisErrors };
}

export function validateRuleDocumentation(
  documentation: RuleDocumentationDescriptor | null | undefined,
  messages: RuleDocumentationValidationMessages
): readonly string[] {
  return validateRuleDocumentationDetailed(documentation, messages).errors;
}
