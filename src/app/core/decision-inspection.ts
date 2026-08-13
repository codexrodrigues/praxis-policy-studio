type JsonObject = Record<string, unknown>;

const binaryOperators = new Set(['>=', '>', '<=', '<', '===', '==', '!=']);

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

export function formatDecisionExpression(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(item => formatDecisionExpression(item) ?? 'null').join(', ');
  if (typeof value !== 'object') return null;
  const entries = Object.entries(value as JsonObject);
  if (entries.length !== 1) return null;
  const [operator, raw] = entries[0];
  if (operator === 'var' && typeof raw === 'string') return raw.replace(/^regraFrequenciaCommand\./, '');
  if (operator === 'date' && Array.isArray(raw)) return `data(${formatDecisionExpression(raw[0]) ?? '?'})`;
  if (operator === 'coalesce' && Array.isArray(raw)) return `valor(${formatDecisionExpression(raw[0]) ?? '?'})`;
  if ((operator === 'or' || operator === 'and') && Array.isArray(raw)) {
    const joiner = operator === 'or' ? ' OU ' : ' E ';
    return raw.map(item => `(${formatDecisionExpression(item) ?? '?'})`).join(joiner);
  }
  if (binaryOperators.has(operator) && Array.isArray(raw) && raw.length >= 2) {
    const left = formatDecisionExpression(raw[0]) ?? '?';
    const right = raw[1] === null ? 'nulo' : (formatDecisionExpression(raw[1]) ?? '?');
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
