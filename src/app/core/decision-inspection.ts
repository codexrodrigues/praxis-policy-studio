type JsonObject = Record<string, unknown>;

export type DecisionComparisonOperator = '<=' | '<' | '>=' | '>' | '===' | '!==' | '==' | '!=' | 'in';

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

const comparisonOperators = new Set<DecisionComparisonOperator>([
  '>=', '>', '<=', '<', '===', '!==', '==', '!=', 'in'
]);
const binaryOperators = new Set(['>=', '>', '<=', '<', '===', '!==', '==', '!=', 'in', '+', '-', '*', '/']);

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
  factLabels?: Readonly<Record<string, string>> | ReadonlyMap<string, string>
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(item => formatDecisionExpression(item, factLabels) ?? 'null').join(', ');
  if (typeof value !== 'object') return null;
  const entries = Object.entries(value as JsonObject);
  if (entries.length !== 1) return null;
  const [operator, raw] = entries[0];
  if (operator === 'var' && typeof raw === 'string') {
    const path = raw.trim();
    if (!path) return null;
    if (factLabels instanceof Map) return factLabels.get(path) ?? path;
    if (factLabels && typeof factLabels === 'object') {
      return (factLabels as Readonly<Record<string, string>>)[path] ?? path;
    }
    return path;
  }
  if ((operator === '!' || operator === 'not') && raw !== undefined) {
    const operand = Array.isArray(raw) ? raw[0] : raw;
    return `!(${formatDecisionExpression(operand, factLabels) ?? '?'})`;
  }
  if (operator === 'date' && Array.isArray(raw)) return `data(${formatDecisionExpression(raw[0], factLabels) ?? '?'})`;
  if (operator === 'coalesce' && Array.isArray(raw)) return `valor(${formatDecisionExpression(raw[0], factLabels) ?? '?'})`;
  if ((operator === 'or' || operator === 'and') && Array.isArray(raw)) {
    const joiner = operator === 'or' ? ' OU ' : ' E ';
    return raw.map(item => `(${formatDecisionExpression(item, factLabels) ?? '?'})`).join(joiner);
  }
  if (binaryOperators.has(operator) && Array.isArray(raw) && raw.length >= 2) {
    const left = formatDecisionExpression(raw[0], factLabels) ?? '?';
    const right = raw[1] === null ? 'nulo' : (formatDecisionExpression(raw[1], factLabels) ?? '?');
    return `${left} ${operator} ${right}`;
  }
  return null;
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
  const equality = (value as JsonObject)['==='];
  if (!Array.isArray(equality) || equality.length !== 2 || equality[1] !== null) return false;
  const left = equality[0];
  if (!left || typeof left !== 'object' || Array.isArray(left)) return false;
  const coalesce = (left as JsonObject)['coalesce'];
  return Array.isArray(coalesce) && coalesce.length > 0;
}

function visit(value: unknown, consumer: (candidate: unknown) => void): void {
  consumer(value);
  if (Array.isArray(value)) value.forEach(item => visit(item, consumer));
  else if (value && typeof value === 'object') Object.values(value as JsonObject).forEach(item => visit(item, consumer));
}
