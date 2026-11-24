import { humanizeTechnicalSlug } from './humanize-labels';

type JsonObject = Record<string, unknown>;

export type DecisionComparisonOperator = '<=' | '<' | '>=' | '>' | '===' | '!==' | '==' | '!=' | 'in';

export interface FormatDecisionExpressionOptions {
  readonly locale?: 'pt-BR' | 'en-US';
  readonly viewDepth?: 'business' | 'technical';
  readonly multiline?: boolean;
  readonly humanizeUnknownPaths?: boolean;
}

export interface DecisionTableClause {
  readonly factPath: string;
  readonly operator: DecisionComparisonOperator;
  readonly rawValue: string;
  readonly valueKind: 'number' | 'boolean' | 'string' | 'array' | 'var';
}

export interface DecisionTableProjection {
  readonly combinator: 'and' | 'or';
  readonly clauses: readonly DecisionTableClause[];
  readonly lossless: boolean;
}

interface FormatContext {
  readonly factLabels?: Readonly<Record<string, string>> | ReadonlyMap<string, string>;
  readonly normalizedLabels: ReadonlyMap<string, string>;
  readonly locale: 'pt-BR' | 'en-US';
  readonly isBusiness: boolean;
  readonly legacyMode: boolean;
  readonly multiline: boolean;
  readonly humanizeUnknownPaths: boolean;
  readonly nullText: string;
}

const comparisonOperators = new Set<DecisionComparisonOperator>([
  '>=', '>', '<=', '<', '===', '!==', '==', '!=', 'in'
]);
const pureComparisonOperators = new Set(['>=', '>', '<=', '<', '===', '!==', '==', '!=']);
const arithmeticOperators = new Set(['+', '-', '*', '/', '%']);
const primaryGenericRoots = new Set(['draft', 'fato', 'record', 'request', 'input']);
const infixStringOperators = new Map<string, { readonly pt: string; readonly en: string }>([
  ['contains', { pt: 'contém', en: 'contains' }],
  ['startsWith', { pt: 'começa com', en: 'starts with' }],
  ['endsWith', { pt: 'termina com', en: 'ends with' }],
  ['matches', { pt: 'corresponde a', en: 'matches' }]
]);
const functionOperatorNames = new Map<string, { readonly pt: string; readonly en: string }>([
  ['substr', { pt: 'trecho', en: 'substr' }],
  ['cat', { pt: 'concatenar', en: 'cat' }],
  ['concat', { pt: 'concatenar', en: 'concat' }],
  ['len', { pt: 'tamanho', en: 'len' }],
  ['length', { pt: 'tamanho', en: 'length' }],
  ['isBlank', { pt: 'vazio', en: 'isBlank' }],
  ['lower', { pt: 'minúsculas', en: 'lower' }],
  ['upper', { pt: 'maiúsculas', en: 'upper' }],
  ['trim', { pt: 'aparar', en: 'trim' }],
  ['split', { pt: 'dividir', en: 'split' }],
  ['stringify', { pt: 'texto', en: 'stringify' }],
  ['toNumber', { pt: 'número', en: 'toNumber' }],
  ['parseInt', { pt: 'inteiro', en: 'parseInt' }],
  ['parseFloat', { pt: 'decimal', en: 'parseFloat' }],
  ['round', { pt: 'arredondar', en: 'round' }],
  ['ceil', { pt: 'teto', en: 'ceil' }],
  ['floor', { pt: 'piso', en: 'floor' }],
  ['abs', { pt: 'abs', en: 'abs' }],
  ['min', { pt: 'mín', en: 'min' }],
  ['max', { pt: 'máx', en: 'max' }],
  ['filter', { pt: 'filtrar', en: 'filter' }],
  ['map', { pt: 'mapear', en: 'map' }],
  ['reduce', { pt: 'reduzir', en: 'reduce' }],
  ['all', { pt: 'todos', en: 'all' }],
  ['some', { pt: 'algum', en: 'some' }],
  ['none', { pt: 'nenhum', en: 'none' }],
  ['merge', { pt: 'unir', en: 'merge' }],
  ['missing', { pt: 'ausentes', en: 'missing' }],
  ['missing_some', { pt: 'ausentesParcial', en: 'missing_some' }],
  ['hasKey', { pt: 'possuiChave', en: 'hasKey' }],
  ['now', { pt: 'agora', en: 'now' }],
  ['today', { pt: 'hoje', en: 'today' }],
  ['yearsSince', { pt: 'anosDesde', en: 'yearsSince' }],
  ['monthsSince', { pt: 'mesesDesde', en: 'monthsSince' }],
  ['daysSince', { pt: 'diasDesde', en: 'daysSince' }],
  ['isToday', { pt: 'éHoje', en: 'isToday' }],
  ['inLast', { pt: 'nosÚltimos', en: 'inLast' }],
  ['weekdayIn', { pt: 'diaDaSemanaEm', en: 'weekdayIn' }],
  ['daysBetween', { pt: 'diasEntre', en: 'daysBetween' }],
  ['dateDiff', { pt: 'diferençaDias', en: 'dateDiff' }],
  ['addDays', { pt: 'somarDias', en: 'addDays' }],
  ['subDays', { pt: 'subtrairDias', en: 'subDays' }]
]);

export function collectFactPaths(value: unknown): readonly string[] {
  const paths = new Set<string>();
  visit(value, candidate => {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const variable = (candidate as JsonObject)['var'];
      if (typeof variable === 'string' && variable.trim()) paths.add(variable.trim());
    }
  });
  return [...paths].sort();
}

export function formatDecisionExpression(
  value: unknown,
  factLabels?: Readonly<Record<string, string>> | ReadonlyMap<string, string>,
  options?: FormatDecisionExpressionOptions
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return null;
  }
  const legacyMode = options === undefined;
  const locale = options?.locale ?? 'pt-BR';
  const viewDepth = options?.viewDepth ?? 'technical';
  const isBusiness = !legacyMode && viewDepth === 'business';
  const nullText = legacyMode || (isBusiness && locale === 'pt-BR') ? 'nulo' : 'null';

  const ctx: FormatContext = {
    factLabels,
    normalizedLabels: buildNormalizedLabelMap(factLabels),
    locale,
    isBusiness,
    legacyMode,
    multiline: options?.multiline ?? false,
    humanizeUnknownPaths: options?.humanizeUnknownPaths ?? false,
    nullText
  };

  if (Array.isArray(value)) {
    return value.map(item => formatOperand(item, ctx, 0)).join(', ');
  }

  return formatOperand(value, ctx, 0, true);
}

function normalizePathLookupKey(path: string): string {
  return path.trim().replace(/:/g, '.').toLowerCase();
}

function buildNormalizedLabelMap(
  factLabels?: Readonly<Record<string, string>> | ReadonlyMap<string, string>
): ReadonlyMap<string, string> {
  const normalized = new Map<string, string>();
  if (!factLabels) return normalized;
  const entries = factLabels instanceof Map ? [...factLabels.entries()] : Object.entries(factLabels);
  for (const [key, label] of entries) {
    if (!key) continue;
    normalized.set(normalizePathLookupKey(key), label);
  }
  return normalized;
}

function lookupFactLabel(
  path: string,
  ctx: FormatContext
): string | null {
  if (ctx.factLabels instanceof Map) {
    const exact = ctx.factLabels.get(path);
    if (exact) return exact;
  } else if (ctx.factLabels && typeof ctx.factLabels === 'object') {
    const exact = (ctx.factLabels as Readonly<Record<string, string>>)[path];
    if (exact) return exact;
  }
  const byNormalized = ctx.normalizedLabels.get(normalizePathLookupKey(path));
  if (byNormalized) return byNormalized;
  return null;
}

function resolveFactPathText(path: string, ctx: FormatContext): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return ctx.isBusiness
      ? (ctx.locale === 'pt-BR' ? 'item atual' : 'current item')
      : 'current';
  }
  const knownLabel = lookupFactLabel(trimmed, ctx);
  if (knownLabel) return knownLabel;
  if (!ctx.humanizeUnknownPaths) return trimmed;

  const dotIdx = trimmed.indexOf('.');
  if (dotIdx > 0) {
    const root = trimmed.slice(0, dotIdx).toLowerCase();
    const tail = trimmed.slice(dotIdx + 1);
    if (primaryGenericRoots.has(root) && tail) {
      return humanizeTechnicalSlug(tail, undefined, ctx.locale) || tail;
    }
  }
  return humanizeTechnicalSlug(trimmed, undefined, ctx.locale) || trimmed;
}

function formatOperand(
  value: unknown,
  ctx: FormatContext,
  indentLevel: number,
  isTopLevel = false
): string {
  if (value === null || value === undefined) return ctx.nullText;
  if (typeof value === 'string') {
    return value.length === 0 && !ctx.legacyMode ? '""' : value;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') {
    if (!ctx.isBusiness) return String(value);
    return ctx.locale === 'pt-BR' ? (value ? 'Sim' : 'Não') : (value ? 'Yes' : 'No');
  }
  if (Array.isArray(value)) {
    const formatted = value.map(item => formatOperand(item, ctx, indentLevel)).join(', ');
    return ctx.legacyMode ? formatted : `[${formatted}]`;
  }
  if (typeof value !== 'object') return String(value);

  const entries = Object.entries(value as JsonObject);
  if (entries.length === 0) return '{}';
  if (entries.length !== 1) {
    const pairs = entries.map(([key, item]) => `${key}: ${formatOperand(item, ctx, indentLevel)}`);
    return `{ ${pairs.join(', ')} }`;
  }

  const [operator, raw] = entries[0]!;
  return formatOperatorNode(operator, raw, ctx, indentLevel, isTopLevel);
}

function formatOperatorNode(
  operator: string,
  raw: unknown,
  ctx: FormatContext,
  indentLevel: number,
  isTopLevel: boolean
): string {
  if (operator === 'var') {
    return formatVarNode(raw, ctx, indentLevel);
  }
  if (operator === '!' || operator === 'not') {
    const operandNode = Array.isArray(raw) ? raw[0] : raw;
    const inner = formatOperand(operandNode, ctx, indentLevel + 1);
    const wrappedInner = inner.includes('\n')
      ? `\n${'  '.repeat(indentLevel + 1)}${inner}\n${'  '.repeat(indentLevel)}`
      : inner;
    if (ctx.isBusiness) {
      const prefix = ctx.locale === 'pt-BR' ? 'NÃO' : 'NOT';
      return `${prefix} (${wrappedInner})`;
    }
    return `!(${wrappedInner})`;
  }
  if (operator === '!!') {
    const operandNode = Array.isArray(raw) ? raw[0] : raw;
    const inner = formatOperand(operandNode, ctx, indentLevel);
    if (ctx.isBusiness) {
      const fn = ctx.locale === 'pt-BR' ? 'definido' : 'present';
      return `${fn}(${inner})`;
    }
    return `!!(${inner})`;
  }
  if (operator === 'or' || operator === 'and') {
    return formatLogicalGroup(operator, raw, ctx, indentLevel, isTopLevel);
  }
  if (operator === 'if' || operator === '?:') {
    return formatConditionalNode(raw, ctx, indentLevel);
  }
  if (operator === '+' && ctx.isBusiness) {
    const minutesTarget = matchTimeStringToMinutesTarget(raw);
    if (minutesTarget !== null) {
      const fn = ctx.locale === 'pt-BR' ? 'minutos' : 'minutes';
      return `${fn}(${formatOperand(minutesTarget, ctx, indentLevel)})`;
    }
  }
  if (pureComparisonOperators.has(operator)) {
    const args = toArgList(raw);
    if (args.length >= 2) {
      const glyph = formatComparisonGlyph(operator, ctx);
      return args.map(arg => formatOperand(arg, ctx, indentLevel)).join(` ${glyph} `);
    }
  }
  if (operator === 'in') {
    const args = toArgList(raw);
    if (args.length >= 2) {
      const left = formatOperand(args[0], ctx, indentLevel);
      const right = formatOperand(args[1], ctx, indentLevel);
      const word = ctx.legacyMode ? 'in' : (ctx.isBusiness && ctx.locale === 'pt-BR' ? 'em' : 'in');
      return `${left} ${word} ${right}`;
    }
  }
  if (arithmeticOperators.has(operator)) {
    return formatArithmeticNode(operator, raw, ctx, indentLevel);
  }
  if (operator === 'date') {
    const args = toArgList(raw);
    const fn = ctx.legacyMode || (ctx.isBusiness && ctx.locale === 'pt-BR') ? 'data' : 'date';
    return `${fn}(${args.map(arg => formatOperand(arg, ctx, indentLevel)).join(', ')})`;
  }
  if (operator === 'coalesce') {
    return formatCoalesceNode(raw, ctx, indentLevel);
  }
  if (operator === 'jsonGet') {
    return formatJsonGetNode(raw, ctx, indentLevel);
  }

  const infixMeta = infixStringOperators.get(operator);
  if (infixMeta && ctx.isBusiness) {
    const args = toArgList(raw);
    if (args.length >= 2) {
      const keyword = ctx.locale === 'pt-BR' ? infixMeta.pt : infixMeta.en;
      return `${formatOperand(args[0], ctx, indentLevel)} ${keyword} ${formatOperand(args[1], ctx, indentLevel)}`;
    }
  }

  const fnMeta = functionOperatorNames.get(operator);
  const fnName = fnMeta && ctx.isBusiness && ctx.locale === 'pt-BR' ? fnMeta.pt : (fnMeta ? operator : operator);
  if ((operator === 'now' || operator === 'today') && (raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0))) {
    return `${fnName}()`;
  }
  const args = raw === undefined ? [] : toArgList(raw);
  return `${fnName}(${args.map(arg => formatOperand(arg, ctx, indentLevel)).join(', ')})`;
}

function formatVarNode(raw: unknown, ctx: FormatContext, indentLevel: number): string {
  if (typeof raw === 'string') {
    return resolveFactPathText(raw, ctx);
  }
  if (Array.isArray(raw) && raw.length > 0) {
    const path = typeof raw[0] === 'string' ? raw[0] : '';
    const resolved = resolveFactPathText(path, ctx);
    if (raw.length >= 2 && raw[1] !== undefined) {
      const fn = ctx.legacyMode || (ctx.isBusiness && ctx.locale === 'pt-BR') ? 'valor' : 'coalesce';
      return `${fn}(${resolved}, ${formatOperand(raw[1], ctx, indentLevel)})`;
    }
    return resolved;
  }
  return formatOperand(raw, ctx, indentLevel);
}

function formatCoalesceNode(raw: unknown, ctx: FormatContext, indentLevel: number): string {
  const args = toArgList(raw);
  const fn = ctx.legacyMode || (ctx.isBusiness && ctx.locale === 'pt-BR') ? 'valor' : 'coalesce';
  if (ctx.legacyMode || args.length === 1 || (args.length === 2 && args[1] === null)) {
    return `${fn}(${formatOperand(args[0], ctx, indentLevel)})`;
  }
  return `${fn}(${args.map(arg => formatOperand(arg, ctx, indentLevel)).join(', ')})`;
}

function formatJsonGetNode(raw: unknown, ctx: FormatContext, indentLevel: number): string {
  const args = toArgList(raw);
  const target = args[0];
  const key = args[1];
  if (args.length >= 2 && typeof key === 'string') {
    const targetVar = extractDirectVarPath(target);
    if (targetVar) {
      return resolveFactPathText(`${targetVar}.${key}`, ctx);
    }
    const targetText = formatOperand(target, ctx, indentLevel);
    const wrappedTarget = isCompoundNode(target) ? `(${targetText})` : targetText;
    const keyText = ctx.isBusiness ? (humanizeTechnicalSlug(key, undefined, ctx.locale) || key) : key;
    return `${wrappedTarget}.${keyText}`;
  }
  const fn = ctx.isBusiness && ctx.locale === 'pt-BR' ? 'campo' : 'jsonGet';
  return `${fn}(${args.map(arg => formatOperand(arg, ctx, indentLevel)).join(', ')})`;
}

function formatConditionalNode(raw: unknown, ctx: FormatContext, indentLevel: number): string {
  const args = toArgList(raw);
  if (args.length < 2) {
    return `if(${args.map(arg => formatOperand(arg, ctx, indentLevel)).join(', ')})`;
  }
  const kw = ctx.isBusiness && ctx.locale === 'pt-BR'
    ? { ifWord: 'se', thenWord: 'então', elseifWord: 'senão se', elseWord: 'senão' }
    : { ifWord: 'if', thenWord: 'then', elseifWord: 'else if', elseWord: 'else' };

  const segments: string[] = [];
  let index = 0;
  while (index + 1 < args.length) {
    const cond = formatOperand(args[index], ctx, indentLevel + 1);
    const branch = formatOperand(args[index + 1], ctx, indentLevel + 1);
    const lead = index === 0 ? kw.ifWord : kw.elseifWord;
    segments.push(`${lead} (${cond}) ${kw.thenWord} ${branch}`);
    index += 2;
  }
  if (index < args.length) {
    segments.push(`${kw.elseWord} ${formatOperand(args[index], ctx, indentLevel + 1)}`);
  }

  const inline = segments.join(' ');
  if (!ctx.multiline || (inline.length <= 72 && !inline.includes('\n'))) {
    return inline;
  }
  const indent = '  '.repeat(indentLevel);
  return segments.join(`\n${indent}`);
}

function formatArithmeticNode(
  operator: string,
  raw: unknown,
  ctx: FormatContext,
  indentLevel: number
): string {
  const args = toArgList(raw);
  if (args.length === 0) return operator;
  if (args.length === 1) {
    const inner = formatOperand(args[0], ctx, indentLevel);
    return isAdditiveNode(args[0]) ? `${operator}(${inner})` : `${operator}${inner}`;
  }
  const needsAdditiveParens = operator === '*' || operator === '/' || operator === '%';
  return args
    .map(arg => {
      const rendered = formatOperand(arg, ctx, indentLevel);
      return needsAdditiveParens && isAdditiveNode(arg) ? `(${rendered})` : rendered;
    })
    .join(` ${operator} `);
}

function formatLogicalGroup(
  operator: 'and' | 'or',
  raw: unknown,
  ctx: FormatContext,
  indentLevel: number,
  _isTopLevel: boolean
): string {
  const args = toArgList(raw);
  const joiner = operator === 'or'
    ? (ctx.locale === 'pt-BR' || ctx.legacyMode ? 'OU' : 'OR')
    : (ctx.locale === 'pt-BR' || ctx.legacyMode ? 'E' : 'AND');

  if (!ctx.multiline) {
    return args.map(item => `(${formatOperand(item, ctx, indentLevel)})`).join(` ${joiner} `);
  }

  const childIndent = indentLevel + 1;
  const formattedChildren = args.map(item => {
    const childText = formatOperand(item, ctx, childIndent);
    const needsParens = isLogicalOrConditionalNode(item);
    if (!needsParens) return childText;
    if (childText.includes('\n')) {
      const closePad = '  '.repeat(indentLevel);
      const line0Pad = '  '.repeat(childIndent);
      return `(\n${line0Pad}${childText}\n${closePad})`;
    }
    return `(${childText})`;
  });

  const inline = formattedChildren.join(` ${joiner} `);
  const hasNestedCompound = args.some(isLogicalOrConditionalNode);
  const hasNewline = inline.includes('\n');

  if (!hasNewline && !hasNestedCompound && args.length <= 2 && inline.length <= 68) {
    return inline;
  }

  const lineIndent = '  '.repeat(indentLevel);
  return formattedChildren
    .map((child, idx) => (idx === 0 ? child : `${lineIndent}${joiner} ${child}`))
    .join('\n');
}

function formatComparisonGlyph(operator: string, ctx: FormatContext): string {
  if (!ctx.isBusiness) return operator;
  switch (operator) {
    case '===':
    case '==':
      return '=';
    case '!==':
    case '!=':
      return '≠';
    case '<=':
      return '≤';
    case '>=':
      return '≥';
    default:
      return operator;
  }
}

function matchTimeStringToMinutesTarget(raw: unknown): unknown | null {
  const args = toArgList(raw);
  if (args.length !== 2) return null;
  const hourTarget = extractHoursTimesSixtyTarget(args[0]) ?? extractHoursTimesSixtyTarget(args[1]);
  const minuteTarget = extractSubstrSliceTarget(args[1], 3, 2) ?? extractSubstrSliceTarget(args[0], 3, 2);
  if (hourTarget === null || minuteTarget === null) return null;
  return canonicalDecisionExpression(hourTarget) === canonicalDecisionExpression(minuteTarget)
    ? minuteTarget
    : null;
}

function extractHoursTimesSixtyTarget(node: unknown): unknown | null {
  const multArgs = extractOperatorArgs(node, '*');
  if (!multArgs || multArgs.length !== 2) return null;
  if (multArgs[1] === 60) return extractSubstrSliceTarget(multArgs[0], 0, 2);
  if (multArgs[0] === 60) return extractSubstrSliceTarget(multArgs[1], 0, 2);
  return null;
}

function extractSubstrSliceTarget(node: unknown, expectedStart: number, expectedLen: number): unknown | null {
  const toNumArgs = extractOperatorArgs(node, 'toNumber');
  if (!toNumArgs || toNumArgs.length !== 1) return null;
  const substrArgs = extractOperatorArgs(toNumArgs[0], 'substr');
  if (!substrArgs || substrArgs.length < 3) return null;
  if (substrArgs[1] === expectedStart && substrArgs[2] === expectedLen) {
    return substrArgs[0] ?? null;
  }
  return null;
}

function extractOperatorArgs(node: unknown, expectedOp: string): readonly unknown[] | null {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  const entries = Object.entries(node as JsonObject);
  if (entries.length !== 1 || entries[0]![0] !== expectedOp) return null;
  return toArgList(entries[0]![1]);
}

function extractDirectVarPath(node: unknown): string | null {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  const entries = Object.entries(node as JsonObject);
  if (entries.length !== 1 || entries[0]![0] !== 'var') return null;
  const raw = entries[0]![1];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim()) return raw[0].trim();
  return null;
}

function isAdditiveNode(node: unknown): boolean {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  const entries = Object.entries(node as JsonObject);
  if (entries.length !== 1) return false;
  const [op, raw] = entries[0]!;
  return (op === '+' || op === '-') && toArgList(raw).length >= 2;
}

function isLogicalOrConditionalNode(node: unknown): boolean {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  const entries = Object.entries(node as JsonObject);
  if (entries.length !== 1) return false;
  const op = entries[0]![0];
  return op === 'and' || op === 'or' || op === 'if' || op === '?:';
}

function isCompoundNode(node: unknown): boolean {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  const entries = Object.entries(node as JsonObject);
  if (entries.length !== 1) return false;
  return entries[0]![0] !== 'var';
}

function toArgList(raw: unknown): readonly unknown[] {
  return Array.isArray(raw) ? raw : [raw];
}

export function canonicalDecisionExpression(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalDecisionExpression).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as JsonObject)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalDecisionExpression(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function editableDecisionCondition(value: unknown): unknown {
  const guarded = nullGuardedDisjunction(value);
  return guarded ? guarded.at(-1) : value;
}

export function composeDecisionCondition(original: unknown, edited: unknown): unknown {
  const guarded = nullGuardedDisjunction(original);
  return guarded ? { or: [...guarded.slice(0, -1), edited] } : edited;
}

export function extractDecisionTableProjection(condition: unknown): DecisionTableProjection {
  const target = editableDecisionCondition(condition);
  if (target === null || target === undefined) {
    return { combinator: 'and', clauses: [], lossless: true };
  }
  if (typeof target !== 'object' || Array.isArray(target)) {
    return { combinator: 'and', clauses: [], lossless: false };
  }
  const entries = Object.entries(target as JsonObject);
  if (entries.length !== 1) {
    return { combinator: 'and', clauses: [], lossless: false };
  }
  const [operator, raw] = entries[0];
  if ((operator === 'and' || operator === 'or') && Array.isArray(raw)) {
    const parsed = raw.map(node => parseSingleClause(node, false));
    if (parsed.every((item): item is DecisionTableClause => item !== null)) {
      return {
        combinator: operator,
        clauses: parsed,
        lossless: true
      };
    }
    const fallbackClauses: DecisionTableClause[] = [];
    visit(target, node => {
      const clause = parseSingleClause(node, true);
      if (clause) fallbackClauses.push(clause);
    });
    return {
      combinator: operator,
      clauses: fallbackClauses,
      lossless: false
    };
  }

  const single = parseSingleClause(target, false);
  if (single) {
    return {
      combinator: 'and',
      clauses: [single],
      lossless: true
    };
  }

  const fallbackClauses: DecisionTableClause[] = [];
  visit(target, node => {
    const clause = parseSingleClause(node, true);
    if (clause) fallbackClauses.push(clause);
  });
  return {
    combinator: 'and',
    clauses: fallbackClauses,
    lossless: false
  };
}

export function compileDecisionTableProjection(projection: DecisionTableProjection): unknown {
  const validClauses = projection.clauses.filter(clause => clause.factPath.trim().length > 0);
  if (validClauses.length === 0) return null;
  const compiled = validClauses.map(clause => ({
    [clause.operator]: [{ var: clause.factPath.trim() }, compileClauseRightOperand(clause)]
  }));
  if (compiled.length === 1) return compiled[0];
  return { [projection.combinator]: compiled };
}

function parseSingleClause(node: unknown, allowCoalesceFallback = false): DecisionTableClause | null {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  const entries = Object.entries(node as JsonObject);
  if (entries.length !== 1) return null;
  const [rawOp, rawArgs] = entries[0];
  if (!comparisonOperators.has(rawOp as DecisionComparisonOperator) || !Array.isArray(rawArgs) || rawArgs.length !== 2) {
    return null;
  }
  const operator = rawOp as DecisionComparisonOperator;
  const factPath = extractClauseVarPath(rawArgs[0], allowCoalesceFallback);
  if (!factPath) return null;
  const right = rawArgs[1];
  const rightVar = extractClauseVarPath(right, allowCoalesceFallback);
  if (rightVar) {
    return { factPath, operator, rawValue: rightVar, valueKind: 'var' };
  }
  if (typeof right === 'number' && Number.isFinite(right)) {
    return { factPath, operator, rawValue: String(right), valueKind: 'number' };
  }
  if (typeof right === 'boolean') {
    return { factPath, operator, rawValue: String(right), valueKind: 'boolean' };
  }
  if (Array.isArray(right)) {
    return {
      factPath,
      operator,
      rawValue: right.map(item => String(item ?? '')).join(', '),
      valueKind: 'array'
    };
  }
  if (typeof right === 'string') {
    return { factPath, operator, rawValue: right, valueKind: 'string' };
  }
  return null;
}

function extractClauseVarPath(node: unknown, allowCoalesceFallback = false): string | null {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  const record = node as JsonObject;
  if (typeof record['var'] === 'string' && record['var'].trim()) {
    return record['var'].trim();
  }
  if (allowCoalesceFallback && Array.isArray(record['coalesce']) && record['coalesce'].length > 0) {
    return extractClauseVarPath(record['coalesce'][0], true);
  }
  return null;
}

function compileClauseRightOperand(clause: DecisionTableClause): unknown {
  const trimmed = clause.rawValue.trim();
  if (clause.operator === 'in' || clause.valueKind === 'array') {
    return trimmed
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }
  if (clause.valueKind === 'var') {
    return { var: trimmed };
  }
  if (clause.valueKind === 'boolean') {
    return trimmed.toLowerCase() === 'true';
  }
  if (clause.valueKind === 'number') {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (['<=', '<', '>=', '>'].includes(clause.operator) && trimmed !== '' && Number.isFinite(Number(trimmed))) {
    return Number(trimmed);
  }
  return trimmed;
}

function nullGuardedDisjunction(value: unknown): readonly unknown[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as JsonObject);
  if (entries.length !== 1 || entries[0][0] !== 'or' || !Array.isArray(entries[0][1])) return null;
  const branches = entries[0][1] as readonly unknown[];
  if (branches.length < 2 || !branches.slice(0, -1).every(isExplicitNullGuard)) return null;
  return branches;
}

function isExplicitNullGuard(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as JsonObject;
  const strictEq = record['==='];
  const looseEq = record['=='];
  const equality = Array.isArray(strictEq) ? strictEq : Array.isArray(looseEq) ? looseEq : null;
  if (!equality || equality.length !== 2 || equality[1] !== null) return false;
  const left = equality[0];
  if (!left || typeof left !== 'object' || Array.isArray(left)) return false;
  const leftObj = left as JsonObject;
  if (Array.isArray(leftObj['coalesce']) && leftObj['coalesce'].length > 0) {
    return true;
  }
  return Array.isArray(looseEq) && typeof leftObj['var'] === 'string' && leftObj['var'].trim().length > 0;
}

function visit(value: unknown, consumer: (candidate: unknown) => void): void {
  consumer(value);
  if (Array.isArray(value)) value.forEach(item => visit(item, consumer));
  else if (value && typeof value === 'object') Object.values(value as JsonObject).forEach(item => visit(item, consumer));
}
