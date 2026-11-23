const LOWERCASE_CONNECTORS = new Set([
  'a',
  'as',
  'o',
  'os',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'na',
  'nas',
  'no',
  'nos',
  'para',
  'por',
  'com',
  'and',
  'of',
  'for',
  'in',
  'on',
  'to',
  'the'
]);

const UPPERCASE_ABBREVIATIONS = new Set([
  'API',
  'CPF',
  'CNPJ',
  'CLT',
  'DAG',
  'DTO',
  'HTTP',
  'ID',
  'IDS',
  'JSON',
  'LGPD',
  'OPA',
  'RH',
  'RLS',
  'SQL',
  'UF',
  'UI',
  'URI',
  'URL',
  'UUID',
  'XML'
]);

const PT_BR_WORD_ACCENTS: Readonly<Record<string, string>> = {
  administracao: 'Administração',
  frequencia: 'Frequência',
  frequencias: 'Frequências',
  lancamento: 'Lançamento',
  lancamentos: 'Lançamentos',
  ferias: 'Férias',
  licenca: 'Licença',
  licencas: 'Licenças',
  previdencia: 'Previdência',
  saude: 'Saúde',
  pericia: 'Perícia',
  beneficio: 'Benefício',
  beneficios: 'Benefícios',
  vacancia: 'Vacância',
  vacancias: 'Vacâncias',
  fiscalizacao: 'Fiscalização',
  concessao: 'Concessão',
  orgao: 'Órgão',
  orgaos: 'Órgãos',
  codigo: 'Código',
  codigos: 'Códigos',
  numero: 'Número',
  inicio: 'Início',
  salario: 'Salário',
  pensao: 'Pensão',
  decisao: 'Decisão',
  decisoes: 'Decisões',
  validacao: 'Validação',
  aprovacao: 'Aprovação',
  publicacao: 'Publicação',
  operacao: 'Operação',
  configuracao: 'Configuração',
  parametrizacao: 'Parametrização',
  padrao: 'Padrão',
  gestao: 'Gestão',
  revisao: 'Revisão',
  admissao: 'Admissão',
  rescisao: 'Rescisão',
  remuneracao: 'Remuneração',
  contribuicao: 'Contribuição',
  autorizacao: 'Autorização',
  solicitacao: 'Solicitação',
  excecao: 'Exceção',
  restricao: 'Restrição',
  extensao: 'Extensão',
  substituicao: 'Substituição',
  alteracao: 'Alteração',
  inclusao: 'Inclusão',
  exclusao: 'Exclusão',
  juridico: 'Jurídico',
  economico: 'Econômico',
  publico: 'Público',
  horario: 'Horário',
  periodo: 'Período',
  calculo: 'Cálculo',
  relatorio: 'Relatório',
  usuario: 'Usuário',
  historico: 'Histórico',
  catalogo: 'Catálogo',
  esocial: 'eSocial'
};

function splitSegmentWords(segment: string): string[] {
  return segment
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function formatReadableWord(
  word: string,
  index: number,
  locale: 'pt-BR' | 'en-US' = 'pt-BR'
): string {
  const upper = word.toUpperCase();
  if (UPPERCASE_ABBREVIATIONS.has(upper)) {
    return upper;
  }
  const lower = word.toLowerCase();
  if (index > 0 && LOWERCASE_CONNECTORS.has(lower)) {
    return lower;
  }
  if (locale === 'pt-BR') {
    const accented = PT_BR_WORD_ACCENTS[lower];
    if (accented) {
      return accented;
    }
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function humanizeSegment(segment: string, locale: 'pt-BR' | 'en-US' = 'pt-BR'): string {
  const words = splitSegmentWords(segment);
  if (words.length === 0) {
    return segment.trim();
  }
  return words.map((word, index) => formatReadableWord(word, index, locale)).join(' ');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function looksLikeTechnicalSlug(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || /\s/.test(trimmed)) {
    return false;
  }
  return /[._:/-]/.test(trimmed);
}

/**
 * Converts dot/kebab/snake/camelCase technical identifiers into clean human-readable labels
 * without hardcoding domain-specific catalogs.
 */
export function humanizeTechnicalSlug(
  raw: string | null | undefined,
  maxSegments?: number,
  locale: 'pt-BR' | 'en-US' = 'pt-BR'
): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    return '';
  }

  const rawSegments = trimmed
    .split(/[./:]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (rawSegments.length === 0) {
    return humanizeSegment(trimmed, locale);
  }

  const scopedSegments =
    maxSegments && maxSegments > 0 && rawSegments.length > maxSegments
      ? rawSegments.slice(-maxSegments)
      : rawSegments;

  return scopedSegments.map((segment) => humanizeSegment(segment, locale)).join(' · ');
}

/**
 * Removes redundant leading rule/decision codes (e.g. `RULE-01 — Title` -> `Title`)
 * when the code is already shown separately in technical metadata.
 */
export function stripLeadingDecisionCode(
  name: string | null | undefined,
  code: string | null | undefined
): string {
  const trimmedName = name?.trim() ?? '';
  const trimmedCode = code?.trim() ?? '';
  if (!trimmedName || !trimmedCode) {
    return trimmedName;
  }

  const prefixPattern = new RegExp(`^${escapeRegExp(trimmedCode)}\\s*(?:[—–:|/-]+)\\s*`, 'i');
  const stripped = trimmedName.replace(prefixPattern, '').trim();
  return stripped || trimmedName;
}

/**
 * Selects the clearest title for the active lens (`business` hides code prefixes and
 * humanizes raw slugs while preserving non-slug rule titles; `technical` preserves fidelity).
 */
export function humanizeDecisionTitle(
  name: string | null | undefined,
  code: string | null | undefined,
  didacticTitle: string | null | undefined,
  viewDepth: 'business' | 'technical',
  locale: 'pt-BR' | 'en-US' = 'pt-BR'
): string {
  const trimmedName = name?.trim() ?? '';
  const trimmedDidactic = didacticTitle?.trim() ?? '';
  const trimmedCode = code?.trim() ?? '';

  if (viewDepth === 'technical') {
    return trimmedName || trimmedDidactic || trimmedCode;
  }

  const withoutCode = stripLeadingDecisionCode(trimmedName, trimmedCode);
  if (withoutCode && !looksLikeTechnicalSlug(withoutCode)) {
    return withoutCode;
  }

  if (trimmedDidactic && !looksLikeTechnicalSlug(trimmedDidactic)) {
    return trimmedDidactic;
  }

  if (withoutCode) {
    return humanizeTechnicalSlug(withoutCode, undefined, locale);
  }
  if (trimmedCode) {
    return looksLikeTechnicalSlug(trimmedCode)
      ? humanizeTechnicalSlug(trimmedCode, undefined, locale)
      : trimmedCode;
  }
  return '';
}

const PT_BR_GENERIC_UNITS: Readonly<Record<string, string>> = {
  day: 'dia',
  days: 'dias',
  hour: 'hora',
  hours: 'horas',
  minute: 'minuto',
  minutes: 'minutos',
  second: 'segundo',
  seconds: 'segundos',
  week: 'semana',
  weeks: 'semanas',
  month: 'mês',
  months: 'meses',
  year: 'ano',
  years: 'anos',
  percent: '%',
  percentage: '%',
  business_days: 'dias úteis',
  calendar_days: 'dias corridos'
};

const EN_US_GENERIC_UNITS: Readonly<Record<string, string>> = {
  business_days: 'business days',
  calendar_days: 'calendar days',
  percent: '%',
  percentage: '%'
};

/**
 * Localizes generic measurement/time units declared in parameter catalogs without
 * guessing domain-specific labels or custom identifiers.
 */
export function localizeGenericUnit(
  unit: string | null | undefined,
  locale: 'pt-BR' | 'en-US' = 'pt-BR'
): string {
  const trimmed = unit?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  const normalized = trimmed.toLowerCase();
  const table = locale === 'pt-BR' ? PT_BR_GENERIC_UNITS : EN_US_GENERIC_UNITS;
  return table[normalized] ?? trimmed;
}

const RULE_TYPE_LABELS_PT_BR: Readonly<Record<string, string>> = {
  validation: 'Validação',
  approval_policy: 'Aprovação',
  workflow_action_policy: 'Ação de fluxo',
  compliance: 'Conformidade',
  privacy: 'Privacidade',
  selection_eligibility: 'Elegibilidade',
  determination: 'Determinação',
  calculation: 'Cálculo',
  business_rule: 'Regra de negócio',
  domain_rule: 'Regra de negócio',
  other: 'Outro tipo'
};

const RULE_TYPE_LABELS_EN_US: Readonly<Record<string, string>> = {
  validation: 'Validation',
  approval_policy: 'Approval',
  workflow_action_policy: 'Workflow action',
  compliance: 'Compliance',
  privacy: 'Privacy',
  selection_eligibility: 'Eligibility',
  determination: 'Determination',
  calculation: 'Calculation',
  business_rule: 'Business rule',
  domain_rule: 'Business rule',
  other: 'Other type'
};

/**
 * Formats canonical catalog `ruleType` classifiers into concise human labels.
 */
export function humanizeRuleType(
  ruleType: string | null | undefined,
  locale: 'pt-BR' | 'en-US' = 'pt-BR'
): string {
  const trimmed = ruleType?.trim() ?? '';
  if (!trimmed) {
    return locale === 'pt-BR' ? 'Outro tipo' : 'Other type';
  }
  const normalized = trimmed.toLowerCase();
  const table = locale === 'pt-BR' ? RULE_TYPE_LABELS_PT_BR : RULE_TYPE_LABELS_EN_US;
  return table[normalized] ?? humanizeTechnicalSlug(trimmed, undefined, locale);
}
