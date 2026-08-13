export type DecisionState = 'technical-draft' | 'verified';

export interface DecisionSummary {
  readonly key: string;
  readonly code: string;
  readonly name: string;
  readonly domain: string;
  readonly ruleSet: string;
  readonly state: DecisionState;
  readonly meaning: string;
  readonly authority: string;
  readonly source: string;
  readonly evidenceCount: number;
}

export const DECISION_FIXTURE: readonly DecisionSummary[] = [
  {
    key: 'workforce.frequency.maximum-quantity.nonnegative',
    code: 'ERG-08380',
    name: 'Quantidade máxima não pode ser negativa',
    domain: 'Frequência e afastamentos',
    ruleSet: 'Validações de frequência',
    state: 'technical-draft',
    meaning: 'Impede que o limite máximo de dias seja informado abaixo de zero.',
    authority: 'Legado autoritativo',
    source: 'Oracle · pck_regras_freq · linhas 131–134',
    evidenceCount: 4
  },
  {
    key: 'regra-frequencia.quantidade-maxima.coerente-com-minima',
    code: 'ERG-08382',
    name: 'Quantidade máxima coerente com a mínima',
    domain: 'Frequência e afastamentos',
    ruleSet: 'Validações de frequência',
    state: 'verified',
    meaning: 'A quantidade máxima de dias deve ser maior ou igual à quantidade mínima.',
    authority: 'Legado autoritativo · POC Java reversível',
    source: 'Oracle · pck_regras_freq · linhas 139–141',
    evidenceCount: 11
  },
  {
    key: 'workforce.frequency.maximum-consecutive-month.limit',
    code: 'ERG-08389',
    name: 'Máximo consecutivo mensal limitado a 31 dias',
    domain: 'Frequência e afastamentos',
    ruleSet: 'Validações de frequência',
    state: 'technical-draft',
    meaning: 'Mantém o limite mensal consecutivo dentro do maior mês civil.',
    authority: 'Legado autoritativo',
    source: 'Oracle · pck_regras_freq · linhas 163–165',
    evidenceCount: 5
  },
  {
    key: 'workforce.frequency.period.end-after-start',
    code: 'ERG-00019',
    name: 'Fim da vigência não pode anteceder o início',
    domain: 'Frequência e afastamentos',
    ruleSet: 'Validações de frequência',
    state: 'verified',
    meaning: 'Quando houver término, a data deve ser igual ou posterior ao início da vigência.',
    authority: 'Legado autoritativo',
    source: 'Oracle · pck_regras_freq · linhas 184–186',
    evidenceCount: 8
  }
];

