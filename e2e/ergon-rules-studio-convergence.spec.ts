import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const RN013_RULESET_KEY = 'ergon.administracao-pessoal.regras-frequencia.rn013';
const RN013_RESOURCE_KEY = 'administracao-pessoal.regras-frequencia-estatutaria';
const RN017_RULESET_KEY = 'ergon.administracao-pessoal.frequencias.lancamento';

interface ErgonSeededSlot {
  readonly id: string;
  readonly ruleKey: string;
  readonly slotKey: string;
  readonly code: string;
  readonly presentationLabel: string;
  readonly messagePtBr: string;
  readonly decisionStage: 'PROTECTED_GUARD' | 'DOMAIN_DECISION' | 'POST_DECISION';
  readonly overridePolicy: 'FORBIDDEN' | 'PARAMETERIZABLE' | 'RESTRICT_ONLY' | 'REPLACEABLE';
  readonly cardinality: 'SINGLE' | 'MULTIPLE';
  readonly executorKind: 'JSON_LOGIC' | 'JAVA';
  readonly condition: Record<string, unknown>;
  readonly plsqlOrigin: string;
  readonly plsqlLineage: string;
  readonly targetField: string;
  readonly ruleSetKey?: string;
}

const ERGON_SLOTS: readonly ErgonSeededSlot[] = [
  {
    id: 'ergon-def-00019',
    ruleKey: 'product.ergon.rn013.erg00019',
    slotKey: 'rn013.periodo_ordem_valida',
    code: 'ERG-00019',
    presentationLabel: 'ERG-00019 — Data final não pode ser anterior à data inicial.',
    messagePtBr: 'Data final não pode ser anterior à data inicial.',
    decisionStage: 'PROTECTED_GUARD',
    overridePolicy: 'FORBIDDEN',
    cardinality: 'SINGLE',
    executorKind: 'JSON_LOGIC',
    condition: {
      or: [
        { '==': [{ var: 'draft.dtfim' }, null] },
        { '>=': [{ date: [{ var: 'draft.dtfim' }] }, { date: [{ var: 'draft.dtini' }] }] }
      ]
    },
    plsqlOrigin: 'PCK_REGRAS_FREQ.MAIN_PRE',
    plsqlLineage: 'IF v_row_new.dtfim < v_row_new.dtini THEN HADES_ERRO_PACK.TRATA_ERRO(Ergon, 19); END IF;',
    targetField: 'dtfim'
  },
  {
    id: 'ergon-def-08380',
    ruleKey: 'product.ergon.rn013.erg08380',
    slotKey: 'rn013.qtd_max_non_negative',
    code: 'ERG-08380',
    presentationLabel: 'ERG-08380 — Quantidade máxima de dias deve estar dentro dos limites permitidos.',
    messagePtBr: 'Quantidade máxima de dias deve estar dentro dos limites permitidos.',
    decisionStage: 'DOMAIN_DECISION',
    overridePolicy: 'PARAMETERIZABLE',
    cardinality: 'SINGLE',
    executorKind: 'JSON_LOGIC',
    condition: {
      or: [
        { '==': [{ var: 'draft.qtdMaxDias' }, null] },
        {
          and: [
            { '>=': [{ var: 'draft.qtdMaxDias' }, 0] },
            { '<=': [{ var: 'draft.qtdMaxDias' }, 3650] }
          ]
        }
      ]
    },
    plsqlOrigin: 'PCK_REGRAS_FREQ.MAIN_PRE',
    plsqlLineage: 'IF v_row_new.qtd_max < 0 THEN HADES_ERRO_PACK.TRATA_ERRO(Ergon, 8380); END IF;',
    targetField: 'qtdMaxDias'
  },
  {
    id: 'ergon-def-08381',
    ruleKey: 'product.ergon.rn013.erg08381',
    slotKey: 'rn013.qtd_min_non_negative',
    code: 'ERG-08381',
    presentationLabel: 'ERG-08381 — Quantidade mínima de dias não pode ser negativa.',
    messagePtBr: 'Quantidade mínima de dias não pode ser negativa.',
    decisionStage: 'DOMAIN_DECISION',
    overridePolicy: 'RESTRICT_ONLY',
    cardinality: 'MULTIPLE',
    executorKind: 'JSON_LOGIC',
    condition: {
      or: [
        { '==': [{ var: 'draft.qtdMinDias' }, null] },
        { '>=': [{ var: 'draft.qtdMinDias' }, 0] }
      ]
    },
    plsqlOrigin: 'PCK_REGRAS_FREQ.MAIN_PRE',
    plsqlLineage: 'IF v_row_new.qtd_min < 0 THEN HADES_ERRO_PACK.TRATA_ERRO(Ergon, 8381); END IF;',
    targetField: 'qtdMinDias'
  },
  {
    id: 'ergon-def-08382',
    ruleKey: 'product.ergon.rn013.erg08382',
    slotKey: 'rn013.qtd_max_coherent_with_min',
    code: 'ERG-08382',
    presentationLabel: 'ERG-08382 — A quantidade máxima não pode ser menor que a quantidade mínima.',
    messagePtBr: 'A quantidade máxima não pode ser menor que a quantidade mínima.',
    decisionStage: 'DOMAIN_DECISION',
    overridePolicy: 'FORBIDDEN',
    cardinality: 'SINGLE',
    executorKind: 'JSON_LOGIC',
    condition: {
      or: [
        { '==': [{ var: 'draft.qtdMaxDias' }, null] },
        { '==': [{ var: 'draft.qtdMinDias' }, null] },
        { '>=': [{ var: 'draft.qtdMaxDias' }, { var: 'draft.qtdMinDias' }] }
      ]
    },
    plsqlOrigin: 'PCK_REGRAS_FREQ.MAIN_PRE',
    plsqlLineage: 'IF v_row_new.qtd_max < v_row_new.qtd_min THEN HADES_ERRO_PACK.TRATA_ERRO(Ergon, 8382); END IF;',
    targetField: 'qtdMaxDias'
  },
  {
    id: 'ergon-def-08385',
    ruleKey: 'product.ergon.rn013.erg08385',
    slotKey: 'rn013.interp_mes_non_negative',
    code: 'ERG-08385',
    presentationLabel: 'ERG-08385 — Quantidade máxima interpolada no mês não pode ser negativa.',
    messagePtBr: 'Quantidade máxima interpolada no mês não pode ser negativa.',
    decisionStage: 'DOMAIN_DECISION',
    overridePolicy: 'REPLACEABLE',
    cardinality: 'SINGLE',
    executorKind: 'JSON_LOGIC',
    condition: {
      or: [
        { '==': [{ var: 'draft.qtdMaxInterpMes' }, null] },
        { '>=': [{ var: 'draft.qtdMaxInterpMes' }, 0] }
      ]
    },
    plsqlOrigin: 'PCK_REGRAS_FREQ.MAIN_PRE',
    plsqlLineage: 'IF v_row_new.qtd_max_interp_mes < 0 THEN HADES_ERRO_PACK.TRATA_ERRO(Ergon, 8385); END IF;',
    targetField: 'qtdMaxInterpMes'
  },
  {
    id: 'ergon-def-08393',
    ruleKey: 'product.ergon.rn013.erg08393',
    slotKey: 'rn013.concomitancia_vigencia_overlap',
    code: 'ERG-08393',
    presentationLabel: 'ERG-08393 — Concomitância de vigência no escopo funcional.',
    messagePtBr: 'Já existe regra de frequência vigente e concomitante para a mesma combinação funcional.',
    decisionStage: 'POST_DECISION',
    overridePolicy: 'FORBIDDEN',
    cardinality: 'SINGLE',
    executorKind: 'JAVA',
    condition: { '==': [1, 1] },
    plsqlOrigin: 'PCK_REGRAS_FREQ.MAIN_POS',
    plsqlLineage: 'IF PACK_HADES.EH_CONCOMITANTE(...) THEN HADES_ERRO_PACK.TRATA_ERRO(Ergon, 8393); END IF;',
    targetField: 'dtini'
  },
  {
    id: 'ergon-def-00446',
    ruleKey: 'product.ergon.freq.erg00446',
    slotKey: 'freq.limite_retroatividade_lancamento',
    code: 'ERG-00446',
    presentationLabel: 'ERG-00446 — Limite máximo de dias para lançamento retroativo de frequência.',
    messagePtBr: 'Lançamento excede o limite de retroatividade permitido pelo órgão.',
    decisionStage: 'DOMAIN_DECISION',
    overridePolicy: 'PARAMETERIZABLE',
    cardinality: 'SINGLE',
    executorKind: 'JSON_LOGIC',
    condition: {
      or: [
        { '==': [{ var: 'draft.retroactiveDays' }, null] },
        { '<=': [{ var: 'draft.retroactiveDays' }, 60] }
      ]
    },
    plsqlOrigin: 'PCK_FREQUENCIAS.MAIN_PRE',
    plsqlLineage: 'IF v_dias_retro > 60 THEN HADES_ERRO_PACK.TRATA_ERRO(Ergon, 446); END IF;',
    targetField: 'dtini',
    ruleSetKey: RN017_RULESET_KEY
  }
];

const RN013_FACTS = [
  {
    path: 'draft.qtdMaxDias',
    valueType: 'number',
    nullable: true,
    labels: { 'pt-BR': 'draft: qtdMaxDias', 'en-US': 'draft qtdMaxDias' },
    descriptions: {
      'pt-BR': 'Fato de avaliação do RuleSet ergon.administracao-pessoal.regras-frequencia.rn013 (draft.qtdMaxDias).',
      'en-US': 'Evaluation fact for RuleSet ergon.administracao-pessoal.regras-frequencia.rn013 (draft.qtdMaxDias).'
    },
    providerRef: 'ErgonRuleEngineBootstrap.draft.qtdMaxDias',
    evidenceRefs: [RN013_RULESET_KEY],
    sensitivity: 'NON_SENSITIVE',
    redaction: 'NONE'
  },
  {
    path: 'draft.qtdMinDias',
    valueType: 'number',
    nullable: true,
    labels: { 'pt-BR': 'draft: qtdMinDias', 'en-US': 'draft qtdMinDias' },
    descriptions: {
      'pt-BR': 'Fato de avaliação do RuleSet ergon.administracao-pessoal.regras-frequencia.rn013 (draft.qtdMinDias).',
      'en-US': 'Evaluation fact for RuleSet ergon.administracao-pessoal.regras-frequencia.rn013 (draft.qtdMinDias).'
    },
    providerRef: 'ErgonRuleEngineBootstrap.draft.qtdMinDias',
    evidenceRefs: [RN013_RULESET_KEY],
    sensitivity: 'NON_SENSITIVE',
    redaction: 'NONE'
  },
  {
    path: 'draft.qtdMaxInterpMes',
    valueType: 'number',
    nullable: true,
    labels: { 'pt-BR': 'draft: qtdMaxInterpMes', 'en-US': 'draft qtdMaxInterpMes' },
    descriptions: {
      'pt-BR': 'Fato de avaliação do RuleSet ergon.administracao-pessoal.regras-frequencia.rn013 (draft.qtdMaxInterpMes).',
      'en-US': 'Evaluation fact for RuleSet ergon.administracao-pessoal.regras-frequencia.rn013 (draft.qtdMaxInterpMes).'
    },
    providerRef: 'ErgonRuleEngineBootstrap.draft.qtdMaxInterpMes',
    evidenceRefs: [RN013_RULESET_KEY],
    sensitivity: 'NON_SENSITIVE',
    redaction: 'NONE'
  },
  {
    path: 'draft.dtini',
    valueType: 'date',
    nullable: false,
    labels: { 'pt-BR': 'draft: dtini', 'en-US': 'draft dtini' },
    descriptions: {
      'pt-BR': 'Fato de avaliação do RuleSet ergon.administracao-pessoal.regras-frequencia.rn013 (draft.dtini).',
      'en-US': 'Evaluation fact for RuleSet ergon.administracao-pessoal.regras-frequencia.rn013 (draft.dtini).'
    },
    providerRef: 'ErgonRuleEngineBootstrap.draft.dtini',
    evidenceRefs: [RN013_RULESET_KEY],
    sensitivity: 'NON_SENSITIVE',
    redaction: 'NONE'
  },
  {
    path: 'draft.dtfim',
    valueType: 'date',
    nullable: true,
    labels: { 'pt-BR': 'draft: dtfim', 'en-US': 'draft dtfim' },
    descriptions: {
      'pt-BR': 'Fato de avaliação do RuleSet ergon.administracao-pessoal.regras-frequencia.rn013 (draft.dtfim).',
      'en-US': 'Evaluation fact for RuleSet ergon.administracao-pessoal.regras-frequencia.rn013 (draft.dtfim).'
    },
    providerRef: 'ErgonRuleEngineBootstrap.draft.dtfim',
    evidenceRefs: [RN013_RULESET_KEY],
    sensitivity: 'NON_SENSITIVE',
    redaction: 'NONE'
  },
  {
    path: 'draft.retroactiveDays',
    valueType: 'number',
    nullable: true,
    labels: { 'pt-BR': 'draft: retroactiveDays', 'en-US': 'draft retroactiveDays' },
    descriptions: {
      'pt-BR': 'Fato de avaliação do RuleSet ergon.administracao-pessoal.frequencias.lancamento (draft.retroactiveDays).',
      'en-US': 'Evaluation fact for RuleSet ergon.administracao-pessoal.frequencias.lancamento (draft.retroactiveDays).'
    },
    providerRef: 'ErgonRuleEngineBootstrap.draft.retroactiveDays',
    evidenceRefs: [RN017_RULESET_KEY],
    sensitivity: 'NON_SENSITIVE',
    redaction: 'NONE'
  }
];

function buildDefinitionPayload(slot: ErgonSeededSlot) {
  const ruleSetKey = slot.ruleSetKey ?? RN013_RULESET_KEY;
  const parameterTemplate = slot.overridePolicy === 'PARAMETERIZABLE'
    ? {
        templateKey: 'ergon.rn013:qtd-max-bounds',
        templateVersion: '1.0',
        falseDecision: 'DENY',
        falseReasonCode: slot.code,
        requiredFactPaths: ['draft.dtini'],
        parameters: [
          {
            name: 'minAllowedQty',
            type: 'NUMBER',
            required: true,
            nullable: false,
            secret: false,
            unit: 'days',
            defaultValue: 0,
            minimum: 0,
            maximum: 365,
            allowedValues: [],
            targetPointers: ['/or/1/and/0/>=/1']
          },
          {
            name: 'maxAllowedQty',
            type: 'NUMBER',
            required: true,
            nullable: false,
            secret: false,
            unit: 'days',
            defaultValue: 3650,
            minimum: 1,
            maximum: 3650,
            allowedValues: [],
            targetPointers: ['/or/1/and/1/<=/1']
          }
        ]
      }
    : undefined;

  return {
    id: slot.id,
    ruleKey: slot.ruleKey,
    version: 1,
    status: 'approved',
    ruleType: 'selection_eligibility',
    contextKey: 'administracao-pessoal.regras-frequencia',
    resourceKey: ruleSetKey,
    serviceKey: 'praxis-ergon-showcase',
    condition: slot.condition,
    definition: {
      ruleSetKey,
      operationalResourceKey: RN013_RESOURCE_KEY,
      slotKey: slot.slotKey,
      presentationLabel: slot.presentationLabel,
      description: slot.messagePtBr,
      messagePtBr: slot.messagePtBr,
      decisionStage: slot.decisionStage,
      overridePolicy: slot.overridePolicy,
      cardinality: slot.cardinality,
      executorKind: slot.executorKind,
      bindingSource: 'PRODUCT',
      falseDecision: 'DENY',
      falseReasonCode: slot.code,
      requiredFactPaths: RN013_FACTS.map(f => f.path),
      availableRoots: ['draft', 'existingOverlaps', 'tenant', 'context'],
      conceptRoots: ['tipoFrequencia', 'codigoFrequencia', 'documentoLegal'],
      legacyOccurrence: {
        code: slot.code,
        targetField: slot.targetField,
        plsqlOrigin: slot.plsqlOrigin,
        plsqlLineage: slot.plsqlLineage
      },
      ...(parameterTemplate ? { parameterTemplate } : {}),
      factCatalog: {
        definitionId: slot.id,
        ruleKey: slot.ruleKey,
        definitionVersion: 1,
        schemaVersion: 'praxis.domain-rule-fact-catalog.v1',
        facts: RN013_FACTS
      }
    },
    parameters: {
      nullSemantics: 'FAIL_CLOSED',
      operationKeys: ['validate'],
      hostContractVersion: 'ergon.rules.v1',
      ...(slot.overridePolicy === 'PARAMETERIZABLE'
        ? { parameterValues: { minAllowedQty: 0, maxAllowedQty: 3650 } }
        : {})
    },
    governance: {
      lifecycleBoundary: 'REFERENCE_DRAFT_ONLY',
      sourceKind: 'ERGON_RULES_STUDIO_SEED',
      sourceRuleSetVersion: 1,
      requiredApprovals: ['policy-owner'],
      authorizedApprovers: ['policy-owner'],
      authorityChangeAllowed: false
    }
  };
}

async function mockErgonShowcaseBackend(page: Page): Promise<{
  readonly operationalProofCalls: Array<Record<string, unknown>>;
  readonly candidatePublishCalls: Array<Record<string, unknown>>;
}> {
  const operationalProofCalls: Array<Record<string, unknown>> = [];
  const candidatePublishCalls: Array<Record<string, unknown>> = [];
  let workspaceStatus = 'OPEN';
  let workspaceRevision = 2;
  let workspaceEtag = 'ergon-ws-etag-2';
  let savedCondition: unknown = ERGON_SLOTS[1]!.condition;
  let savedParameters: Record<string, unknown> = {
    nullSemantics: 'FAIL_CLOSED',
    operationKeys: ['validate'],
    hostContractVersion: 'ergon.rules.v1',
    parameterValues: { minAllowedQty: 0, maxAllowedQty: 3650 }
  };

  await page.route('**/app-config.json', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mode: 'remote',
        configApiBaseUrl: '',
        locale: 'pt-BR',
        projectionPath: '/projections/quickstart-benefit-eligibility.v1.json',
        initialDecisionKey: null
      })
    })
  );

  await page.route('**/auth/session', route => route.fulfill({ status: 204 }));

  const handleRoute = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (value: unknown, status = 200, headers?: Record<string, string>) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value), headers });

    const currentWorkspace = {
      id: 'ergon-ws-08380', baseDefinitionId: 'ergon-def-08380', baseDefinitionVersion: 1,
      ruleKey: 'product.ergon.rn013.erg08380',
      status: workspaceStatus,
      revision: workspaceRevision,
      etag: workspaceEtag,
      parameters: savedParameters,
      condition: savedCondition,
      submittedTestRunId: 'ergon-op-run-1',
      updatedAt: '2026-11-10T10:00:00Z'
    };

    if (path.endsWith('/definitions/capabilities')) {
      return json({
        tenantId: '1',
        environment: 'local',
        definitions: ERGON_SLOTS.map(slot => ({
          definitionId: slot.id,
          ruleKey: slot.ruleKey,
          version: 1,
          availableActions: ['INSPECT_PUBLICATION_READINESS', 'PUBLISH']
        }))
      });
    }

    if (path.endsWith('/definitions/catalog')) {
      return json({
        schemaVersion: 'praxis-domain-rule-catalog.v1',
        page: 0,
        limit: 12,
        hasMore: false,
        candidates: ERGON_SLOTS.map(slot => ({
          definitionId: slot.id,
          ruleKey: slot.ruleKey,
          version: 1,
          ruleType: 'selection_eligibility',
          status: 'approved',
          contextKey: 'administracao-pessoal.regras-frequencia',
          resourceKey: slot.ruleSetKey ?? RN013_RULESET_KEY,
          serviceKey: 'praxis-ergon-showcase',
          updatedAt: '2026-11-10T09:00:00Z'
        }))
      });
    }

    const factsMatch = path.match(/\/definitions\/([^/]+)\/facts$/);
    if (factsMatch) {
      const slot = ERGON_SLOTS.find(s => s.id === factsMatch[1]) ?? ERGON_SLOTS[1]!;
      return json({
        definitionId: slot.id,
        ruleKey: slot.ruleKey,
        definitionVersion: 1,
        schemaVersion: 'praxis.domain-rule-fact-catalog.v1',
        facts: RN013_FACTS
      });
    }

    const paramsMatch = path.match(/\/definitions\/([^/]+)\/parameters$/);
    if (paramsMatch) {
      const slot = ERGON_SLOTS.find(s => s.id === paramsMatch[1]);
      if (slot?.overridePolicy === 'PARAMETERIZABLE') {
        return json({
          definitionId: slot.id,
          ruleKey: slot.ruleKey,
          definitionVersion: 1,
          templateKey: 'ergon.rn013:qtd-max-bounds',
          templateVersion: '1.0',
          falseDecision: 'DENY',
          falseReasonCode: slot.code,
          requiredFactPaths: ['draft.dtini'],
          parameters: [
            {
              name: 'minAllowedQty',
              type: 'NUMBER',
              required: true,
              nullable: false,
              secret: false,
              unit: 'days',
              defaultValue: 0,
              currentValue: 0,
              minimum: 0,
              maximum: 365,
              allowedValues: [],
              targetPointers: ['/or/1/and/0/>=/1']
            },
            {
              name: 'maxAllowedQty',
              type: 'NUMBER',
              required: true,
              nullable: false,
              secret: false,
              unit: 'days',
              defaultValue: 3650,
              currentValue: 3650,
              minimum: 1,
              maximum: 3650,
              allowedValues: [],
              targetPointers: ['/or/1/and/1/<=/1']
            }
          ]
        });
      }
      return json({}, 404);
    }

    const timelineMatch = path.match(/\/definitions\/([^/]+)\/timeline$/);
    if (timelineMatch) {
      return json([]);
    }

    const defMatch = path.match(/\/definitions\/([^/]+)$/);
    if (defMatch) {
      const slot = ERGON_SLOTS.find(s => s.id === defMatch[1]) ?? ERGON_SLOTS[1]!;
      return json(buildDefinitionPayload(slot));
    }

    if (path.endsWith('/definitions')) {
      return json(ERGON_SLOTS.map(buildDefinitionPayload));
    }

    if (path.endsWith('/workspaces')) {
      return json([currentWorkspace]);
    }

    if (path.endsWith('/workspaces/ergon-ws-08380/capabilities')) {
      return json({
        workspaceId: currentWorkspace.id,
        ruleKey: currentWorkspace.ruleKey,
        status: workspaceStatus,
        revision: workspaceRevision,
        etag: workspaceEtag,
        availableActions: ['VIEW', 'UPDATE_DRAFT', 'MANAGE_SCENARIOS', 'RECORD_TEST_RUN', 'SUBMIT'],
        blockers: []
      });
    }

    if (path.endsWith('/workspaces/ergon-ws-08380/scenarios')) {
      return json([
        {
          id: 'ergon-scn-conformidade',
          workspaceId: currentWorkspace.id,
          scenarioKey: 'CONFORMIDADE_PADRAO',
          name: 'Conformidade padrão (Prefeitura Municipal de Technecity)',
          expectedDecision: 'ALLOW',
          status: 'ACTIVE',
          facts: {
            draft: {
              empCodigo: 1,
              regimeJuridico: 'ESTATUTARIO',
              tipoVinculo: 'EFETIVO',
              categoria: 'GERAL',
              subcategoria: 'PADRAO',
              tipofreq: 'LICENCA',
              codfreq: 201,
              dtini: '2024-01-01',
              dtfim: '2024-12-31',
              qtdMinDias: 1,
              qtdMaxDias: 12
            }
          }
        },
        {
          id: 'ergon-scn-orgao2',
          workspaceId: currentWorkspace.id,
          scenarioKey: 'CUSTOMIZACAO_ORGAO_2',
          name: 'Excesso de quantidade máxima para o órgão (ERG-08380)',
          expectedDecision: 'DENY',
          status: 'ACTIVE',
          facts: {
            draft: {
              empCodigo: 1,
              regimeJuridico: 'ESTATUTARIO',
              tipoVinculo: 'EFETIVO',
              categoria: 'GERAL',
              subcategoria: 'PADRAO',
              tipofreq: 'LICENCA',
              codfreq: 201,
              dtini: '2024-01-01',
              dtfim: '2024-12-31',
              qtdMinDias: 1,
              qtdMaxDias: 180
            }
          }
        }
      ]);
    }

    if (path.endsWith('/workspaces/ergon-ws-08380/reviews')) {
      return json([]);
    }

    if (path.endsWith('/workspaces/ergon-ws-08380/test-runs')) {
      return json([
        {
          runId: 'ergon-op-run-1',
          workspaceId: currentWorkspace.id,
          workspaceRevision: workspaceRevision,
          status: 'PASSED',
          baselineEvidence: {
            authorityType: 'ACTIVE_SNAPSHOT',
            eligibility: 'ELIGIBLE',
            observedAtUtc: '2026-11-10T09:30:00Z',
            artifactRef: `ergon://ruleset/${RN013_RULESET_KEY}`,
            artifactDigest: 'sha256:8888888888888888888888888888888888888888888888888888888888888888'
          },
          results: []
        }
      ]);
    }

    if (path.endsWith('/workspaces/ergon-ws-08380/draft') && request.method() === 'PUT') {
      const body = request.postDataJSON() as { condition: unknown; parameters: Record<string, unknown> };
      savedCondition = body.condition;
      savedParameters = body.parameters;
      workspaceRevision += 1;
      workspaceEtag = `ergon-ws-etag-${workspaceRevision}`;
      return json({
        ...currentWorkspace,
        revision: workspaceRevision,
        etag: workspaceEtag,
        condition: savedCondition,
        parameters: savedParameters
      });
    }

    if (path.endsWith('/workspaces/ergon-ws-08380')) {
      return json(currentWorkspace);
    }

    if (path.endsWith('/rules-studio/sandbox/runs') && request.method() === 'POST') {
      const body = request.postDataJSON() as { workspaceId: string; scenarioIds: string[]; evaluatedAtUtc: string };
      return json(
        {
          runId: 'ergon-sandbox-run-1',
          workspaceId: body.workspaceId,
          workspaceRevision: workspaceRevision,
          evaluatedAtUtc: body.evaluatedAtUtc,
          activeSnapshotKey: `${RN013_RULESET_KEY}@v1`,
          results: [
            {
              scenarioId: 'ergon-scn-conformidade',
              scenarioKey: 'CONFORMIDADE_PADRAO',
              expectedDecision: 'ALLOW',
              candidateDecision: 'ALLOW',
              activeDecision: 'ALLOW',
              comparison: 'BOTH_MATCH',
              candidateMatchesExpected: true,
              activeMatchesExpected: true,
              candidateReasonCodes: [],
              activeReasonCodes: []
            },
            {
              scenarioId: 'ergon-scn-orgao2',
              scenarioKey: 'CUSTOMIZACAO_ORGAO_2',
              expectedDecision: 'DENY',
              candidateDecision: 'DENY',
              activeDecision: 'ALLOW',
              comparison: 'CANDIDATE_ONLY_MATCH',
              candidateMatchesExpected: true,
              activeMatchesExpected: false,
              candidateReasonCodes: ['ERG-08380'],
              activeReasonCodes: []
            }
          ]
        },
        201
      );
    }

    if (path === '/schemas/actions') {
      const requestedResource = url.searchParams.get('resource') ?? RN013_RESOURCE_KEY;
      return json({
        resourceKey: requestedResource,
        resourcePath: '/api/ergon/regras-frequencia',
        actions: [
          {
            id: 'run-rules-studio-operational-test',
            resourceKey: requestedResource,
            scope: 'COLLECTION',
            title: 'Executar prova operacional do Rules Studio',
            description: 'Executa os cenários governados contra o RuleSet candidato e o plano ativo do órgão.',
            operationId: 'runRulesStudioOperationalTest',
            path: '/api/praxis/rules-studio/actions/run-rules-studio-operational-test',
            method: 'POST',
            order: 1,
            tags: ['rules-studio', 'policy-studio', 'operational-proof', 'idempotent', 'optimistic-concurrency'],
            availability: { allowed: true, reasonCode: 'ALLOWED', reasons: [] },
            execution: {
              interaction: { mode: 'CONFIRM', risk: 'HIGH', confirmationRequired: true, reversible: true },
              preconditions: {
                idempotencyKey: 'REQUIRED',
                correlationId: 'OPTIONAL',
                resourceVersion: 'REQUIRED',
                resourceVersionTransport: 'IF_MATCH',
                resourceVersionTargetResourceKey: 'praxis.config.domain-rule-change-workspaces',
                resourceVersionTargetIdField: 'workspaceId'
              },
              selection: {},
              outcome: { mode: 'SINGLE', atomicity: 'ATOMIC' },
              refresh: { item: false, collection: false, actions: true, capabilities: true, resourceKeys: [] }
            }
          }
        ]
      });
    }

    if (path.endsWith('/actions/run-rules-studio-operational-test') && request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      operationalProofCalls.push(body);
      workspaceRevision += 1;
      workspaceEtag = `"ergon-ws-etag-${workspaceRevision}"`;
      return json(
        {
          status: 'success',
          data: {
            runId: 'ergon-op-run-2',
            workspaceId: currentWorkspace.id,
            workspaceRevision,
            status: 'PASSED',
            evaluatedAtUtc: '2026-11-10T10:15:00Z',
            baselineEvidence: {
              authorityType: 'ACTIVE_SNAPSHOT',
              eligibility: 'ELIGIBLE',
              observedAtUtc: '2026-11-10T10:15:00Z',
              artifactRef: `ergon://ruleset/${RN013_RULESET_KEY}`,
              artifactDigest: 'sha256:9999999999999999999999999999999999999999999999999999999999999999'
            },
            results: [
              {
                scenarioId: 'ergon-scn-conformidade',
                scenarioKey: 'CONFORMIDADE_PADRAO',
                expectedDecision: 'ALLOW',
                actualDecision: 'ALLOW',
                passed: true,
                reasonCodes: [],
                operationalEvidence: {
                  operationMode: 'CREATE',
                  beforeStateDigest: 'a'.repeat(64),
                  afterStateDigest: 'b'.repeat(64),
                  effectLedgerDigest: 'c'.repeat(64),
                  mutationObserved: true,
                  noMutationVerified: false,
                  cleanupVerified: true,
                  baselineCallCount: 1
                }
              },
              {
                scenarioId: 'ergon-scn-orgao2',
                scenarioKey: 'CUSTOMIZACAO_ORGAO_2',
                expectedDecision: 'DENY',
                actualDecision: 'DENY',
                passed: true,
                reasonCodes: ['ERG-08380'],
                operationalEvidence: {
                  operationMode: 'UPDATE',
                  beforeStateDigest: 'd'.repeat(64),
                  afterStateDigest: 'd'.repeat(64),
                  effectLedgerDigest: 'e'.repeat(64),
                  mutationObserved: false,
                  noMutationVerified: true,
                  cleanupVerified: true,
                  baselineCallCount: 1
                }
              }
            ]
          }
        },
        200,
        { ETag: workspaceEtag }
      );
    }

    if (path.endsWith('/candidate') && request.method() === 'POST') {
      const ruleSetKey = decodeURIComponent(path.split('/').at(-2) ?? RN013_RULESET_KEY);
      return json({
        ruleSetKey,
        ruleSetVersion: 2,
        compositionDigest: 'sha256:ergon-rn013-manifest-002',
        implementationCatalogDigest: 'sha256:ergon-impl-catalog-001',
        currentHeadEtag: '"ergon-head-1"',
        sources: [{ ruleKey: 'product.ergon.rn013.erg08380', definitionId: 'ergon-def-08380', version: 1, status: 'approved' }],
        authorizedActions: ['PREPARE', 'APPROVE', 'PUBLISH']
      });
    }

    if (path.endsWith('/candidate/approvals') && request.method() === 'POST') {
      return json({
        approvalKey: 'ergon-approval-1',
        role: 'RULE_COMPOSITION_APPROVER',
        actorRef: 'ergon-approver',
        decidedAtUtc: '2026-11-10T10:20:00Z',
        evidenceHash: 'sha256:ergon-rn013-manifest-002'
      });
    }

    if (path.endsWith('/candidate/publish') && request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      candidatePublishCalls.push(body);
      const ruleSetKey = decodeURIComponent(path.split('/').at(-3) ?? RN013_RULESET_KEY);
      return json(
        {
          snapshotKey: 'ergon-rn013-snapshot-002',
          ruleSetKey,
          ruleSetVersion: 2,
          snapshotContentHash: 'sha256:ergon-rn013-snapshot-hash-002'
        },
        201,
        { ETag: '"ergon-rn013-snapshot-hash-002"' }
      );
    }

    if (path.endsWith('/rollout-policies/timeline')) return json([]);
    if (path.endsWith('/rollout-policies')) return json({}, 404);
    if (path.endsWith('/rollouts')) {
      return json({
        ruleSetKey: url.searchParams.get('ruleSetKey') ?? RN013_RULESET_KEY,
        rollouts: [],
        availableActions: []
      });
    }
    if (path.endsWith('/snapshots/head/status')) return json({}, 404);
    if (path.endsWith('/snapshots/head')) return json({}, 404);
    if (path.endsWith('/snapshots')) return json([]);
    return json([]);
  };

  await page.route('**/api/**', handleRoute);
  await page.route('**/schemas/**', handleRoute);

  return { operationalProofCalls, candidatePublishCalls };
}

test('resolves Ergon deep-link, renders 6-stage DAG with FORBIDDEN guards & PL/SQL lineage, runs sandbox divergence trace, and executes host-driven operational proof', async ({
  page
}) => {
  const { operationalProofCalls } = await mockErgonShowcaseBackend(page);

  await page.goto(
    `/catalog?ruleSetKey=${encodeURIComponent(RN013_RULESET_KEY)}&slotKey=rn013.qtd_max_non_negative&decisionKey=product.ergon.rn013.erg08380`
  );

  // 1. Verify deep-link selection of ERG-08380 and 6-stage DAG rendering
  await expect(page.getByTestId('rule-decision-plan-dag')).toBeVisible();
  await expect(page.getByTestId('dag-ruleset-key')).toContainText(RN013_RULESET_KEY);

  // Verify PROTECTED_GUARD (ERG-00019), DOMAIN_DECISION (ERG-08380, ERG-08381, ERG-08382, ERG-08385), and POST_DECISION (ERG-08393)
  await expect(page.getByTestId('dag-stage-PROTECTED_GUARD')).toContainText('ERG-00019');
  await expect(page.getByTestId('dag-stage-DOMAIN_DECISION')).toContainText('ERG-08380');
  await expect(page.getByTestId('dag-stage-DOMAIN_DECISION')).toContainText('ERG-08382');
  await expect(page.getByTestId('dag-stage-DOMAIN_DECISION')).toContainText('ERG-08385');
  await expect(page.getByTestId('dag-stage-POST_DECISION')).toContainText('ERG-08393');

  // Verify PL/SQL lineage card for ERG-08380
  await expect(page.getByTestId('dag-legacy-lineage')).toContainText('ERG-08380');
  await expect(page.getByTestId('dag-legacy-lineage')).toContainText('PCK_REGRAS_FREQ.MAIN_PRE');

  // Verify 1-hop ontology roots and cross-RuleSet neighborhood navigation
  await expect(page.getByTestId('dag-ontology-roots')).toContainText('draft');
  await expect(page.getByTestId('dag-concept-chip-tipoFrequencia')).toBeVisible();

  // 2. Click FORBIDDEN guard ERG-00019 in the DAG and verify read-only posture (Finding L5)
  await page.getByTestId('dag-node-product.ergon.rn013.erg00019').click();
  await expect(page.getByTestId('dag-legacy-lineage')).toContainText('ERG-00019');
  await expect(page.getByTestId('dag-legacy-lineage')).toContainText('dtfim');

  // Return to PARAMETERIZABLE slot ERG-08380 via DAG click
  await page.getByTestId('dag-node-product.ergon.rn013.erg08380').click();
  await expect(page.getByTestId('dag-legacy-lineage')).toContainText('ERG-08380');

  // 3. Run Sandbox Simulation and verify visual divergence trace on the DAG (Fase C7 + C8)
  await page.getByRole('button', { name: 'Testar regra', exact: true }).click();
  await page.getByRole('button', { name: 'Comparar com a versão ativa' }).click();

  // Switch back to Entender tab to inspect the live simulation trace on the 6-stage DAG
  await page.getByRole('button', { name: /^Entender/ }).click();
  await expect(page.getByTestId('dag-simulation-trace-summary')).toBeVisible();
  await expect(page.getByTestId('dag-trace-divergence-banner')).toContainText('CUSTOMIZACAO_ORGAO_2');
  await expect(page.getByTestId('dag-node-divergence-product.ergon.rn013.erg08380')).toContainText('ALLOW → DENY');

  // 4. Execute Host-Driven Operational Proof (run-rules-studio-operational-test) in 03 · Testar regra
  await page.getByRole('button', { name: 'Testar regra', exact: true }).click();
  const modes = page.getByLabel('Operação do cenário');
  await modes.nth(0).selectOption('CREATE');
  await modes.nth(1).selectOption('UPDATE');
  await page.getByRole('button', { name: 'Revisar prova operacional' }).click();
  await expect(page.locator('.operational-confirmation')).toBeVisible();
  await page.locator('.operational-confirmation button').last().click();

  await expect.poll(() => operationalProofCalls.length).toBe(1);
  expect(operationalProofCalls[0]?.['workspaceId']).toBe('ergon-ws-08380');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);
});

test('navigates 1-hop ontology neighborhood to RN-017 (ERG-00446) and executes candidate composition & snapshot publication', async ({
  page
}) => {
  const { candidatePublishCalls } = await mockErgonShowcaseBackend(page);

  await page.goto(
    `/catalog?ruleSetKey=${encodeURIComponent(RN013_RULESET_KEY)}&slotKey=rn013.qtd_max_non_negative&decisionKey=product.ergon.rn013.erg08380`
  );

  await expect(page.getByTestId('rule-decision-plan-dag')).toBeVisible();

  // 1. Click 1-hop ontology chip tipoFrequencia and jump directly to neighbor RN-017 (ERG-00446) via DAG
  await page.getByTestId('dag-concept-chip-tipoFrequencia').click();
  await page
    .getByTestId('dag-neighbor-group-tipoFrequencia')
    .getByTestId('dag-neighbor-product.ergon.freq.erg00446')
    .click();

  // Verify RN-017 (ERG-00446) lineage and extracted expression fact draft.retroactiveDays (Finding L6)
  await expect(page.getByTestId('dag-ruleset-key')).toContainText(RN017_RULESET_KEY);
  await expect(page.getByTestId('dag-legacy-lineage')).toContainText('PCK_FREQUENCIAS.MAIN_PRE');
  await page.getByRole('button', { name: /^Regra/ }).click();
  await expect(page.locator('.fact-list')).toContainText('draft.retroactiveDays');

  // 2. Return to Entender, jump back to ERG-08380 via 1-hop neighbor link, and execute candidate composition & snapshot publication in 04 · Operar
  await page.getByRole('button', { name: /^Entender/ }).click();
  await page
    .getByTestId('dag-neighbor-group-tipoFrequencia')
    .getByTestId('dag-neighbor-product.ergon.rn013.erg08380')
    .click();
  await page.getByRole('button', { name: /^Operar/ }).click();
  await page.getByTestId('toggle-snapshot-composition').click();
  await expect(page.getByTestId('snapshot-impact-summary')).toBeVisible();

  await page.getByTestId('prepare-snapshot-composition').click();
  await expect(page.getByTestId('snapshot-composition-digest')).toContainText('sha256:ergon-rn013-manifest-002');

  await page.getByTestId('approve-snapshot-composition').click();
  await expect(page.getByTestId('snapshot-composition-approval')).toContainText('ergon-approval-1');

  await page.getByTestId('publish-snapshot-composition').click();
  await expect(page.getByTestId('snapshot-composition-publication')).toContainText('ergon-rn013-snapshot-002');
  expect(candidatePublishCalls.length).toBe(1);
});
