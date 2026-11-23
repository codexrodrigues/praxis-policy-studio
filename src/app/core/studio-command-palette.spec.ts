import { describe, expect, it } from 'vitest';
import type { DecisionSummary } from '../features/catalog/catalog.fixture';
import {
  buildCommandPaletteResults,
  type CommandPaletteLabels
} from './studio-command-palette';

const LABELS: CommandPaletteLabels = {
  openPortfolioTitle: 'Abrir Visão geral do catálogo',
  openPortfolioSubtitle: 'Mapa executivo com domínios, KPIs e tipos',
  openReviewsTitle: 'Abrir Fila de Revisão 4-Olhos',
  openReviewsSubtitle: 'Rascunhos, revisões independentes e promoções',
  toggleDepthTitle: 'Alternar para Modo Técnico',
  toggleDepthSubtitle: 'Atalho: Shift+D',
  openAccessTitle: 'Ir para Acesso & Privacidade (OPA)',
  openAccessSubtitle: 'Políticas de autorização e mascaramento deste recurso',
  openAiTitle: 'Abrir Assistente IA no inspetor',
  openAiSubtitle: 'Explicação e busca semântica somente leitura',
  toggleThemeTitle: 'Mudar para tema escuro',
  navUnderstandTitle: 'Ir para aba 01 Entender',
  navRuleTitle: 'Ir para aba 02 Regra',
  navTestTitle: 'Ir para aba 03 Testar',
  navOperateTitle: 'Ir para aba 04 Operar',
  navHistoryTitle: 'Ir para aba 05 Histórico',
  domainScopeSubtitle: 'Área de negócio',
  functionalityScopeSubtitle: 'Funcionalidade',
  rulesCountSuffix: 'regras',
  ruleSingularSuffix: 'regra'
};

function makeDecision(index: number, overrides: Partial<DecisionSummary> = {}): DecisionSummary {
  return {
    order: index,
    totalDecisions: 1006,
    key: `workforce.rule.${index}`,
    code: `WF-${index}`,
    name: `Regra ${index}`,
    domain: index % 2 === 0 ? 'human-resources.vacations' : 'human-resources.attendance',
    ruleSet: index % 2 === 0 ? 'Férias · Concessão' : 'Frequências · Lançamento',
    ruleSetKey: index % 2 === 0 ? 'human-resources.vacations.grant' : 'human-resources.attendance.launch',
    resourceKey: 'human-resources.attendance',
    serviceKey: 'attendance-service',
    state: 'verified',
    meaning: `Descrição ${index}`,
    authority: 'CONFIG_AUTHORITATIVE',
    baselineAuthority: 'LEGACY_RECOVERED',
    source: 'config',
    evidenceCount: 1,
    authoringSupported: true,
    availableDefinitionActions: [],
    expression: null,
    condition: null,
    factPaths: [],
    facts: [],
    nullSemantics: 'FAIL_CLOSED',
    operationKeys: ['CREATE'],
    hostContractVersion: '1.0',
    evidence: [],
    draftLifecycle: null,
    ...overrides
  };
}

describe('studio-command-palette', () => {
  it('returns capped contextual actions, domains, and decisions on empty query and hides nav-test without workspace', () => {
    const selected = makeDecision(1, { name: 'Janela retroativa' });
    const results = buildCommandPaletteResults({
      query: '',
      decisions: [selected, makeDecision(2)],
      selected,
      viewDepth: 'business',
      locale: 'pt-BR',
      isRemoteMode: true,
      hasWorkspace: false,
      labels: LABELS
    });

    const actions = results.filter(item => item.kind === 'action');
    const scopes = results.filter(item => item.kind === 'scope');
    const decisions = results.filter(item => item.kind === 'decision');

    expect(actions.length).toBe(5);
    expect(scopes.length).toBe(2);
    expect(decisions.length).toBe(2);

    const navQueryResults = buildCommandPaletteResults({
      query: 'Testar',
      decisions: [selected, makeDecision(2)],
      selected,
      viewDepth: 'business',
      locale: 'pt-BR',
      isRemoteMode: true,
      hasWorkspace: false,
      labels: LABELS
    });
    expect(navQueryResults.some(item => item.kind === 'action' && item.actionId === 'nav-test')).toBe(false);
  });

  it('matches accented Portuguese terms and codes quickly across 1,000+ decisions', () => {
    const corpus = [
      ...Array.from({ length: 1005 }, (_, idx) => makeDecision(idx + 1)),
      makeDecision(1006, {
        code: 'WF-0999',
        key: 'human-resources.vacations.max-split',
        name: 'Parcelamento de férias em três períodos'
      })
    ];

    const byAccentlessTerm = buildCommandPaletteResults({
      query: 'ferias',
      decisions: corpus,
      selected: corpus[0],
      viewDepth: 'business',
      locale: 'pt-BR',
      isRemoteMode: false,
      hasWorkspace: true,
      labels: LABELS
    });

    expect(byAccentlessTerm.some(item => item.kind === 'scope' && item.scopeKey === 'human-resources.vacations.grant')).toBe(
      true
    );
    expect(
      byAccentlessTerm.some(item => item.kind === 'decision' && item.decision.key === 'human-resources.vacations.max-split')
    ).toBe(true);
    expect(byAccentlessTerm.filter(item => item.kind === 'decision').length).toBeLessThanOrEqual(12);

    const byCode = buildCommandPaletteResults({
      query: 'WF-0999',
      decisions: corpus,
      selected: corpus[0],
      viewDepth: 'technical',
      locale: 'pt-BR',
      isRemoteMode: false,
      hasWorkspace: true,
      labels: LABELS
    });
    expect(byCode[0]).toMatchObject({
      kind: 'decision',
      badge: 'WF-0999'
    });
  });
});
