import { describe, expect, it } from 'vitest';
import { POLICY_STUDIO_COPY, PolicyStudioI18n, type CopyKey } from './i18n';

function extractPlaceholders(value: string): readonly string[] {
  return [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(match => match[1]!).sort();
}

describe('PolicyStudioI18n', () => {
  it('keeps complete key and placeholder parity between pt-BR and en-US', () => {
    const ptKeys = Object.keys(POLICY_STUDIO_COPY['pt-BR']).sort();
    const enKeys = Object.keys(POLICY_STUDIO_COPY['en-US']).sort();

    expect(ptKeys).toEqual(enKeys);

    for (const key of ptKeys as CopyKey[]) {
      const ptValue = POLICY_STUDIO_COPY['pt-BR'][key];
      const enValue = POLICY_STUDIO_COPY['en-US'][key];
      expect(ptValue.trim().length, `Missing pt-BR text for ${key}`).toBeGreaterThan(0);
      expect(enValue.trim().length, `Missing en-US text for ${key}`).toBeGreaterThan(0);
      expect(
        extractPlaceholders(ptValue),
        `Placeholder mismatch for key "${key}"`
      ).toEqual(extractPlaceholders(enValue));
    }
  });

  it('formats interpolated placeholders safely across locales', () => {
    const i18n = new PolicyStudioI18n();
    expect(i18n.format('explorerAllScopes', { count: 12 })).toContain('12');

    i18n.locale.set('en-US');
    expect(i18n.format('explorerAllScopes', { count: 12 })).toContain('12');
  });

  it('avoids raw EXACT/TARGET jargon in releaseNoApproved empty-state messages', () => {
    expect(POLICY_STUDIO_COPY['pt-BR'].releaseNoApproved).not.toContain('EXACT/TARGET');
    expect(POLICY_STUDIO_COPY['en-US'].releaseNoApproved).not.toContain('EXACT/TARGET');
  });
});
