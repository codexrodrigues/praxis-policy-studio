export type SemanticDiffKind = 'ADDED' | 'REMOVED' | 'CHANGED';

export interface SemanticDecisionDiff {
  path: string;
  kind: SemanticDiffKind;
  baseline: unknown;
  candidate: unknown;
}

export function semanticDecisionDiff(baseline: unknown, candidate: unknown): readonly SemanticDecisionDiff[] {
  const changes: SemanticDecisionDiff[] = [];
  compare(baseline, candidate, '$', changes);
  return changes;
}

function compare(baseline: unknown, candidate: unknown, path: string, changes: SemanticDecisionDiff[]): void {
  if (canonical(baseline) === canonical(candidate)) return;
  if (isRecord(baseline) && isRecord(candidate)) {
    const keys = [...new Set([...Object.keys(baseline), ...Object.keys(candidate)])].sort();
    for (const key of keys) {
      const nextPath = `${path}.${key}`;
      if (!(key in baseline)) changes.push({ path: nextPath, kind: 'ADDED', baseline: undefined, candidate: candidate[key] });
      else if (!(key in candidate)) changes.push({ path: nextPath, kind: 'REMOVED', baseline: baseline[key], candidate: undefined });
      else compare(baseline[key], candidate[key], nextPath, changes);
    }
    return;
  }
  if (Array.isArray(baseline) && Array.isArray(candidate)) {
    const length = Math.max(baseline.length, candidate.length);
    for (let index = 0; index < length; index += 1) {
      const nextPath = `${path}[${index}]`;
      if (index >= baseline.length) changes.push({ path: nextPath, kind: 'ADDED', baseline: undefined, candidate: candidate[index] });
      else if (index >= candidate.length) changes.push({ path: nextPath, kind: 'REMOVED', baseline: baseline[index], candidate: undefined });
      else compare(baseline[index], candidate[index], nextPath, changes);
    }
    return;
  }
  changes.push({ path, kind: 'CHANGED', baseline, candidate });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function canonical(value: unknown): string {
  if (value === undefined) return '__undefined__';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map(key => `${key}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
