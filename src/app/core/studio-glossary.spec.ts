import { describe, expect, it } from 'vitest';
import { resolveGovernanceGlossaryEntry, resolvePolicyGlossaryEntry, resolveStatusGlossaryEntry } from './studio-glossary';

describe('studio-glossary', () => {
  it('resolves canonical SlotOverridePolicyId values in pt-BR and en-US', () => {
    expect(resolvePolicyGlossaryEntry('PARAMETERIZABLE', 'pt-BR').title).toBe('Parametrizável');
    expect(resolvePolicyGlossaryEntry('PARAMETERIZABLE', 'en-US').title).toBe('Parameterizable');

    expect(resolvePolicyGlossaryEntry('REPLACEABLE', 'pt-BR').title).toBe('Customizável pelo cliente');
    expect(resolvePolicyGlossaryEntry('RESTRICT_ONLY', 'pt-BR').title).toBe('Customizável pelo cliente');
    expect(resolvePolicyGlossaryEntry('EXTEND_ONLY', 'en-US').title).toBe('Customizable rule');

    expect(resolvePolicyGlossaryEntry('LOCKED', 'pt-BR').title).toBe('Regra protegida (fixa)');
    expect(resolvePolicyGlossaryEntry('FORBIDDEN', 'en-US').title).toBe('Protected rule (locked)');
  });

  it('resolves status and governance glossary entries', () => {
    expect(resolveStatusGlossaryEntry('PROMOTED', 'pt-BR').title).toBe('Ativa em produção');
    expect(resolveStatusGlossaryEntry('REJECTED', 'pt-BR').title).toBe('Revisão recusada');
    expect(resolveStatusGlossaryEntry('REJECTED', 'en-US').title).toBe('Review rejected');
    expect(resolveGovernanceGlossaryEntry('fourEyes', 'pt-BR').title).toBe('Revisão 4-olhos');
    expect(resolveGovernanceGlossaryEntry('safeDraft', 'en-US').title).toBe('Safe draft (zero runtime impact)');
  });
});
