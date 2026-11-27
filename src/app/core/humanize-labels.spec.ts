import { describe, expect, it } from 'vitest';
import {
  humanizeDecisionTitle,
  humanizeRuleType,
  humanizeTechnicalSlug,
  localizeGenericUnit,
  looksLikeTechnicalSlug,
  stripLeadingDecisionCode
} from './humanize-labels';

describe('humanize-labels', () => {
  it('detects and humanizes dot, kebab, snake, and camelCase technical identifiers cleanly', () => {
    expect(looksLikeTechnicalSlug('workforce.attendance.launch')).toBe(true);
    expect(looksLikeTechnicalSlug('Regra clara de negócio')).toBe(false);

    expect(humanizeTechnicalSlug('human-resources.workforce-scheduling', undefined, 'en-US')).toBe(
      'Human Resources · Workforce Scheduling'
    );
    expect(humanizeTechnicalSlug('administracao-pessoal.frequencias', undefined, 'pt-BR')).toBe(
      'Administração Pessoal · Frequências'
    );
    expect(humanizeTechnicalSlug('administracao-pessoal.frequencias', undefined, 'en-US')).toBe(
      'Administracao Pessoal · Frequencias'
    );
    expect(humanizeTechnicalSlug('workforce.attendance.shift_launch.day_limit', 2, 'en-US')).toBe(
      'Shift Launch · Day Limit'
    );
    expect(humanizeTechnicalSlug('tipoFrequencia')).toBe('Tipo Frequência');
    expect(humanizeTechnicalSlug('api_cpf_check')).toBe('API CPF Check');
    expect(humanizeTechnicalSlug('diasDecorridosAnaliseTce', undefined, 'pt-BR')).toBe(
      'Dias Decorridos Análise TCE'
    );
    expect(humanizeTechnicalSlug('idadeNoObitoValidoInss', undefined, 'pt-BR')).toBe(
      'Idade no Óbito Válido INSS'
    );
    expect(humanizeTechnicalSlug('operation', undefined, 'pt-BR')).toBe('Operação');
    expect(humanizeTechnicalSlug('operation', undefined, 'en-US')).toBe('Operation');
    expect(humanizeTechnicalSlug('registroConcomitanteCount', undefined, 'pt-BR')).toBe(
      'Registro Concomitante (Quantidade)'
    );
    expect(humanizeTechnicalSlug('registroConcomitanteCount', undefined, 'en-US')).toBe(
      'Registro Concomitante Count'
    );
  });

  it('strips leading rule codes when presenting in business mode while preserving full titles', () => {
    expect(
      stripLeadingDecisionCode('WF-102 — Limite de dias por lançamento', 'WF-102')
    ).toBe('Limite de dias por lançamento');

    expect(
      stripLeadingDecisionCode('O valor solicitado deve respeitar o limite do programa.', 'GRANT-01')
    ).toBe('O valor solicitado deve respeitar o limite do programa.');
  });

  it('chooses didactic or humanized title in business lens and preserves raw fidelity in technical lens', () => {
    expect(
      humanizeDecisionTitle(
        'WF-204 — grant.eligibility-age',
        'WF-204',
        'Idade mínima para elegibilidade do programa',
        'business'
      )
    ).toBe('Idade mínima para elegibilidade do programa');

    expect(
      humanizeDecisionTitle('WF-204: grant.eligibility-age', 'WF-204', null, 'business')
    ).toBe('Grant · Eligibility Age');

    expect(
      humanizeDecisionTitle(
        'O valor solicitado deve respeitar o limite do programa.',
        'GRANT-01',
        'Teto financeiro alternativo',
        'business'
      )
    ).toBe('Teto financeiro alternativo');

    expect(
      humanizeDecisionTitle(
        'O valor solicitado deve respeitar o limite do programa.',
        'GRANT-01',
        null,
        'business'
      )
    ).toBe('O valor solicitado deve respeitar o limite do programa.');

    expect(
      humanizeDecisionTitle('WF-204: grant.eligibility-age', 'WF-204', 'Título didático', 'technical')
    ).toBe('WF-204: grant.eligibility-age');
  });

  it('localizes generic time and percentage units without altering unknown identifiers', () => {
    expect(localizeGenericUnit('days', 'pt-BR')).toBe('dias');
    expect(localizeGenericUnit(' DAY ', 'pt-BR')).toBe('dia');
    expect(localizeGenericUnit('months', 'pt-BR')).toBe('meses');
    expect(localizeGenericUnit('business_days', 'pt-BR')).toBe('dias úteis');
    expect(localizeGenericUnit('percentage', 'pt-BR')).toBe('%');
    expect(localizeGenericUnit('days', 'en-US')).toBe('days');
    expect(localizeGenericUnit('business_days', 'en-US')).toBe('business days');
    expect(localizeGenericUnit('BRL', 'pt-BR')).toBe('BRL');
    expect(localizeGenericUnit('   ', 'pt-BR')).toBe('');
  });

  it('humanizes canonical catalog ruleType identifiers in pt-BR and en-US with clean fallback', () => {
    expect(humanizeRuleType('validation', 'pt-BR')).toBe('Validação');
    expect(humanizeRuleType('approval_policy', 'pt-BR')).toBe('Aprovação');
    expect(humanizeRuleType('workflow_action_policy', 'en-US')).toBe('Workflow action');
    expect(humanizeRuleType('selection_eligibility', 'pt-BR')).toBe('Elegibilidade');
    expect(humanizeRuleType('custom_audit_rule', 'pt-BR')).toBe('Custom Audit Rule');
    expect(humanizeRuleType(null, 'en-US')).toBe('Other type');
  });

  it('applies Portuguese accents cleanly on domain slugs with declaracoes, retencao, previdenciarias, parametros, and nomeacoes', () => {
    expect(humanizeTechnicalSlug('declaracoes.retencao_guarda_arquivistica', undefined, 'pt-BR'))
      .toBe('Declarações · Retenção Guarda Arquivística');
    expect(humanizeTechnicalSlug('beneficios.previdenciarias_nomeacoes.parametros', undefined, 'pt-BR'))
      .toBe('Benefícios · Previdenciárias Nomeações · Parâmetros');
  });
});
