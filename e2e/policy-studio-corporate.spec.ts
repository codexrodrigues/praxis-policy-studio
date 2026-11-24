import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const definition = {
  id: '7b0fca89-cb64-40bf-8eea-d3467083bbf4', ruleKey: 'grant.amount-parameters', version: 1, status: 'approved',
  resourceKey: 'human-resources.extraordinary-benefit-requests',
  serviceKey: 'extraordinary-benefit-request-service',
  condition: { or: [
    { '===': [{ coalesce: [{ var: 'request.requestedAmount' }] }, null] },
    { '<=': [{ var: 'request.requestedAmount' }, 3000] }
  ] },
  parameters: { nullSemantics: 'FAIL_CLOSED', operationKeys: ['CREATE', 'UPDATE'] }
};

const workspace = {
  id: 'workspace-1', ruleKey: definition.ruleKey, status: 'OPEN', revision: 4,
  etag: 'workspace-etag-4', parameters: {}, condition: definition.condition,
  submittedTestRunId: 'test-run-1',
  updatedAt: '2026-08-15T05:00:00Z'
};

interface MockState {
  sequence: number;
  components: Map<string, string>;
  createdScenario: {
    id: string; workspaceId: string; scenarioKey: string; name: string;
    facts: Record<string, unknown>; expectedDecision: string; status: string; etag: string
  } | null;
  savedCondition: unknown | null;
  workspaceStatus: string;
  workspaceRevision: number;
  workspaceEtag: string;
  promotedDefinitionId: string | null;
  reviews: Array<{
    id: string;
    workspaceId: string;
    workspaceRevision: number;
    reviewerRef: string;
    decision: 'APPROVE' | 'REJECT';
    rationale: string;
    reviewedAt: string;
  }>;
}

async function mockGovernedBackend(
  page: Page,
  operationalAllowed: boolean,
  includeOperationalPolicySlot = false
): Promise<void> {
  const authoringStreams: MockState = {
    sequence: 0,
    components: new Map<string, string>(),
    createdScenario: null,
    savedCondition: null,
    workspaceStatus: workspace.status,
    workspaceRevision: workspace.revision,
    workspaceEtag: workspace.etag,
    promotedDefinitionId: null,
    reviews: []
  };
  await page.route('**/app-config.json', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      mode: 'remote',
      configApiBaseUrl: '',
      locale: 'pt-BR',
      projectionPath: '/projections/quickstart-benefit-eligibility.v1.json',
      initialDecisionKey: definition.ruleKey
    })
  }));
  await page.route('**/api/**', async route =>
    governedResponse(route, operationalAllowed, authoringStreams, includeOperationalPolicySlot));
  await page.route('**/schemas/**', async route =>
    governedResponse(route, operationalAllowed, authoringStreams, includeOperationalPolicySlot));
  await page.route('**/auth/session', route => route.fulfill({ status: 204 }));
}

async function governedResponse(
  route: Route,
  operationalAllowed: boolean,
  authoringStreams: MockState,
  includeOperationalPolicySlot = false
): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const activeDefinition = includeOperationalPolicySlot
    ? {
        ...definition,
        parameters: {
          ...definition.parameters,
          operationKeys: ['evaluate-extraordinary-grant'],
          parameterValues: { maxBenefitAmount: 3000 },
          validationPolicy: {
            effect: 'BLOCK',
            message: 'Valor solicitado excede o limite do programa.',
            severity: 'ERROR'
          }
        }
      }
    : definition;
  const baseWorkspace = includeOperationalPolicySlot
    ? { ...workspace, parameters: activeDefinition.parameters }
    : workspace;
  const currentWorkspace = {
    ...baseWorkspace,
    status: authoringStreams.workspaceStatus,
    revision: authoringStreams.workspaceRevision,
    etag: authoringStreams.workspaceEtag,
    promotedDefinitionId: authoringStreams.promotedDefinitionId,
    condition: authoringStreams.savedCondition ?? baseWorkspace.condition
  };
  const json = (value: unknown, status = 200, headers?: Record<string, string>) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value), headers });

  if (path.endsWith('/ai/authoring/turn/stream/start') && request.method() === 'POST') {
    const body = request.postDataJSON() as { targetComponentId?: string };
    const streamId = `policy-stream-${++authoringStreams.sequence}`;
    authoringStreams.components.set(streamId, body.targetComponentId ?? '');
    return json({
      streamId, threadId: 'policy-thread', turnId: `turn-${authoringStreams.sequence}`,
      eventSchemaVersion: 'v1', streamAuthMode: 'cookie',
      expiresAt: '2026-08-17T12:00:00Z', fallbackAuthoringUrl: '/unused'
    });
  }
  if (path.includes('/ai/authoring/turn/stream/') && path.endsWith('/probe')) {
    return route.fulfill({ status: 204 });
  }
  if (path.includes('/ai/authoring/turn/stream/') && request.method() === 'GET') {
    const streamId = path.split('/').at(-1) ?? '';
    const component = authoringStreams.components.get(streamId);
    const payload = (
      component === 'rules-decision-explanation'
      || component === 'policy-decision-explanation'
    )
      ? {
          assistantMessage: 'A decisão limita o valor solicitado ao teto governado e falha fechada quando o valor está ausente.',
          canApply: false,
          evidenceBundle: {
            source: 'inspectDomainDecision',
            domainDecision: {
              schemaVersion: 'praxis-domain-decision-explanation-evidence.v1',
              decisionRef: {
                definitionId: definition.id, ruleKey: definition.ruleKey, version: definition.version,
                definitionHash: 'definition-hash', conditionHash: 'condition-hash'
              },
              conditionEvidence: { exposureMode: 'summary_only' },
              redaction: { mode: 'summary_only' },
              sourceRefs: ['config://definition/1'],
              versionAttestation: { requestedVersion: 1, resolvedVersion: 1, exactMatch: true }
            }
          }
        }
      : {
          assistantMessage: 'Encontrei uma decisão governada candidata no escopo autorizado.',
          canApply: false,
          evidenceBundle: {
            source: 'searchDomainRules',
            domainRuleSearch: {
              schemaVersion: 'praxis-domain-rule-search.v1',
              candidates: [
                {
                  definitionId: definition.id, ruleKey: definition.ruleKey, version: definition.version,
                  ruleType: 'JSON_LOGIC_DECISION', status: definition.status,
                  contextKey: 'benefits', resourceKey: definition.resourceKey,
                  serviceKey: definition.serviceKey, semanticOwner: 'benefits-policy',
                  updatedAt: '2026-08-16T12:00:00Z'
                },
                {
                  definitionId: '9f10b712-1111-4444-8888-000000000099',
                  ruleKey: 'procurement.po_approval.urgent_override',
                  version: 1,
                  ruleType: 'approval_policy',
                  status: 'approved',
                  contextKey: 'procurement',
                  resourceKey: 'procurement.purchase-orders',
                  serviceKey: 'purchase-order-service',
                  semanticOwner: 'procurement-governance',
                  updatedAt: '2026-08-16T12:30:00Z'
                }
              ],
              page: 0, limit: 6, hasMore: false
            }
          }
        };
    const envelope = {
      eventId: '1', streamId, threadId: 'policy-thread', turnId: `turn-${authoringStreams.sequence}`,
      seq: 1, eventSchemaVersion: 'v1', timestamp: '2026-08-17T02:00:00Z',
      type: 'result', payload
    };
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
      body: `id: 1\nevent: result\ndata: ${JSON.stringify(envelope)}\n\n`
    });
  }

  if (path.endsWith('/definitions/capabilities')) return json({
    tenantId: 'default', environment: 'dev',
    definitions: [
      {
        definitionId: definition.id,
        ruleKey: definition.ruleKey,
        version: 1,
        availableActions: ['INSPECT_PUBLICATION_READINESS', 'PUBLISH']
      },
      ...(authoringStreams.promotedDefinitionId
        ? [{
            definitionId: authoringStreams.promotedDefinitionId,
            ruleKey: definition.ruleKey,
            version: 2,
            availableActions: ['INSPECT_PUBLICATION_READINESS', 'PUBLISH']
          }]
        : []),
      {
        definitionId: '9f10b712-1111-4444-8888-000000000099',
        ruleKey: 'procurement.po_approval.urgent_override',
        version: 1,
        availableActions: ['INSPECT_PUBLICATION_READINESS']
      }
    ]
  });
  if (path.endsWith('/definitions/catalog')) return json({
    schemaVersion: 'praxis-domain-rule-catalog.v1', page: 0, limit: 12, hasMore: false,
    candidates: [{
      definitionId: definition.id, ruleKey: definition.ruleKey, version: definition.version,
      ruleType: 'JSON_LOGIC_DECISION', status: definition.status,
      resourceKey: definition.resourceKey, serviceKey: definition.serviceKey,
      contextKey: 'benefits', semanticOwner: 'benefits-policy',
      updatedAt: '2026-08-16T12:00:00Z'
    }]
  });
  if (path.endsWith('/definitions') && request.method() === 'POST') {
    const body = request.postDataJSON() as Record<string, unknown>;
    return json({
      id: 'def-created-1',
      ruleKey: body['ruleKey'],
      version: 1,
      status: 'draft',
      ruleType: body['ruleType'],
      resourceKey: body['resourceKey'],
      serviceKey: body['serviceKey'],
      parameters: body['parameters'],
      condition: body['condition'] ?? null
    }, 201);
  }
  if (path.endsWith('/definitions')) return json([activeDefinition]);
  if (path.endsWith(`/definitions/${definition.id}/facts`)) return json({
    definitionId: definition.id,
    ruleKey: definition.ruleKey,
    definitionVersion: definition.version,
    schemaVersion: 'praxis.domain-rule-fact-catalog.v1',
    facts: [{
      path: 'request.requestedAmount', valueType: 'number', nullable: false,
      labels: { 'pt-BR': 'Valor solicitado', 'en-US': 'Requested amount' },
      descriptions: { 'pt-BR': 'Valor informado na solicitação.', 'en-US': 'Amount supplied by the request.' },
      providerRef: 'quickstart.extraordinary-benefit-request',
      evidenceRefs: ['quickstart://extraordinary-benefit/requested-amount'],
      sensitivity: 'SENSITIVE', redaction: 'MASK'
    }]
  });
  if (path.endsWith('/definitions/9f10b712-1111-4444-8888-000000000099/facts')) return json({
    definitionId: '9f10b712-1111-4444-8888-000000000099',
    ruleKey: 'procurement.po_approval.urgent_override',
    definitionVersion: 1,
    schemaVersion: 'praxis.domain-rule-fact-catalog.v1',
    facts: [{
      path: 'order.totalAmount',
      valueType: 'number',
      nullable: false,
      labels: { 'pt-BR': 'Valor total do pedido' },
      descriptions: { 'pt-BR': 'Soma financeira total do pedido de compra.' },
      providerRef: 'procurement.purchase-order.total-amount',
      evidenceRefs: ['procurement://purchase-orders/total-amount'],
      sensitivity: 'NON_SENSITIVE',
      redaction: 'NONE'
    }]
  });
  if (path.endsWith('/definitions/9f10b712-1111-4444-8888-000000000099/timeline')) return json([]);
  if (path.endsWith('/definitions/9f10b712-1111-4444-8888-000000000099')) return json({
    id: '9f10b712-1111-4444-8888-000000000099',
    ruleKey: 'procurement.po_approval.urgent_override',
    version: 1,
    status: 'approved',
    ruleType: 'approval_policy',
    contextKey: 'procurement',
    resourceKey: 'procurement.purchase-orders',
    serviceKey: 'purchase-order-service',
    condition: { '>=': [{ var: 'order.totalAmount' }, 10000] },
    definition: {
      reasonCode: 'PO-URGENT-01',
      title: { 'pt-BR': 'Alçada de aprovação urgente de pedido de compra' },
      description: { 'pt-BR': 'Exige aprovação executiva para pedidos urgentes acima de R$ 10.000.' },
      factCatalog: {
        definitionId: '9f10b712-1111-4444-8888-000000000099',
        ruleKey: 'procurement.po_approval.urgent_override',
        definitionVersion: 1,
        schemaVersion: 'praxis.domain-rule-fact-catalog.v1',
        facts: [{
          path: 'order.totalAmount',
          valueType: 'number',
          nullable: false,
          labels: { 'pt-BR': 'Valor total do pedido' },
          descriptions: { 'pt-BR': 'Soma financeira total do pedido de compra.' }
        }]
      }
    },
    parameters: {
      ruleSetKey: 'procurement.po_approval',
      operationKeys: ['APPROVE'],
      approvalPolicy: {
        actionId: 'approve',
        effect: 'ALLOW',
        message: 'Aprovação urgente permitida para pedidos qualificados.',
        approverRoles: ['PROCUREMENT_DIRECTOR']
      }
    }
  });
  if (path.endsWith('/domain-rules/simulations') && request.method() === 'POST') {
    return json({
      result: 'pass',
      explainability: {
        publicationReadiness: 'ready_to_publish',
        recommendedAction: 'publish'
      },
      existingCoverage: [],
      predictedMaterializations: [{ targetLayer: 'backend_validation', resourceKey: definition.resourceKey }],
      requiredApprovals: [],
      warnings: []
    });
  }
  if (path.endsWith('/domain-rules/publications') && request.method() === 'POST') {
    return json({
      publicationStatus: 'published',
      publicationReadiness: 'ready_to_publish',
      materializations: [{ id: 'mat-1' }],
      explainability: {
        publicationDiagnostics: {
          materializationOutcomes: [{ resolution: 'created' }]
        }
      }
    });
  }
  if (path.endsWith(`/definitions/${definition.id}`)) return json(activeDefinition);
  if (path.endsWith(`/definitions/${definition.id}/timeline`)) return json([]);
  if (path.endsWith('/workspaces')) return json([currentWorkspace]);
  if (path.endsWith('/workspaces/workspace-1/scenarios') && request.method() === 'POST') {
    const body = request.postDataJSON() as {
      scenarioKey: string; name: string; facts: Record<string, unknown>; expectedDecision: string
    };
    authoringStreams.createdScenario = {
      id: 'scenario-new', workspaceId: workspace.id, scenarioKey: body.scenarioKey,
      name: body.name, facts: body.facts, expectedDecision: body.expectedDecision,
      status: 'ACTIVE', etag: 'scenario-new-etag'
    };
    return json(authoringStreams.createdScenario, 201);
  }
  if (path.endsWith('/workspaces/workspace-1/scenarios')) return json([
    { id: 'scenario-create', scenarioKey: 'allow-create', name: 'CREATE permitido', expectedDecision: 'ALLOW', status: 'ACTIVE', facts: {} },
    { id: 'scenario-update', scenarioKey: 'deny-update', name: 'UPDATE negado', expectedDecision: 'DENY', status: 'ACTIVE', facts: {} },
    ...(authoringStreams.createdScenario ? [authoringStreams.createdScenario] : [])
  ]);
  if (path.endsWith('/workspaces/workspace-1/reviews') && request.method() === 'POST') {
    const body = request.postDataJSON() as { decision: 'APPROVE' | 'REJECT'; rationale: string };
    authoringStreams.workspaceStatus = body.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    authoringStreams.workspaceRevision += 1;
    authoringStreams.workspaceEtag = `workspace-etag-${authoringStreams.workspaceRevision}`;
    const review = {
      id: `review-${authoringStreams.reviews.length + 1}`,
      workspaceId: workspace.id,
      workspaceRevision: authoringStreams.workspaceRevision,
      reviewerRef: 'approver-lead',
      decision: body.decision,
      rationale: body.rationale,
      reviewedAt: '2026-08-18T10:00:00Z'
    };
    authoringStreams.reviews.push(review);
    return json(review, 201);
  }
  if (path.endsWith('/workspaces/workspace-1/reviews')) return json(authoringStreams.reviews);
  if (path.endsWith('/workspaces/workspace-1/test-runs')) return json([{
    runId: 'test-run-1',
    workspaceId: workspace.id,
    workspaceRevision: authoringStreams.workspaceRevision,
    status: 'PASSED',
    baselineEvidence: {
      authorityType: 'ACTIVE_SNAPSHOT',
      eligibility: 'ELIGIBLE',
      observedAtUtc: '2026-08-18T09:00:00Z',
      artifactRef: 'config://snapshot/snapshot-active-002',
      artifactDigest: 'sha256:0123456789abcdef0123456789abcdef'
    },
    results: []
  }]);
  if (path.endsWith('/workspaces/workspace-1/submit') && request.method() === 'POST') {
    authoringStreams.workspaceStatus = 'SUBMITTED';
    authoringStreams.workspaceRevision += 1;
    authoringStreams.workspaceEtag = `workspace-etag-${authoringStreams.workspaceRevision}`;
    return json({
      ...currentWorkspace,
      status: authoringStreams.workspaceStatus,
      revision: authoringStreams.workspaceRevision,
      etag: authoringStreams.workspaceEtag
    });
  }
  if (path.endsWith('/workspaces/workspace-1/promote') && request.method() === 'POST') {
    authoringStreams.workspaceStatus = 'PROMOTED';
    authoringStreams.workspaceRevision += 1;
    authoringStreams.workspaceEtag = `workspace-etag-${authoringStreams.workspaceRevision}`;
    authoringStreams.promotedDefinitionId = 'def-promoted-2';
    return json({
      ...currentWorkspace,
      status: authoringStreams.workspaceStatus,
      revision: authoringStreams.workspaceRevision,
      etag: authoringStreams.workspaceEtag,
      promotedDefinitionId: authoringStreams.promotedDefinitionId
    });
  }
  if (path.endsWith('/workspaces/workspace-1/capabilities')) {
    const actionsByStatus: Record<string, string[]> = {
      OPEN: ['VIEW', 'UPDATE_DRAFT', 'MANAGE_SCENARIOS', 'RECORD_TEST_RUN', 'SUBMIT'],
      SUBMITTED: ['VIEW', 'REVIEW'],
      APPROVED: ['VIEW', 'PROMOTE'],
      PROMOTED: ['VIEW']
    };
    return json({
      workspaceId: workspace.id,
      ruleKey: workspace.ruleKey,
      status: authoringStreams.workspaceStatus,
      revision: authoringStreams.workspaceRevision,
      etag: authoringStreams.workspaceEtag,
      availableActions: actionsByStatus[authoringStreams.workspaceStatus] ?? ['VIEW'],
      blockers: []
    });
  }
  if (path.endsWith('/workspaces/workspace-1/draft') && request.method() === 'PUT') {
    const body = request.postDataJSON() as { condition: unknown; parameters: unknown };
    expect(request.headers()['if-match']).toBe('"workspace-etag-4"');
    expect(body.condition).toEqual({ or: [
      { '===': [{ coalesce: [{ var: 'request.requestedAmount' }] }, null] },
      { '<=': [{ var: 'request.requestedAmount' }, 2750] }
    ] });
    expect(body.parameters).toEqual(workspace.parameters);
    authoringStreams.savedCondition = body.condition;
    authoringStreams.workspaceRevision = 5;
    authoringStreams.workspaceEtag = 'workspace-etag-5';
    return json({ ...workspace, revision: 5, etag: 'workspace-etag-5', condition: body.condition });
  }
  if (path.endsWith('/workspaces/workspace-1')) return json(currentWorkspace);
  if ((path.endsWith('/rules-studio/sandbox/runs') || path.endsWith('/policy-studio/sandbox/runs')) && request.method() === 'POST') {
    const body = request.postDataJSON() as { workspaceId: string; scenarioIds: string[]; evaluatedAtUtc: string };
    return json({
      runId: 'sandbox-run-1', workspaceId: body.workspaceId, workspaceRevision: 4,
      evaluatedAtUtc: body.evaluatedAtUtc, activeSnapshotKey: null,
      results: body.scenarioIds.map((scenarioId, index) => ({
        scenarioId,
        scenarioKey: scenarioId === 'scenario-new' ? 'limit-boundary' : index === 0 ? 'allow-create' : 'deny-update',
        expectedDecision: scenarioId === 'scenario-update' ? 'DENY' : 'ALLOW',
        candidateDecision: scenarioId === 'scenario-update' ? 'DENY' : 'ALLOW',
        activeDecision: 'TECHNICAL_ERROR', comparison: 'CANDIDATE_MATCH',
        candidateMatchesExpected: true, activeMatchesExpected: false,
        candidateReasonCodes: [], activeReasonCodes: []
      }))
    }, 201);
  }
  if (path === '/schemas/actions') return json({
    resourceKey: definition.resourceKey, resourcePath: '/api/human-resources/extraordinary-benefit-requests', actions: [{
      id: 'operational-proof', resourceKey: definition.resourceKey, scope: 'COLLECTION',
      title: 'Executar prova operacional', description: 'Executa comandos descartáveis no host.',
      operationId: 'runOperationalProof',
      path: '/api/human-resources/extraordinary-benefit-requests/actions/run-policy-studio-operational-test',
      method: 'POST', order: 1, tags: ['policy-studio', 'operational-proof'],
      availability: { allowed: operationalAllowed, reasonCode: operationalAllowed ? 'ALLOWED' : 'FORBIDDEN', reasons: [] },
      execution: {
        interaction: { mode: 'CONFIRM', risk: 'HIGH', confirmationRequired: true, reversible: true },
        preconditions: {
          idempotencyKey: 'REQUIRED', correlationId: 'REQUIRED', resourceVersion: 'REQUIRED',
          resourceVersionTransport: 'IF_MATCH',
          resourceVersionTargetResourceKey: 'praxis.config.domain-rule-change-workspaces',
          resourceVersionTargetIdField: 'workspaceId'
        }, selection: {}, outcome: { mode: 'SINGLE', atomicity: 'ATOMIC' },
        refresh: { item: false, collection: false, actions: true, capabilities: true, resourceKeys: [] }
      }
    }]
  });
  if (path.endsWith('/actions/run-policy-studio-operational-test') && request.method() === 'POST') {
    return json({ code: 'PRECONDITION_FAILED', message: 'Workspace ETag is stale.' }, 412);
  }
  if (path.endsWith('/candidate') && request.method() === 'POST') {
    const ruleSetKey = path.split('/').at(-2) ?? 'quickstart.extraordinary-benefit.eligibility';
    return json({
      ruleSetKey: decodeURIComponent(ruleSetKey),
      ruleSetVersion: 2,
      compositionDigest: 'sha256:manifest-digest-001',
      implementationCatalogDigest: 'sha256:impl-catalog-001',
      currentHeadEtag: '"head-etag-1"',
      sources: [
        { ruleKey: definition.ruleKey, definitionId: definition.id, version: 1, status: 'approved' }
      ],
      authorizedActions: ['PREPARE', 'APPROVE', 'PUBLISH']
    });
  }
  if (path.endsWith('/candidate/approvals') && request.method() === 'POST') {
    return json({
      approvalKey: 'approval-001',
      role: 'RULE_COMPOSITION_APPROVER',
      actorRef: 'approver-1',
      decidedAtUtc: '2026-08-18T12:00:00Z',
      evidenceHash: 'sha256:manifest-digest-001'
    });
  }
  if (path.endsWith('/candidate/publish') && request.method() === 'POST') {
    const ruleSetKey = path.split('/').at(-3) ?? 'quickstart.extraordinary-benefit.eligibility';
    return json({
      snapshotKey: 'snapshot-candidate-002',
      ruleSetKey: decodeURIComponent(ruleSetKey),
      ruleSetVersion: 2,
      snapshotContentHash: 'sha256:snapshot-content-001'
    }, 201);
  }
  if (path.endsWith('/rollout-policies/timeline')) return json([]);
  if (path.endsWith('/rollout-policies')) return json({}, 404);
  if (path.endsWith('/rollouts')) return json({
    ruleSetKey: url.searchParams.get('ruleSetKey') ?? 'quickstart.extraordinary-benefit.eligibility',
    operationKey: url.searchParams.get('operationKey') ?? 'evaluate-extraordinary-grant',
    rollouts: [],
    availableActions: []
  });
  if (path.endsWith('/snapshots/head/status')) return json({}, 404);
  if (path.endsWith('/snapshots/head')) return json({}, 404);
  if (path.endsWith('/snapshots')) return json([]);
  return json([]);
}

test('distinguishes an unauthenticated session and preserves keyboard access', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.route('**/auth/session', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.goto('/catalog');

  await expect(page.getByText('Entrar no ambiente de desenvolvimento', { exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo principal' })).toBeFocused();
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);
});

test('shows capability-limited operational proof without exposing a command', async ({ page }, testInfo) => {
  await mockGovernedBackend(page, false);
  await page.goto('/catalog');
  if (testInfo.project.name === 'narrow') {
    await page.getByRole('button', { name: /O valor solicitado deve respeitar o limite do programa/ }).click();
  }
  await page.getByRole('button', { name: 'Testar regra', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'O valor solicitado deve respeitar o limite do programa.' })).toBeVisible();
  const capabilityMessage = page.getByText('Sua sessão não possui a capability necessária para executar esta prova.');
  await expect(capabilityMessage).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revisar prova operacional' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);
  await capabilityMessage.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('capability-limited.png') });
});

test('confirms the operation and explains a stale workspace ETag', async ({ page }, testInfo) => {
  await mockGovernedBackend(page, true);
  await page.goto('/catalog');
  if (testInfo.project.name === 'narrow') {
    await page.getByRole('button', { name: /O valor solicitado deve respeitar o limite do programa/ }).click();
  }
  await page.getByRole('button', { name: 'Testar regra', exact: true }).click();
  const modes = page.getByLabel('Operação do cenário');
  await modes.nth(0).selectOption('CREATE');
  await modes.nth(1).selectOption('UPDATE');
  await page.getByRole('button', { name: 'Revisar prova operacional' }).click();
  const confirmation = page.getByText('O host executará comandos descartáveis');
  await expect(confirmation).toBeVisible();
  await confirmation.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('operational-confirmation.png') });
  await page.getByRole('button', { name: 'Executar prova' }).click();
  await expect(page.getByText('A ação conflita com a revisão atual, o ETag ou um gate de lifecycle. Recarregue as evidências antes de tentar novamente.')).toBeVisible();
});

test('discovers, selects, and explains an exact governed decision', async ({ page }, testInfo) => {
  await mockGovernedBackend(page, false);
  await page.goto('/catalog');

  await page.getByTestId('studio-open-ai-inspector').click();
  await page.getByLabel('O que você precisa encontrar?').fill('regras que limitam o valor do auxílio');
  await page.getByRole('button', { name: 'Descobrir', exact: true }).click();
  const candidate = page.getByTestId('discovery-candidate-grant.amount-parameters');
  await expect(candidate).toBeVisible();
  await candidate.click();
  await page.getByRole('button', { name: 'Explicar esta decisão' }).click();
  await expect(page.getByText('A decisão limita o valor solicitado ao teto governado')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: testInfo.outputPath(testInfo.project.name === 'narrow'
      ? 'ai-discovery-narrow.png'
      : 'ai-discovery-desktop.png')
  });
});

test('uses a catalog-to-decision flow on narrow screens', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'narrow', 'Narrow navigation only');
  await mockGovernedBackend(page, false);
  await page.goto('/catalog');

  const decision = page.getByRole('button', { name: /O valor solicitado deve respeitar o limite do programa/ });
  await expect(decision).toBeVisible();
  await expect(page.getByRole('heading', { name: 'O valor solicitado deve respeitar o limite do programa.' })).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('narrow-catalog.png'), fullPage: false });

  await decision.click();
  await expect(page.getByRole('button', { name: 'Voltar ao catálogo' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'O valor solicitado deve respeitar o limite do programa.' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('narrow-decision.png'), fullPage: false });
  await page.getByRole('button', { name: 'Voltar ao catálogo' }).click();

  await expect(decision).toBeVisible();
  await expect(page.getByRole('heading', { name: 'O valor solicitado deve respeitar o limite do programa.' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('preserves the governed workspace while editing, adding a typed scenario, and running the sandbox', async ({ page }, testInfo) => {
  let configLoads = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname.endsWith('/app-config.json')) configLoads += 1;
  });
  await mockGovernedBackend(page, false);
  await page.goto('/catalog');
  if (testInfo.project.name === 'narrow') {
    await page.getByRole('button', { name: /O valor solicitado deve respeitar o limite do programa/ }).click();
  }

  await page.locator('.decision-navigation').getByRole('button', { name: /^Regra/ }).click();
  await expect(page.locator('#decision-rule')).toBeFocused();
  await expect(page).toHaveURL(/\/catalog$/);
  expect(configLoads).toBe(1);

  await page.getByRole('button', { name: 'Testar regra', exact: true }).click();
  await page.getByRole('button', { name: 'Editar regra', exact: true }).click();
  await expect(page.locator('.draft-workspace')).toBeVisible();
  await expect(page.locator('.decision-navigation').getByRole('button', { name: /^Regra/ })).toHaveAttribute('aria-current', 'page');
  const draftValueInput = page.locator('.draft-workspace').getByRole('spinbutton', { name: 'Valor' });
  await expect(async () => {
    await draftValueInput.fill('2750');
    await expect(page.locator('.draft-workspace .draft-compare section.changed')).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 10000 });
  await page.getByRole('button', { name: 'Salvar draft governado' }).click();
  await expect(page.getByText('Draft salvo com controle de concorrência.')).toBeVisible();
  await page.getByRole('link', { name: 'Praxis Policy Studio — catálogo' }).click();
  await expect(page.locator('.draft-workspace')).toBeVisible();
  expect(configLoads).toBe(1);

  await page.getByRole('button', { name: 'Testar regra', exact: true }).click();
  await page.getByLabel('Chave do cenário').fill('limit-boundary');
  await page.getByLabel('Nome do cenário').fill('Limite permitido');
  await page.getByRole('spinbutton', { name: 'Valor solicitado' }).fill('3000');
  await page.getByLabel('Decisão esperada').selectOption('ALLOW');
  await page.getByRole('button', { name: 'Adicionar cenário' }).click();
  await expect(page.getByText('Limite permitido', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Comparar com a versão ativa' }).click();
  await expect(page.getByText('Sandbox concluído e evidência imutável registrada.')).toBeVisible();
  await expect(page.locator('.sandbox-results').getByText('limit-boundary', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('authoring-sandbox-result.png'), fullPage: false });
});

test('keeps incompatible snapshot history visible without offering runtime operations', async ({ page }, testInfo) => {
  await mockGovernedBackend(page, false);
  const operationKey = 'CREATE';
  const historical = {
    snapshotKey: 'historical-contract-1.4', ruleSetKey: 'extraordinary-grant-eligibility', operationKey, ruleSetVersion: 1,
    publicationRevision: 1, snapshotContentHash: 'A'.repeat(64), publishedBy: 'publisher',
    publishedAtUtc: '2026-10-20T12:00:00Z', active: true,
    governanceState: 'RUNTIME_INCOMPATIBLE', availableAction: 'UNAVAILABLE'
  };
  const commands: string[] = [];
  page.on('request', request => {
    if (request.method() !== 'GET' && new URL(request.url()).pathname.includes('/snapshots')) {
      commands.push(request.url());
    }
  });
  await page.route('**/api/**/snapshots**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.endsWith('/snapshots/head/status')) return json({
      ruleSetKey: historical.ruleSetKey, operationKey, activeSnapshotKey: historical.snapshotKey,
      ruleSetVersion: 1, publicationRevision: 1, activationRevision: 2,
      headEtag: '"historical-head"', executionReady: false, governanceState: 'RUNTIME_INCOMPATIBLE'
    });
    if (path.endsWith('/snapshots')) return json([
      historical, { ...historical, snapshotKey: 'historical-candidate', active: false, publicationRevision: 2 }
    ]);
    if (path.endsWith('/rollouts')) return json({
      ruleSetKey: historical.ruleSetKey, operationKey, rollouts: [], availableActions: ['CREATE_ROLLOUT']
    });
    if (path.endsWith('/rollout-policies')) return json({
      ruleSetKey: historical.ruleSetKey, activePolicy: null, versions: [], availableActions: []
    });
    if (path.endsWith('/execution-summary') || path.endsWith('/host-status-summary')) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    }
    return route.fallback();
  });
  await page.goto('/catalog');
  if (testInfo.project.name === 'narrow') {
    await page.getByRole('button', { name: /O valor solicitado deve respeitar o limite do programa/ }).click();
  }
  await page.getByRole('button', { name: /^Operar/ }).click();
  const cockpit = page.locator('pax-snapshot-cockpit');
  await cockpit.getByLabel('Operação governada', { exact: true }).selectOption(operationKey);
  await expect(cockpit.getByText('Incompatível com o runtime atual', { exact: true }).first()).toBeVisible();
  await expect(cockpit.getByText('Não pronto', { exact: true })).toBeVisible();
  await expect(cockpit.getByText('historical-contract-1.4', { exact: true }).first()).toBeVisible();
  await expect(cockpit.getByText('O histórico íntegro foi preservado para auditoria.', { exact: false }).first()).toBeVisible();
  await expect(cockpit.getByRole('button', { name: /Ativar esta versão|Reverter para esta versão|Iniciar rollout/ })).toHaveCount(0);
  expect(commands).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const version of await cockpit.locator('.snapshot-version-list > article').all()) {
    const bounds = await version.boundingBox();
    expect(bounds?.height).toBeLessThan(600);
  }
  await cockpit.screenshot({ path: testInfo.outputPath('incompatible-history.png') });
});

for (const hasExistingHead of [false, true]) {
  test(`activates a published candidate through governed ${hasExistingHead ? 'existing-head' : 'bootstrap'} rollout`, async ({ page }, testInfo) => {
    await mockGovernedBackend(page, false);
    const candidateKey = 'published-candidate';
    const oldHeadKey = 'previous-active-snapshot';
    let oldHeadEtag = '"previous-head-7"';
    const ruleSetKey = 'extraordinary-grant-eligibility';
    const operationKey = 'CREATE';
    let created = false;
    let activated = false;
    const commands: string[] = [];
    const policy = {
      policyId: 'required-policy-1', ruleSetKey, policyKey: 'host-quorum', policyVersion: 1,
      status: 'ACTIVE', enforcementMode: 'REQUIRED', minimumFreshProbes: 1, minimumReadyRatio: 1,
      blockOnIncompatible: true, staleAfterSeconds: 120, maximumRolloutAgeSeconds: 900,
      createdBy: 'policy-author', createdAt: '2026-10-21T12:00:00Z', approvedBy: 'reviewer',
      approvedAt: '2026-10-21T12:01:00Z', activatedBy: 'operator', activatedAt: '2026-10-21T12:02:00Z',
      availableActions: []
    };
    const rollout = {
      rolloutId: 'governed-rollout-1', ruleSetKey, operationKey, candidateSnapshotKey: candidateKey,
      candidateContentHash: 'B'.repeat(64), expectedActiveSnapshotKey: hasExistingHead ? oldHeadKey : null,
      expectedHeadEtag: hasExistingHead ? oldHeadEtag : null,
      policyKey: policy.policyKey, policyVersion: 1, enforcementMode: 'REQUIRED', status: 'READY',
      createdAtUtc: '2026-10-21T12:03:00Z', expiresAtUtc: null
    };
    await page.route('**/api/**/snapshots**', route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const json = (body: unknown, status = 200, headers?: Record<string, string>) => route.fulfill({
        status, contentType: 'application/json', body: JSON.stringify(body), headers
      });
      const assertHeadCondition = () => {
        const headers = request.headers();
        expect(headers['if-match']).toBe(hasExistingHead ? oldHeadEtag : undefined);
        expect(headers['if-none-match']).toBe(hasExistingHead ? undefined : '*');
      };
      if (path.endsWith('/snapshots/rollouts') && request.method() === 'POST') {
        assertHeadCondition();
        expect(request.postDataJSON()).toEqual({ candidateSnapshotKey: candidateKey });
        commands.push('create-rollout');
        created = true;
        return json(rollout, 201);
      }
      if (path.endsWith(`/snapshots/${candidateKey}/activate`) && request.method() === 'POST') {
        assertHeadCondition();
        expect(request.headers()['x-rule-rollout-id']).toBe(rollout.rolloutId);
        expect(created).toBe(true);
        commands.push('activate-candidate');
        activated = true;
        return json({ snapshot: { snapshotKey: candidateKey }, snapshotContentHash: 'B'.repeat(64),
          headEtag: '"selected-head-8"', activationRevision: 8, activationType: 'ACTIVATED' });
      }
      if (path.endsWith('/snapshots/head/status')) {
        expect(url.searchParams.get('operationKey')).toBe(operationKey);
        if (!hasExistingHead && !activated) return json({}, 404, { 'Cache-Control': 'no-store' });
        return json({ ruleSetKey, operationKey, activeSnapshotKey: activated ? candidateKey : oldHeadKey,
          ruleSetVersion: activated ? 2 : 1, publicationRevision: activated ? 2 : 1,
          activationRevision: activated ? 8 : 7, headEtag: activated ? '"selected-head-8"' : oldHeadEtag,
          executionReady: true, governanceState: 'READY' });
      }
      if (path.endsWith('/snapshots')) {
        expect(url.searchParams.get('operationKey')).toBe(operationKey);
        return json([{
          snapshotKey: candidateKey, ruleSetKey, operationKey, ruleSetVersion: 2, publicationRevision: 2,
          snapshotContentHash: 'B'.repeat(64), publishedBy: 'publisher', publishedAtUtc: '2026-10-21T12:02:30Z',
          active: activated, governanceState: 'READY',
          availableAction: activated ? 'ACTIVE' : hasExistingHead ? 'ACTIVATE' : 'CREATE_ROLLOUT'
        }]);
      }
      if (path.endsWith('/rollouts')) {
        expect(url.searchParams.get('operationKey')).toBe(operationKey);
        return json({ ruleSetKey, operationKey,
          rollouts: created && !activated ? [{ rollout, expectedHeadCurrent: true, expired: false,
            readiness: { rolloutId: rollout.rolloutId, ruleSetKey, candidateSnapshotKey: candidateKey,
              status: 'READY', enforcementMode: 'REQUIRED', minimumFreshProbes: 1, minimumReadyRatio: 1,
              totalProbes: 1, readyProbes: 1, incompatibleProbes: 0, unavailableProbes: 0, staleProbes: 0,
              activationReady: true, staleBeforeUtc: '2026-10-21T12:01:00Z' },
            availableActions: ['ACTIVATE_CANDIDATE'] }] : [],
          availableActions: created ? [] : ['CREATE_ROLLOUT'] });
      }
      if (path.endsWith('/rollout-policies')) return json({ ruleSetKey, activationRevision: 1,
        headEtag: '"policy-head-1"', activePolicy: policy, versions: [policy], availableActions: [] });
      if (path.endsWith('/timeline')) return json([]);
      if (path.endsWith('/execution-summary') || path.endsWith('/host-status-summary')) return json({}, 404);
      return route.fallback();
    });
    await page.goto('/catalog');
    if (testInfo.project.name === 'narrow') {
      await page.getByRole('button', { name: /O valor solicitado deve respeitar o limite do programa/ }).click();
    }
    await page.getByRole('button', { name: /^Operar/ }).click();
    const cockpit = page.locator('pax-snapshot-cockpit');
    await cockpit.getByLabel('Operação governada', { exact: true }).selectOption(operationKey);
    const head = cockpit.locator('.snapshot-head');
    if (hasExistingHead) await expect(head.getByText(oldHeadKey, { exact: true })).toBeVisible();
    else await expect(cockpit.getByText('Nenhum snapshot está ativo para esta operação.', { exact: true })).toBeVisible();
    await expect(cockpit.getByText('host-quorum', { exact: true })).toBeVisible();
    expect(commands).toEqual([]);
    await cockpit.getByRole('button', { name: `Iniciar rollout · ${candidateKey}`, exact: true }).click();
    if (hasExistingHead) {
      // Inject a concurrent head observation while the real confirmation is open.
      // No authority is calculated here; the test exercises the consumer's stale-view guard.
      oldHeadEtag = '"concurrent-head-8"';
      rollout.expectedHeadEtag = oldHeadEtag;
      await page.evaluate(headEtag => {
        const workspace = Reflect.get(window, 'ng').getComponent(document.querySelector('pax-catalog-workspace'));
        workspace.snapshotHead.set({ ...workspace.snapshotHead(), headEtag });
      }, oldHeadEtag);
      await page.getByRole('dialog').getByRole('button', { name: 'Iniciar rollout', exact: true }).click();
      await expect(cockpit.getByRole('alert').filter({ hasText: 'O estado mudou.' })).toBeVisible();
      expect(commands).toEqual([]);
      await cockpit.getByRole('button', { name: `Iniciar rollout · ${candidateKey}`, exact: true }).click();
    }
    await page.getByRole('dialog').screenshot({ path: testInfo.outputPath('rollout-confirmation.png') });
    const confirmCreate = page.getByRole('dialog').getByRole('button', { name: 'Iniciar rollout', exact: true });
    await confirmCreate.focus();
    await page.keyboard.press('Enter');
    await expect(cockpit.getByRole('button', { name: 'Promover candidato', exact: true })).toBeVisible();
    expect(commands).toEqual(['create-rollout']);
    if (hasExistingHead) await expect(head.getByText(oldHeadKey, { exact: true })).toBeVisible();
    else await expect(head).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('published-candidate-before-activation.png'), fullPage: true });
    await cockpit.getByRole('button', { name: 'Promover candidato', exact: true }).click();
    if (!hasExistingHead) {
      // Simulate a Config catalog observation withdrawing activation during confirmation.
      await page.evaluate(() => {
        const workspace = Reflect.get(window, 'ng').getComponent(document.querySelector('pax-catalog-workspace'));
        const catalog = workspace.rolloutCatalog();
        workspace.rolloutCatalog.set({ ...catalog, rollouts: catalog.rollouts.map((item: object) => ({ ...item, availableActions: [] })) });
      });
      await page.getByRole('dialog').getByRole('button', { name: 'Promover candidato', exact: true }).click();
      await expect(cockpit.getByRole('alert').filter({ hasText: 'O estado mudou.' })).toBeVisible();
      expect(commands).toEqual(['create-rollout']);
      await page.evaluate(() => {
        const workspace = Reflect.get(window, 'ng').getComponent(document.querySelector('pax-catalog-workspace'));
        const catalog = workspace.rolloutCatalog();
        workspace.rolloutCatalog.set({ ...catalog, rollouts: catalog.rollouts.map((item: object) => ({ ...item, availableActions: ['ACTIVATE_CANDIDATE'] })) });
      });
      await cockpit.getByRole('button', { name: 'Promover candidato', exact: true }).click();
    }
    await page.getByRole('dialog').getByRole('button', { name: 'Promover candidato', exact: true }).click();
    await expect(head.getByText(candidateKey, { exact: true })).toBeVisible();
    await expect(head.getByText('"selected-head-8"', { exact: true })).toBeVisible();
    expect(commands).toEqual(['create-rollout', 'activate-candidate']);
    await expect(cockpit.getByRole('button', { name: /Iniciar rollout|Promover candidato/ })).toHaveCount(0);
  });
}

test('validates new decision creation, operational effect authoring, and assisted snapshot composition visually', async ({ page }, testInfo) => {
  await mockGovernedBackend(page, false, true);
  await page.goto('/catalog');

  const toggleNewDecision = page.getByTestId('toggle-new-decision');
  await expect(toggleNewDecision).toBeVisible();
  await toggleNewDecision.click();
  await expect(page.getByTestId('decision-create-form')).toBeVisible();
  await page.getByTestId('new-decision-rule-key').fill('benefits.extraordinary.urgent-approval');
  await page.getByTestId('new-decision-rule-type').selectOption('approval_policy');
  await expect(page.getByTestId('new-decision-action-id')).toBeVisible();
  await page.getByTestId('new-decision-action-id').fill('approve');
  await page.getByTestId('new-decision-resource-key').fill('human-resources.extraordinary-benefit-requests');
  await page.getByTestId('new-decision-service-key').fill('extraordinary-benefit-request-service');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const createViolations = await new AxeBuilder({ page }).analyze();
  expect(createViolations.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath(`decision-create-${testInfo.project.name}.png`),
    fullPage: false
  });
  await page.getByTestId('decision-create-form').getByRole('button', { name: 'Fechar' }).click();

  if (testInfo.project.name === 'narrow') {
    await page.getByRole('button', { name: /O valor solicitado deve respeitar o limite do programa/ }).click();
  }

  await page.getByRole('button', { name: 'Editar regra', exact: true }).click();
  const parametersEditor = page.getByTestId('decision-parameters-editor');
  await expect(parametersEditor).toBeVisible();
  await expect(page.getByTestId('operational-policy-effect')).toHaveValue('BLOCK');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const editorViolations = await new AxeBuilder({ page }).analyze();
  expect(editorViolations.violations).toEqual([]);
  await parametersEditor.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath(`parameters-authoring-${testInfo.project.name}.png`),
    fullPage: false
  });

  await page.getByRole('button', { name: /^Operar/ }).click();
  const toggleComposition = page.getByTestId('toggle-snapshot-composition');
  await expect(toggleComposition).toBeVisible();
  await toggleComposition.click();
  await expect(page.getByTestId('snapshot-composition-form')).toBeVisible();
  await expect(page.getByTestId('snapshot-eligible-sources')).toBeVisible();

  await page.getByTestId('prepare-snapshot-composition').click();
  await expect(page.getByTestId('snapshot-composition-digest')).toContainText('sha256:manifest-digest-001');
  await expect(page.getByTestId('snapshot-candidate-sources')).toContainText(definition.ruleKey);
  await expect(page.getByTestId('snapshot-sod-notice')).toBeVisible();
  await page.getByTestId('approve-snapshot-composition').click();
  await expect(page.getByTestId('snapshot-composition-approval')).toContainText('approval-001');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const compositionViolations = await new AxeBuilder({ page }).analyze();
  expect(compositionViolations.violations).toEqual([]);
  await page.getByTestId('snapshot-composition-section').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath(`snapshot-composition-${testInfo.project.name}.png`),
    fullPage: false
  });

  await page.getByTestId('publish-snapshot-composition').click();
  await expect(page.getByText('Snapshot candidato publicado; o cockpit foi recarregado.')).toBeVisible();
  await expect(page.getByTestId('snapshot-composition-publication')).toContainText('snapshot-candidate-002');
});

test('completes the multi-persona 4-eyes journey, assisted scenario suggestions, where-used impact analysis, and on-demand discovery resolution', async ({ page }, testInfo) => {
  await mockGovernedBackend(page, false, true);
  let activeSnapshotKey = 'snapshot-active-002';
  let headEtag = '"head-etag-1"';
  await page.route('**/snapshots/head/status*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      operationKey: 'evaluate-extraordinary-grant',
      ruleSetKey: 'quickstart.extraordinary-benefit.eligibility',
      activeSnapshotKey,
      ruleSetVersion: activeSnapshotKey === 'snapshot-active-002' ? 2 : 1,
      publicationRevision: 4,
      activationRevision: activeSnapshotKey === 'snapshot-active-002' ? 2 : 3,
      executionReady: true,
      governanceState: 'READY',
      headEtag
    })
  }));
  await page.route('**/snapshots/head/host-status-summary*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      operationKey: 'evaluate-extraordinary-grant',
      ruleSetKey: 'quickstart.extraordinary-benefit.eligibility',
      expectedSnapshotKey: activeSnapshotKey,
      expectedSnapshotContentHash: 'A'.repeat(64),
      expectedActivationRevision: 2,
      expectedHostContractVersion: 'quickstart/1.0',
      expectedEngineContractVersion: '1.4',
      expectedJsonLogicDialectVersion: 'praxis-json-logic/1.0',
      expectedJsonLogicCorpusSha256: 'B'.repeat(64),
      expectedImplementationCatalogDigest: 'C'.repeat(64),
      totalHosts: 3,
      alignedHosts: 3,
      snapshotDriftedHosts: 0,
      incompatibleHosts: 0,
      unavailableHosts: 0,
      staleHosts: 0,
      lastObservedAtUtc: '2026-08-18T11:00:00Z',
      staleBeforeUtc: '2026-08-18T10:55:00Z'
    })
  }));
  await page.route('**/snapshots/*/execution-summary', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ruleSetKey: 'quickstart.extraordinary-benefit.eligibility',
      snapshotKey: activeSnapshotKey,
      snapshotContentHash: 'A'.repeat(64),
      ruleSetVersion: 2,
      totalObservations: 120,
      distinctHosts: 3,
      outcomeCounts: { ALLOW: 95, DENY: 25, NOT_APPLICABLE: 0, INCONCLUSIVE: 0, TECHNICAL_ERROR: 0 },
      firstObservedAtUtc: '2026-08-18T10:00:00Z',
      lastObservedAtUtc: '2026-08-18T11:00:00Z'
    })
  }));
  await page.route('**/snapshots?*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      {
        snapshotKey: 'snapshot-active-002',
        operationKey: 'evaluate-extraordinary-grant',
        ruleSetKey: 'quickstart.extraordinary-benefit.eligibility',
        ruleSetVersion: 2,
        publicationRevision: 4,
        governanceState: 'READY',
        snapshotContentHash: 'sha256:active-002',
        publishedBy: 'release-bot',
        publishedAtUtc: '2026-08-18T09:00:00Z',
        active: activeSnapshotKey === 'snapshot-active-002',
        availableAction: activeSnapshotKey === 'snapshot-active-002' ? 'ACTIVE' : 'ACTIVATE'
      },
      {
        snapshotKey: 'snapshot-prev-001',
        operationKey: 'evaluate-extraordinary-grant',
        ruleSetKey: 'quickstart.extraordinary-benefit.eligibility',
        ruleSetVersion: 1,
        publicationRevision: 3,
        governanceState: 'READY',
        snapshotContentHash: 'sha256:prev-001',
        publishedBy: 'release-bot',
        publishedAtUtc: '2026-08-17T09:00:00Z',
        active: activeSnapshotKey === 'snapshot-prev-001',
        availableAction: activeSnapshotKey === 'snapshot-prev-001' ? 'ACTIVE' : 'ROLLBACK'
      }
    ])
  }));
  await page.route('**/snapshots/snapshot-prev-001/rollback', route => {
    expect(route.request().headers()['if-match']).toBe('"head-etag-1"');
    activeSnapshotKey = 'snapshot-prev-001';
    headEtag = '"head-etag-2"';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        activationType: 'ROLLED_BACK',
        activeSnapshotKey,
        headEtag
      })
    });
  });
  await page.goto('/catalog');

  // 1. On-demand discovery resolution of an external candidate outside the initial projection
  await page.getByTestId('studio-open-ai-inspector').click();
  await page.getByLabel('O que você precisa encontrar?').fill('aprovação urgente de pedido de compra');
  await page.getByRole('button', { name: 'Descobrir' }).click();
  const externalCandidateBtn = page.getByTestId('discovery-candidate-procurement.po_approval.urgent_override');
  await expect(externalCandidateBtn).toBeVisible();
  await expect(externalCandidateBtn).toContainText('Carregar sob demanda');
  await externalCandidateBtn.click();

  await expect(page.getByRole('heading', { name: 'Alçada de aprovação urgente de pedido de compra' })).toBeVisible();
  if (testInfo.project.name === 'narrow') {
    await page.getByRole('button', { name: 'Voltar ao catálogo' }).click();
  }

  // Return to the governed grant decision for the 4-eyes journey
  await page.getByRole('button', { name: /O valor solicitado deve respeitar o limite do programa/ }).click();
  if (testInfo.project.name !== 'narrow') {
    await page.getByTestId('inspector-tab-properties').click();
  }
  await expect(page.getByRole('heading', { name: 'O valor solicitado deve respeitar o limite do programa.' })).toBeVisible();
  await expect(page.getByTestId('decision-maturity-posture')).toBeVisible();
  await expect(page.getByTestId('posture-technical-maturity')).toContainText('Estrutura técnica e catálogo de fatos verificados');
  await expect(page.getByTestId('posture-approval-stage')).toContainText('Aprovada em 4-olhos');
  await expect(page.getByTestId('posture-operational-authority')).toContainText('Config autoritativo');

  // 1b. Intent-based representations (Tree, Decision Table, Domain Expression), fact redaction audit, and assisted diff proposals
  await page.getByRole('button', { name: 'Editar regra', exact: true }).click();
  await expect(page.getByTestId('fact-redaction-summary')).toContainText('1/1 fatos sensíveis/restritos · 1/1 com política de redaction');
  await expect(page.getByTestId('representation-mode-switcher')).toBeVisible();
  await page.getByTestId('representation-mode-table').click();
  await expect(page.getByTestId('decision-table-representation')).toBeVisible();
  await expect(page.getByTestId('decision-table-value-0')).toHaveValue('3000');
  await page.getByTestId('representation-mode-expression').click();
  await expect(page.getByTestId('decision-expression-representation')).toBeVisible();
  await expect(page.getByTestId('decision-domain-expression')).toContainText('3000');
  await page.getByTestId('representation-mode-tree').click();

  await expect(page.getByTestId('assisted-diff-proposals')).toBeVisible();
  await page.getByTestId('apply-diff-proposal-RELAX_THRESHOLD_10').click();
  await expect(page.locator('.draft-compare')).toContainText('3300');
  await page.getByRole('button', { name: 'Restaurar condição' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Descartar alterações' }).click();

  // 2. Author persona: apply assisted DENY scenario suggestion, recover from a 412 conflict, and submit workspace for review
  await page.getByRole('button', { name: 'Testar regra', exact: true }).click();
  await expect(page.getByTestId('scenario-suggestions')).toBeVisible();
  await page.getByTestId('apply-scenario-suggestion-DENY').click();
  await expect(page.getByLabel('Chave do cenário')).toHaveValue('amount-parameters-deny');
  await expect(page.getByLabel('Decisão esperada')).toHaveValue('DENY');
  await expect(page.getByRole('spinbutton', { name: 'Valor solicitado' })).toHaveValue('3100');
  await page.getByRole('button', { name: 'Adicionar cenário' }).click();
  await expect(page.getByText('Cenário governado criado.')).toBeVisible();

  let simulateSubmitConflict = true;
  await page.route('**/workspaces/workspace-1/submit', async (route) => {
    if (simulateSubmitConflict) {
      simulateSubmitConflict = false;
      await route.fulfill({
        status: 412,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'PRECONDITION_FAILED', message: 'Workspace ETag is stale' })
      });
      return;
    }
    await route.fallback();
  });

  await page.getByRole('button', { name: 'Submeter para revisão' }).click();
  await expect(page.getByTestId('reload-governed-evidence')).toBeVisible();
  await page.getByTestId('reload-governed-evidence').click();
  await expect(page.getByText('Evidências governadas, revisão e ETag ressincronizados com o Config.')).toBeVisible();

  await page.getByRole('button', { name: 'Submeter para revisão' }).click();
  await expect(page.getByText('Workspace submetido para revisão independente.')).toBeVisible();

  // 3. Independent Reviewer persona (4-eyes): approve candidate and promote to governed definition via delegated gate command
  await page.getByRole('button', { name: /^Operar/ }).click();
  await expect(page.getByTestId('governance-gate-summary')).toBeVisible();
  await expect(page.getByTestId('governance-bound-receipt')).toContainText('test-run-1');
  await expect(page.getByTestId('governance-bound-receipt')).toContainText('ELIGIBLE');
  await expect(page.getByTestId('governance-gate-REVIEW')).toContainText('Autorizado para o principal atual');
  await page.getByLabel('Justificativa da revisão').fill('Revisão independente concluída; limites e testes validados.');
  await page.getByRole('button', { name: 'Aprovar candidato' }).click();
  await expect(page.getByText('Candidato aprovado por revisor independente.')).toBeVisible();
  await expect(page.getByTestId('governance-gate-PROMOTE')).toContainText('4-eyes: approver-lead');

  await page.getByTestId('delegated-command-PROMOTE').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Promover para definição governada' }).click();
  await expect(page.getByText('Candidato promovido para uma nova definição governada.')).toBeVisible();
  await expect(page.getByTestId('governance-gate-PUBLISH_DEFINITION')).toContainText('Autorizado para o principal atual');

  // 4. Publisher / Operator persona: inspect publication readiness, publish definition, verify SLO correlation, rollback, and where-used impact analysis
  await expect(page.getByText('ready_to_publish')).toBeVisible();
  await page.getByRole('button', { name: 'Publicar definição e materializações elegíveis' }).click();
  await expect(page.getByText('Definição publicada; materializações elegíveis foram processadas.')).toBeVisible();

  await expect(page.getByTestId('execution-correlation-summary')).toBeVisible();
  await expect(page.getByTestId('correlation-slo-posture')).toContainText('Saudável (SLO em conformidade)');
  await expect(page.getByTestId('correlation-success-ratio')).toContainText('100% (120)');
  await expect(page.getByTestId('correlation-host-alignment')).toContainText('3/3');
  await expect(page.getByTestId('correlation-bound-receipt')).toContainText('test-run-1');
  await expect(page.getByTestId('correlation-causal-diagnosis')).toContainText('Sem falhas técnicas atribuídas ao snapshot ativo');

  await page.getByRole('button', { name: 'Reverter para esta versão' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reverter para esta versão' }).click();
  await expect(page.getByText('Rollback concluído pelo Config; o catálogo foi recarregado.')).toBeVisible();

  await page.getByTestId('toggle-snapshot-composition').click();
  await expect(page.getByTestId('snapshot-impact-summary')).toBeVisible();
  await expect(page.getByTestId('snapshot-impact-surfaces')).toContainText('human-resources.extraordinary-benefit-requests');
  await expect(page.getByTestId('snapshot-impact-reason-codes')).toContainText('REQUESTED_AMOUNT_EXCEEDS_PROGRAM_LIMIT');
  await expect(page.getByTestId('snapshot-impact-peers')).toContainText('grant.amount-parameters');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);
});

test('renders full en-US corporate workstation, authoring chrome, and snapshot impact analysis without untranslated fallbacks', async ({ page }, testInfo) => {
  await mockGovernedBackend(page, true, true);
  await page.route('**/app-config.json', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      mode: 'remote',
      configApiBaseUrl: '',
      locale: 'en-US',
      projectionPath: '/projections/quickstart-benefit-eligibility.v1.json',
      initialDecisionKey: definition.ruleKey
    })
  }));

  await page.goto('/catalog');
  if (testInfo.project.name === 'narrow') {
    await page.getByRole('button', { name: /O valor solicitado deve respeitar o limite do programa/ }).click();
  }
  await expect(page.getByRole('button', { name: /^Understand/ })).toBeVisible();
  await expect(page.getByTestId('decision-didactic-panel')).toBeVisible();
  await expect(page.getByTestId('didactic-summary')).toContainText('What it checks');
  await expect(page.getByTestId('didactic-when-applies')).toContainText('When it applies');
  await expect(page.getByTestId('didactic-rationale')).toContainText('Why it exists');
  await expect(page.getByTestId('didactic-legal-basis')).toContainText('Legal basis');
  await expect(page.getByTestId('didactic-customization-guidance')).toContainText('How the organization can customize');
  await expect(page.getByTestId('decision-maturity-posture')).toBeVisible();
  await expect(page.getByTestId('posture-technical-maturity')).toContainText('Technical structure and fact catalog verified');
  await expect(page.getByTestId('posture-approval-stage')).toContainText('Approved (4-eyes)');

  await page.getByRole('button', { name: 'Edit rule', exact: true }).click();
  await expect(page.getByTestId('workspace-doc-editor')).toBeVisible();
  await expect(page.getByTestId('workspace-doc-title')).toBeVisible();
  await expect(page.getByTestId('representation-mode-switcher')).toBeVisible();
  await expect(page.getByTestId('representation-mode-tree')).toContainText('Visual tree');
  await expect(page.getByTestId('representation-mode-table')).toContainText('Decision table');
  await expect(page.getByTestId('representation-mode-expression')).toContainText('Domain expression');
  await expect(page.getByTestId('decision-parameters-editor')).toBeVisible();
  await expect(page.getByTestId('operational-policy-effect')).toHaveValue('BLOCK');

  await page.getByRole('button', { name: /^Operate/ }).click();
  await expect(page.getByTestId('governance-gate-summary')).toBeVisible();
  await page.getByTestId('toggle-snapshot-composition').click();
  await expect(page.getByTestId('snapshot-impact-summary')).toBeVisible();
  await expect(page.getByTestId('snapshot-impact-peers')).toContainText('Promoted slot');
  await expect(page.getByTestId('snapshot-impact-peers')).toContainText('BLOCK');
  await expect(page.getByTestId('snapshot-impact-peers')).toContainText('params: maxBenefitAmount');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);
});


test('selects snapshot operation explicitly without inheriting a family head', async ({ page }, testInfo) => {
  const reads: string[] = [];
  await mockGovernedBackend(page, false);
  await page.route('**/api/**/snapshots**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/head/status') || url.pathname.endsWith('/snapshots')) {
      reads.push(url.searchParams.get('operationKey') ?? 'MISSING');
    }
    if (url.pathname.endsWith('/rollouts')) return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ruleSetKey: url.searchParams.get('ruleSetKey'), operationKey: url.searchParams.get('operationKey'), rollouts: [], availableActions: [] }) });
    return route.fallback();
  });
  await page.goto('/catalog');
  if (testInfo.project.name === 'narrow') {
    await page.getByRole('button', { name: /O valor solicitado deve respeitar o limite do programa/ }).click();
  }
  await page.getByRole('button', { name: /^Operar/ }).click();
  const cockpit = page.locator('pax-snapshot-cockpit');
  const selector = cockpit.getByLabel('Operação governada', { exact: true });
  await expect(selector).toHaveValue('');
  await expect(cockpit.getByText('Selecione a operação para consultar seus heads e versões', { exact: true }).last()).toBeVisible();
  expect(reads).toEqual([]);
  expect((await selector.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await selector.click();
  await page.keyboard.press('Escape');
  await selector.selectOption('CREATE');
  await expect.poll(() => reads.filter(operation => operation === 'CREATE').length).toBe(2);
  await selector.selectOption('UPDATE');
  await expect.poll(() => reads.filter(operation => operation === 'UPDATE').length).toBe(2);
  expect(reads).not.toContain('MISSING');
  await expect(cockpit.getByTestId('toggle-snapshot-composition')).toBeDisabled();
  await expect(page.getByTestId('correlation-host-alignment')).toContainText('Evidência de alinhamento indisponível');
  await selector.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await selector.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: testInfo.outputPath('operation-scope.png'), fullPage: false });
});

function preparedAccessRequest() {
  return {
    ruleKey: ' access-document-read ', version: 1, ruleType: 'authorization_policy', status: 'draft',
    resourceKey: ' documents ', serviceKey: ' documents-service ', contextKey: ' ',
    definition: {
      schemaVersion: 'praxis.authorization-policy/v1', policyId: 'access-document-read', version: '1.0.0',
      title: 'Document read', description: 'Review document access', policyPurposes: ['RESOURCE_ACCESS'],
      legalPurpose: 'STATUTORY_LEGAL_OBLIGATION', legalBasisRef: 'test-basis', combiningProfileRef: 'praxis.authorization-combining/v1',
      targets: [{ targetId: 'document', kind: 'EXACT', pointKey: 'resource/documents/read',
        expectedDescriptorDigest: 'sha256:' + 'a'.repeat(64), evaluationModes: ['TARGET'] }],
      factRequirements: [{ factPath: 'subject.principalId', requiredInModes: ['TARGET'] }],
      rules: [{ ruleId: 'read-document', description: 'Restrict document read', evaluationModes: ['TARGET'],
        when: { language: 'praxis-json-logic', profile: 'AUTHORIZATION_TARGET_V1', expression: { '==': [{ var: 'subject.principalId' }, 'review-persona'] } },
        contributions: { access: { authority: 'RESTRICT', effect: 'DENY' }, reasonCode: 'DOCUMENT_RESTRICTED' }, obligations: [] }],
      materializationTargets: [{ targetLayer: 'policy_engine', targetArtifactType: 'opa-policy',
        targetArtifactKey: 'unit:access-document-read:v1', compilerProfileRef: 'praxis.rego-compiler-profile/v1' }]
    },
    parameters: null, governance: { ruleAuthoring: 'review_required', requiredApprovals: ['reviewer'] }
  };
}

test('reviews a prepared ACCESS draft and retries readback without repeating the write', async ({ page }, testInfo) => {
  // Hermetic wire fixture. Its declared digest and effects are never admitted or executed.
  const request = preparedAccessRequest();
  const result = { ...request, ruleKey: 'access-document-read', resourceKey: 'documents', serviceKey: 'documents-service',
    contextKey: null, parameters: {}, id: '66b473f5-9721-45ab-8e3a-0b57503b03e1', createdBy: 'server-principal',
    tenantId: 'test-scope', environment: 'test' };
  await mockGovernedBackend(page, false);
  let writes = 0;
  let reads = 0;
  let probes = 0;
  const token = crypto.randomUUID();
  await page.route('**/auth/session', async route => {
    expect(route.request().method()).toBe('GET');
    probes++;
    if (probes === 1) return route.fulfill({ status: 503 });
    if (probes === 2) return route.fulfill({ status: 401 });
    return route.fulfill({ status: 204, headers: { 'X-XSRF-TOKEN': token } });
  });
  await page.route('**/api/praxis/config/domain-rules/definitions', async route => {
    expect(route.request().method()).toBe('POST');
    expect(await route.request().headerValue('x-xsrf-token')).toBe(token);
    expect(route.request().postDataJSON()).toEqual(request);
    writes++;
    await route.fulfill({ status: 202, json: result });
  });
  await page.route('**/api/praxis/config/domain-rules/definitions/' + result.id, async route => {
    expect(route.request().method()).toBe('GET');
    reads++;
    await route.fulfill(reads === 1 ? { status: 503, json: {} } : { json: reads === 2 ? { ...result, serviceKey: 'unexpected-service' } : result });
  });
  await page.goto('/catalog');
  await page.getByTestId('workspace-track-authorization').click();
  await page.getByText('Revisar rascunho de acesso (ACCESS)', { exact: true }).click();
  const source = page.getByLabel('Requisição JSON de criação da definição');
  const inspect = page.getByRole('button', { name: 'Revisar candidata', exact: true });
  const save = page.getByRole('button', { name: 'Salvar rascunho no Config' });
  for (const invalid of [{ ...request, status: 'active' }, { ...request, tenantId: 'other' },
    { ...request, createdBy: 'asserted-author' }, { ...request, ruleType: 'validation' }]) {
    await source.fill(JSON.stringify(invalid));
    await inspect.click();
    await expect(page.getByText(/Use uma requisição de criação em draft/)).toBeVisible();
    await expect(save).toHaveCount(0);
  }
  await source.fill(JSON.stringify(request));
  await inspect.click();
  await expect(page.getByText('RESTRICT / DENY')).toBeVisible();
  await expect(page.getByText(/DOCUMENT_RESTRICTED/).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('access-draft-review.png') });
  await save.click();
  await expect(page.getByText('Falha ao consultar a sessão do host. Tente salvar novamente.')).toBeVisible();
  expect(writes).toBe(0);
  await save.click();
  await expect(page.getByText('Inicie uma sessão para consultar o catálogo governado.')).toBeVisible();
  expect(writes).toBe(0);
  await save.click();
  await expect(page.getByText('A leitura falhou. Confira o ID e tente ler novamente.')).toBeVisible();
  await expect(save).toHaveCount(0);
  await expect(page.getByLabel('ID da definição no Config')).toHaveValue(result.id);
  await page.getByRole('button', { name: 'Ler rascunho pelo ID' }).click();
  await expect(page.getByText('A definição lida difere da candidata enviada. Confira o registro pelo ID.')).toBeVisible();
  await page.getByRole('button', { name: 'Ler rascunho pelo ID' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Rascunho lido do Config' })).toBeVisible();
  expect({ probes, writes, reads }).toEqual({ probes: 3, writes: 1, reads: 3 });
});

test('browses the scoped PAP catalog and uses the selected mode without changing the ACCESS input', async ({ page }, testInfo) => {
  await mockGovernedBackend(page, false);
  const subject = { factPath: 'subject.principalId', valueType: 'STRING', cardinality: 'SCALAR', presenceModel: 'ALWAYS_PRESENT' };
  const target = { ...subject, factPath: 'resource.sensitivity', presenceModel: 'MAY_BE_ABSENT' };
  const point = {
    pointKey: 'resource/documents/read', resourceKey: 'documents', descriptorDigest: 'sha256:' + 'a'.repeat(64),
    factContractId: 'fc-documents', factContractDigest: 'sha256:' + 'b'.repeat(64),
    factsByMode: { SEARCH: [subject], TARGET: [subject, target] }
  };
  let reads = 0;
  await page.route('**/api/praxis/config/domain-rules/authorization/catalog', async route => {
    expect(route.request().method()).toBe('GET');
    reads++;
    return reads === 1 ? route.fulfill({ status: 403 }) : route.fulfill({
      json: { services: [{ serviceKey: 'documents-service', catalogDigest: 'catalog', decisionPoints: [point] }] }
    });
  });
  await page.goto('/catalog');
  await page.getByTestId('workspace-track-authorization').click();
  await page.getByText('Revisar rascunho de acesso (ACCESS)', { exact: true }).click();
  const source = page.getByLabel('Requisição JSON de criação da definição');
  await source.fill('draft in progress');
  const panel = page.locator('pax-pap-catalog');
  const browse = panel.getByRole('button', { name: 'Consultar pontos de decisão do host' });
  await browse.click();
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(panel.getByRole('combobox')).toHaveCount(0);
  await browse.click();
  await expect(panel.getByLabel('Ponto de decisão admitido')).toHaveValue(point.pointKey);
  await expect(panel.getByRole('list').getByText(subject.factPath)).toBeVisible();
  await panel.getByLabel('Modo de avaliação').selectOption('SEARCH');
  await expect(panel.getByRole('list').getByText(target.factPath)).toHaveCount(0);
  await panel.getByLabel('Modo de avaliação').selectOption('TARGET');
  await expect(panel.getByRole('list').getByText(target.factPath)).toBeVisible();
  await panel.getByText('Referências do contrato e campos do alvo EXACT').click();
  await expect(panel.locator('pre')).toContainText(point.descriptorDigest);
  await expect(panel.locator('pre')).toContainText('TARGET');
  await expect(source).toHaveValue('draft in progress');
  await expect(panel.getByText(point.factContractDigest)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('pap-catalog.png') });
});

test('publishes approved ACCESS and resumes activation and rollback against the observed OPA head', async ({ page }, testInfo) => {
  const definitionId = 'ec2a1f3e-29bb-45b1-baf9-6dd65c56c06c';
  const releaseId = '1484e04f-229e-49ea-93d2-e8af3cb71f9a';
  const releasePath = '/api/praxis/config/domain-rules/authorization/releases';
  const approved = { ...preparedAccessRequest(), ruleKey: 'review-document', id: definitionId, status: 'approved' };
  const initial = { releaseId, definitionId, approvalId: '3e010bd1-e64d-42ad-b80c-48cc38e1e495',
    definitionHash: 'definition-test-hash' };
  const head = { headEtag: 'head-2', compilerProfileVersion: 'v1', opaCapabilitiesDigest: 'capability-digest', runtimeRevision: 'forward-test', instanceId: 'test-opa', activationRevision: 2,
    policySetDigest: 'forward-policy', bundleArtifactDigest: 'forward-bundle' };
  const previous = { ...head, runtimeRevision: 'restore-test', activationRevision: 3,
    policySetDigest: 'previous-policy', bundleArtifactDigest: 'restored-bundle' };
  await mockGovernedBackend(page, false);
  await page.route('**/api/praxis/config/domain-rules/definitions?**', route => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get('status')).toBe('approved');
    expect(params.get('ruleType')).toBe('authorization_policy');
    return route.fulfill({ json: [approved, { ...approved, ruleType: 'validation', id: definition.id },
      { ...approved, status: 'draft', id: definition.id }] });
  });
  const csrf = crypto.randomUUID();
  await page.route('**/auth/session', route => route.fulfill({ status: 204, headers: { 'X-XSRF-TOKEN': csrf } }));
  const operations: string[] = [];
  let activated = false;
  let reverting = false;
  await page.route('**' + releasePath + '**', async route => {
    const req = route.request();
    const suffix = new URL(req.url()).pathname.slice(releasePath.length);
    operations.push(req.method() + ' ' + suffix);
    if (req.method() === 'POST') expect(await req.headerValue('x-xsrf-token')).toBe(csrf);
    if (suffix === '') {
      expect(req.postDataJSON()).toEqual({ definitionId });
      return route.fulfill({ json: { ...initial, state: 'published', current: false, expectedHead: head, observedHead: null } });
    }
    if (suffix === '/' + releaseId + '/activate') {
      const state = activated ? 'active' : 'activating';
      activated = true;
      return route.fulfill({ status: state === 'active' ? 200 : 202,
        json: { ...initial, state, current: true, expectedHead: head, observedHead: state === 'active' ? head : null } });
    }
    if (suffix === '/' + releaseId + '/rollback') {
      if (reverting) return route.fulfill({ json: { ...initial, state: 'reverted', current: true, expectedHead: previous, observedHead: previous } });
      reverting = true;
      return route.fulfill({ status: 503, json: {} });
    }
    expect(req.method()).toBe('GET');
    expect(suffix).toBe('/' + releaseId);
    return route.fulfill({ json: { ...initial, state: 'reverting', current: true, expectedHead: previous, observedHead: null } });
  });
  await page.goto('/catalog');
  await page.getByTestId('workspace-track-authorization').click();
  const panel = page.locator('pax-access-release');
  await panel.locator('summary').click();
  await panel.getByRole('button', { name: 'Carregar definições aprovadas' }).click();
  const options = panel.getByLabel('Definição ACCESS aprovada');
  await expect(options.locator('option')).toHaveCount(2);
  await options.selectOption(definitionId);
  await panel.getByRole('button', { name: 'Publicar release no Config' }).click();
  await expect(panel.getByLabel('ID do release OPA')).toHaveValue(releaseId);
  await expect(panel.getByText('Aguardando observação do runtime.')).toBeVisible();
  const confirm = async (button: string, dialogButton: string) => {
    await panel.getByRole('button', { name: button, exact: true }).click();
    const dialog = panel.getByRole('dialog');
    await expect(dialog.getByText(releaseId)).toBeVisible();
    await dialog.getByRole('button', { name: dialogButton, exact: true }).click();
  };
  await confirm('Ativar release no runtime', 'Ativar release no runtime');
  await expect(panel.getByText(/Confirmação do runtime pendente/)).toBeVisible();
  await confirm('Retomar ativação pendente', 'Ativar release no runtime');
  await expect(panel.getByText('forward-test · test-opa · #2')).toBeVisible();
  await confirm('Reverter release no runtime', 'Reverter release no runtime');
  await expect(panel.getByRole('alert')).toContainText('Consulte o estado pelo ID');
  await panel.getByRole('button', { name: 'Consultar estado no Config' }).click();
  await confirm('Retomar reversão pendente', 'Reverter release no runtime');
  await expect(panel.getByText('restore-test · test-opa · #3')).toBeVisible();
  await expect(panel.getByText('reverted', { exact: true })).toBeVisible();
  expect(operations).toEqual(['POST ', 'POST /' + releaseId + '/activate', 'POST /' + releaseId + '/activate',
    'POST /' + releaseId + '/rollback', 'GET /' + releaseId, 'POST /' + releaseId + '/rollback']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await panel.screenshot({ path: testInfo.outputPath('access-release-observed.png') });
});

test('recovers a currently selected pending ACCESS activation by confirming rollback', async ({ page }) => {
  const releaseId = 'bc4ebbe1-31fb-477d-933a-699a09b7048f';
  const uri = '**/api/praxis/config/domain-rules/authorization/releases/' + releaseId;
  const head = { headEtag: 'base-etag', compilerProfileVersion: 'v1', opaCapabilitiesDigest: 'cap-digest',
    runtimeRevision: 'forward-r2', instanceId: 'opa-test', activationRevision: 2, policySetDigest: 'forward', bundleArtifactDigest: 'bundle' };
  const response = { releaseId, definitionId: '0cba575c-b69c-4b8b-80ab-2e2090fda4e3', definitionHash: 'definition-hash',
    state: 'activating', current: false, expectedHead: head, observedHead: null };
  let reads = 0;
  let rollbacks = 0;
  await mockGovernedBackend(page, false);
  await page.route(uri, route => route.fulfill({ json: { ...response, current: ++reads > 1 } }));
  await page.route(uri + '/rollback', route => {
    expect(route.request().method()).toBe('POST');
    rollbacks++;
    return route.fulfill({ status: 202, json: { ...response, current: true, state: 'reverting',
      expectedHead: { ...head, activationRevision: 3, runtimeRevision: 'restoring-r3' } } });
  });
  await page.goto('/catalog');
  await page.getByTestId('workspace-track-authorization').click();
  const panel = page.locator('pax-access-release');
  await panel.locator('summary').click();
  await panel.getByLabel('ID do release OPA').fill(releaseId);
  const refresh = panel.getByRole('button', { name: 'Consultar estado no Config' });
  const rollbackPending = panel.getByRole('button', { name: 'Reverter ativação pendente' });
  await refresh.click();
  await expect(panel.getByText('activating', { exact: true })).toBeVisible();
  await expect(rollbackPending).toHaveCount(0);
  await refresh.click();
  await rollbackPending.click();
  await panel.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  expect(rollbacks).toBe(0);
  await rollbackPending.click();
  await panel.getByRole('dialog').getByRole('button', { name: 'Reverter release no runtime' }).click();
  await expect(panel.getByText('reverting', { exact: true })).toBeVisible();
  await expect(panel.getByText('Aguardando observação do runtime.')).toBeVisible();
  expect(rollbacks).toBe(1);
});

test('selects a trusted deployment host, clears previous host scope and restores the default projection', async ({ page }, testInfo) => {
  const primary = 'https://primary.example';
  const secondary = 'https://enterprise.example';
  const forbidden = 'https://untrusted.example';
  const projection = '/projections/quickstart-benefit-eligibility.v1.json';
  await mockGovernedBackend(page, false);
  await page.route('**/app-config.json', route => route.fulfill({ json: {
    mode: 'remote', locale: 'pt-BR', configApiBaseUrl: primary, projectionPath: projection,
    hostProfiles: [
      { id: 'primary', labelPtBr: 'Padrão', labelEnUs: 'Default', apiBaseUrl: primary },
      { id: 'enterprise', labelPtBr: 'Corporativo', labelEnUs: 'Enterprise', apiBaseUrl: secondary }
    ]
  } }));
  let projectionReads = 0;
  let catalogCalls = 0;
  let foreignCalls = 0;
  page.on('request', req => {
    if (new URL(req.url()).pathname === projection) projectionReads++;
    if (new URL(req.url()).pathname.endsWith('/definitions/catalog')) catalogCalls++;
    if (req.url().startsWith(forbidden)) foreignCalls++;
  });
  const catalogRequest = (origin: string) => page.waitForRequest(req =>
    req.url().startsWith(origin + '/api/') && new URL(req.url()).pathname.endsWith('/definitions/catalog'));
  await page.goto('/catalog?tenantId=old&apiBaseUrl=' + encodeURIComponent(forbidden));
  await expect(page.getByRole('alert')).toContainText('SETUP_UNTRUSTED_HOST');
  expect(catalogCalls).toBe(0);
  const [first] = await Promise.all([catalogRequest(primary), page.goto('/catalog?tenantId=old')]);
  expect(await first.headerValue('x-tenant-id')).toBe('old');
  const select = page.getByRole('combobox', { name: 'Host governado' });
  await expect(select).toHaveValue('primary');
  await expect(select.locator('option')).toHaveCount(2);
  await expect.poll(() => projectionReads).toBe(1);
  const [next] = await Promise.all([catalogRequest(secondary), select.selectOption('enterprise')]);
  await expect(select).toHaveValue('enterprise');
  expect(await next.headerValue('x-tenant-id')).toBeNull();
  expect(new URL(page.url()).searchParams.has('tenantId')).toBe(false);
  expect(projectionReads).toBe(1);
  await page.getByTestId('workspace-track-authorization').click();
  await expect(page.getByText('Revisar rascunho de acesso (ACCESS)', { exact: true })).toBeVisible();
  const link = new URL(page.url());
  link.searchParams.set('tenantId', 'enterprise-realm');
  link.searchParams.set('organizationId', '123');
  link.searchParams.set('environment', 'stage');
  await Promise.all([catalogRequest(secondary), page.goto(link.href)]);
  for (const anchor of await page.locator('header a').all()) {
    const href = await anchor.getAttribute('href');
    expect(new URL(href!, page.url()).searchParams.toString()).toBe(link.searchParams.toString());
    if (await anchor.isVisible()) await anchor.click();
  }
  const [reloaded] = await Promise.all([catalogRequest(secondary), page.reload()]);
  expect(await reloaded.headerValue('x-tenant-realm')).toBe('enterprise-realm');
  expect(await reloaded.headerValue('x-organization-id')).toBe('123');
  expect(await reloaded.headerValue('x-env')).toBe('stage');
  await expect(select).toHaveValue('enterprise');
  await select.scrollIntoViewIfNeeded();
  await expect(select).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('deployment-host-selection.png') });
  await Promise.all([catalogRequest(primary), select.selectOption('primary')]);
  await expect(select).toHaveValue('primary');
  await expect.poll(() => projectionReads).toBe(2);
  expect(foreignCalls).toBe(0);
});

test('switches operators through logout and login in the same host and realm with renewed CSRF', async ({ page }) => {
  await mockGovernedBackend(page, false);
  let user: 'maker' | 'operator' | null = 'maker';
  const tokens = { maker: 'maker-session-fixture', operator: 'operator-session-fixture' };
  const loggedOut: string[] = [];
  const scopeHints = ['x-tenant-id', 'x-organization-id', 'x-env'];
  let anonymousProbes = 0;
  await page.route('**/auth/session', async route => {
    const sent = await route.request().allHeaders();
    expect(sent['x-tenant-realm']).toBe('test-realm');
    if (!user) {
      anonymousProbes++;
      // The host rejects Config scope hints before session establishment.
      return route.fulfill({ status: scopeHints.some(key => key in sent) ? 403 : 401 });
    }
    for (const key of scopeHints) expect(sent[key]).toBeUndefined();
    return route.fulfill({ status: 204, headers: { 'X-XSRF-TOKEN': tokens[user] } });
  });
  await page.route('**/auth/logout', async route => {
    expect(user).not.toBeNull();
    expect(await route.request().headerValue('x-tenant-realm')).toBe('test-realm');
    for (const key of scopeHints) expect(await route.request().headerValue(key)).toBeNull();
    expect(await route.request().headerValue('x-xsrf-token')).toBe(tokens[user!]);
    loggedOut.push(user!);
    user = null;
    return route.fulfill({ status: 204 });
  });
  await page.route('**/auth/login', async route => {
    expect(user).toBeNull();
    expect(await route.request().headerValue('x-tenant-realm')).toBe('test-realm');
    for (const key of scopeHints) expect(await route.request().headerValue(key)).toBeNull();
    expect(await route.request().headerValue('x-xsrf-token')).toBeNull();
    expect(route.request().postDataJSON().username).toBe('operator');
    user = 'operator';
    return route.fulfill({ status: 204 });
  });
  await page.goto('/catalog?tenantId=test-realm&organizationId=7&environment=stage');
  const logout = page.getByRole('button', { name: 'Encerrar sessão', exact: true });
  await logout.click();
  await page.locator('input[name="username"]').fill('operator');
  await page.locator('input[name="password"]').fill('fixture-only');
  const [catalog] = await Promise.all([
    page.waitForRequest(req => new URL(req.url()).pathname.endsWith('/definitions/catalog')),
    page.locator('form.development-login button[type="submit"]').click()
  ]);
  const sent = await catalog.allHeaders();
  expect(sent['x-tenant-id']).toBe('test-realm');
  expect(sent['x-organization-id']).toBe('7');
  expect(sent['x-env']).toBe('stage');
  await logout.click();
  await expect(page.locator('form.development-login')).toBeVisible();
  expect(anonymousProbes).toBe(1);
  expect(loggedOut).toEqual(['maker', 'operator']);
});

test('creates, validates, persists, reloads, and clears didactic documentation including legalBasis across desktop and narrow viewports', async ({ page }, testInfo) => {
  let createdDefinition: Record<string, unknown> | null = null;
  let savedDocumentation: Record<string, unknown> | null = null;
  let workspaceRevision = workspace.revision;
  let workspaceEtag = workspace.etag;
  const draftPayloads: Array<Record<string, unknown>> = [];
  const createPayloads: Array<Record<string, unknown>> = [];

  await mockGovernedBackend(page, false);

  await page.route('**/api/praxis/config/domain-rules/definitions/catalog*', async route => {
    const candidates: Record<string, unknown>[] = [{
      definitionId: definition.id,
      ruleKey: definition.ruleKey,
      version: definition.version,
      ruleType: 'JSON_LOGIC_DECISION',
      status: definition.status,
      resourceKey: definition.resourceKey,
      serviceKey: definition.serviceKey,
      contextKey: 'benefits',
      semanticOwner: 'benefits-policy',
      updatedAt: '2026-08-16T12:00:00Z'
    }];
    if (createdDefinition) {
      candidates.push({
        definitionId: createdDefinition['id'],
        ruleKey: createdDefinition['ruleKey'],
        version: 1,
        ruleType: createdDefinition['ruleType'],
        status: 'draft',
        resourceKey: createdDefinition['resourceKey'],
        serviceKey: createdDefinition['serviceKey'],
        contextKey: createdDefinition['contextKey'],
        semanticOwner: 'workforce-policy',
        updatedAt: '2026-08-19T12:00:00Z'
      });
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        schemaVersion: 'praxis-domain-rule-catalog.v1',
        page: 0,
        limit: 12,
        hasMore: false,
        candidates
      })
    });
  });

  await page.route('**/api/praxis/config/domain-rules/definitions', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      createPayloads.push(body);
      createdDefinition = {
        id: 'def-created-didactic-1',
        ruleKey: body['ruleKey'],
        version: 1,
        status: 'draft',
        ruleType: body['ruleType'],
        contextKey: body['contextKey'],
        resourceKey: body['resourceKey'],
        serviceKey: body['serviceKey'],
        definition: body['definition'],
        parameters: body['parameters'],
        condition: body['condition'] ?? null,
        governance: body['governance']
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdDefinition)
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/praxis/config/domain-rules/definitions/def-created-didactic-1/facts', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        definitionId: 'def-created-didactic-1',
        ruleKey: 'workforce.leave.max-duration',
        definitionVersion: 1,
        schemaVersion: 'praxis.domain-rule-fact-catalog.v1',
        facts: []
      })
    });
  });

  await page.route('**/api/praxis/config/domain-rules/definitions/def-created-didactic-1', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createdDefinition)
    });
  });

  await page.route('**/api/praxis/config/domain-rules/workspaces', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        ...workspace,
        revision: workspaceRevision,
        etag: workspaceEtag,
        documentation: savedDocumentation
      }])
    });
  });

  await page.route('**/api/praxis/config/domain-rules/workspaces/workspace-1/draft', async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    draftPayloads.push(body);
    expect(route.request().headers()['if-match']).toBe(`"${workspaceEtag}"`);
    const docPayload = body['documentation'];
    if (docPayload && typeof docPayload === 'object' && Object.keys(docPayload as object).length === 0) {
      savedDocumentation = null;
    } else if (docPayload && typeof docPayload === 'object') {
      savedDocumentation = docPayload as Record<string, unknown>;
    }
    workspaceRevision += 1;
    workspaceEtag = `workspace-etag-${workspaceRevision}`;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...workspace,
        revision: workspaceRevision,
        etag: workspaceEtag,
        documentation: savedDocumentation
      })
    });
  });

  await page.goto('/catalog');

  // 1. Create new governed decision with full didactic documentation & legalBasis
  await page.getByTestId('toggle-new-decision').click();
  await page.getByTestId('new-decision-rule-key').fill('workforce.leave.max-duration');
  await page.getByTestId('new-decision-context-key').fill('workforce');
  await page.getByTestId('new-decision-resource-key').fill('workforce.leave-requests');
  await page.getByTestId('new-decision-service-key').fill('workforce-service');

  await page.getByTestId('create-doc-toggle').click();
  await page.getByTestId('create-doc-title').fill('Limite máximo de afastamento');
  await page.getByTestId('create-doc-summary').fill('Garante que o afastamento não ultrapasse 30 dias contínuos.');
  await page.getByTestId('create-doc-when-applies').fill('Ao solicitar novo afastamento operacional.');
  await page.getByTestId('create-doc-rationale').fill('Preserva a continuidade do atendimento.');
  await page.getByTestId('create-doc-customization-guidance').fill('Ajustável pelo órgão dentro da alçada.');
  await page.getByTestId('create-doc-legal-add').click();
  await page.getByTestId('create-doc-legal-code-0').fill('Decreto WF-10/2024');
  await page.getByTestId('create-doc-legal-article-0').fill('Art. 5º');
  await page.getByTestId('create-doc-legal-url-0').fill('https://normas.example.gov/wf-10');

  await page.getByTestId('submit-new-decision').click();
  if (testInfo.project.name === 'narrow') {
    const createdRow = page.getByRole('button', { name: /Limite máximo de afastamento/ });
    await expect(createdRow).toBeVisible();
    await createdRow.click();
  } else {
    await expect(page.getByText('Decisão governada registrada no Config; o catálogo foi recarregado.')).toBeVisible();
  }

  expect(createPayloads).toHaveLength(1);
  expect(createPayloads[0]?.['definition']).toEqual({
    documentation: {
      title: 'Limite máximo de afastamento',
      summary: 'Garante que o afastamento não ultrapasse 30 dias contínuos.',
      whenApplies: 'Ao solicitar novo afastamento operacional.',
      rationale: 'Preserva a continuidade do atendimento.',
      customizationGuidance: 'Ajustável pelo órgão dentro da alçada.',
      legalBasis: [{
        code: 'Decreto WF-10/2024',
        article: 'Art. 5º',
        url: 'https://normas.example.gov/wf-10'
      }]
    }
  });

  await expect(page.getByTestId('decision-didactic-panel')).toBeVisible();
  await expect(page.getByTestId('decision-didactic-fallback')).toHaveCount(0);
  await expect(page.getByTestId('didactic-summary')).toContainText('30 dias contínuos');
  await expect(page.getByTestId('didactic-legal-basis-chip')).toContainText('Decreto WF-10/2024');

  // 2. Switch to existing governed workspace, verify fallback badge, validate rejection, save & reload
  if (testInfo.project.name === 'narrow') {
    await page.getByRole('button', { name: 'Voltar ao catálogo' }).click();
  }
  await page.getByRole('button', { name: /O valor solicitado deve respeitar o limite do programa/ }).click();
  await expect(page.getByTestId('decision-didactic-fallback')).toBeVisible();

  await page.getByRole('button', { name: 'Editar regra', exact: true }).click();
  await expect(page.getByTestId('workspace-doc-editor')).toBeVisible();

  // Trigger validation rejection with unsafe URL
  await page.getByTestId('workspace-doc-legal-add').click();
  await page.getByTestId('workspace-doc-legal-code-0').fill('Portaria WF-99/2025');
  await page.getByTestId('workspace-doc-legal-url-0').fill('javascript:alert(1)');
  await expect(page.getByTestId('workspace-doc-legal-url-error-0')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar draft governado' })).toBeDisabled();

  // Fix URL and fill all 5 didactic fields
  await page.getByTestId('workspace-doc-legal-url-0').fill('https://normas.example.gov/wf-99');
  await page.getByTestId('workspace-doc-title').fill('Teto financeiro de auxílio extraordinário');
  await page.getByTestId('workspace-doc-summary').fill('Verifica se o auxílio respeita o limite financeiro do programa.');
  await page.getByTestId('workspace-doc-when-applies').fill('Na solicitação e revisão de auxílio extraordinário.');
  await page.getByTestId('workspace-doc-rationale').fill('Garante sustentabilidade orçamentária do benefício.');
  await page.getByTestId('workspace-doc-customization-guidance').fill('O órgão pode ajustar o teto via parâmetros no Studio.');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole('button', { name: 'Salvar draft governado' }).click();
  await expect(page.getByText('Draft salvo com controle de concorrência.')).toBeVisible();
  expect(draftPayloads[0]?.['documentation']).toEqual({
    title: 'Teto financeiro de auxílio extraordinário',
    summary: 'Verifica se o auxílio respeita o limite financeiro do programa.',
    whenApplies: 'Na solicitação e revisão de auxílio extraordinário.',
    rationale: 'Garante sustentabilidade orçamentária do benefício.',
    customizationGuidance: 'O órgão pode ajustar o teto via parâmetros no Studio.',
    legalBasis: [{
      code: 'Portaria WF-99/2025',
      url: 'https://normas.example.gov/wf-99'
    }]
  });

  await page.getByRole('button', { name: /^Entender/ }).click();
  await expect(page.getByTestId('decision-didactic-fallback')).toHaveCount(0);
  await expect(page.getByTestId('didactic-summary')).toContainText('limite financeiro do programa');
  await expect(page.getByTestId('didactic-legal-basis-chip').locator('a')).toHaveAttribute('rel', 'noopener noreferrer');

  // 3. Reload page and verify didactic documentation survives reload
  await page.reload();
  if (testInfo.project.name === 'narrow') {
    await page.getByRole('button', { name: /O valor solicitado deve respeitar o limite do programa/ }).click();
  }
  await expect(page.getByTestId('decision-didactic-fallback')).toHaveCount(0);
  await expect(page.getByTestId('didactic-summary')).toContainText('limite financeiro do programa');
  await expect(page.getByTestId('didactic-legal-basis-chip')).toContainText('Portaria WF-99/2025');

  // 4. Clear didactic documentation -> verify {} is sent on PUT draft and fallback badge returns
  await page.getByRole('button', { name: 'Editar regra', exact: true }).click();
  await page.getByTestId('workspace-doc-legal-remove-0').click();
  await page.getByTestId('workspace-doc-title').fill('');
  await page.getByTestId('workspace-doc-summary').fill('');
  await page.getByTestId('workspace-doc-when-applies').fill('');
  await page.getByTestId('workspace-doc-rationale').fill('');
  await page.getByTestId('workspace-doc-customization-guidance').fill('');
  await page.getByRole('button', { name: 'Salvar draft governado' }).click();
  await expect(page.getByText('Draft salvo com controle de concorrência.')).toBeVisible();
  expect(draftPayloads[1]?.['documentation']).toEqual({});

  await page.getByRole('button', { name: /^Entender/ }).click();
  await expect(page.getByTestId('decision-didactic-fallback')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('supports Figma-style progressive workspace shell, Shift+D depth lens, dark theme with zero Axe violations, and orthogonal track switching', async ({ page }, testInfo) => {
  await mockGovernedBackend(page, false);
  await page.goto('/catalog');

  const firstDecision = page.locator('pax-decision-explorer-rail').getByRole('button', { name: /O valor solicitado deve respeitar o limite do programa/ });
  await expect(firstDecision).toBeVisible();

  if (testInfo.project.name !== 'narrow') {
    const viewport = page.viewportSize()!;
    const box = await firstDecision.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  } else {
    await firstDecision.click();
  }

  // Progressive Wikipedia-style term popovers & next-step banner in Light Mode
  await expect(page.getByTestId('decision-next-step-banner')).toBeVisible();
  await expect(page.getByTestId('evaluated-facts-strip')).toBeVisible();
  const headerPillTrigger = page.getByTestId('decision-header-pills').locator('.pax-term-trigger').first();
  await headerPillTrigger.click();
  const openPopoverCard = page.locator('.pax-term-card');
  await expect(openPopoverCard).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(openPopoverCard).toHaveCount(0);

  // Toggle Business <-> Technical depth lens via button and Shift+D shortcut
  await expect(page.locator('.workspace')).toHaveAttribute('data-view-depth', 'business');
  await page.getByTestId('view-depth-technical').click();
  await expect(page.locator('.workspace')).toHaveAttribute('data-view-depth', 'technical');
  await expect(page.getByTestId('technical-lens-banner')).toBeVisible();
  await expect(page.getByTestId('header-technical-code')).toBeVisible();

  await page.keyboard.press('Shift+D');
  await expect(page.locator('.workspace')).toHaveAttribute('data-view-depth', 'business');
  await expect(page.getByTestId('technical-lens-banner')).toHaveCount(0);

  // Switch Inspector tabs and verify AI unavailable diagnosis when endpoint returns 404
  await page.route('**/ai/authoring/turn/stream/start', route => route.fulfill({ status: 404, json: {} }));
  await page.getByTestId('inspector-tab-ai').click();
  await page.getByRole('button', { name: 'Explicar esta decisão' }).click();
  await expect(page.getByText('O serviço de assistente IA de autoria não está habilitado neste host.')).toBeVisible();
  await page.getByTestId('inspector-tab-technical').click();
  await expect(page.getByTestId('inspector-enable-technical-lens')).toBeVisible();

  // Toggle Light <-> Dark theme, verify popover + zero Axe accessibility violations in dark mode
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light-tech');
  await page.getByTestId('studio-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark-tech');
  await headerPillTrigger.click();
  await expect(openPopoverCard).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(openPopoverCard).toHaveCount(0);

  await page.getByTestId('studio-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light-tech');

  // Switch Business Rules <-> Access & Privacy orthogonal track
  await page.getByTestId('workspace-track-authorization').click();
  await expect(page.getByTestId('access-authorization-workspace')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByTestId('back-to-business-track').click();
  await expect(page.getByTestId('access-authorization-workspace')).toHaveCount(0);
  await expect(page.locator('.workspace')).toBeVisible();
});

test('hardens multi-module navigation, Ctrl+K in-route selection, dirty-draft route guard, and responsive sidebar/explorer controls', async ({ page }, testInfo) => {
  let catalogReads = 0;
  const alphaDoc = {
    title: 'Limite financeiro do benefício Alfa',
    summary: 'Regra Alfa para teste multi-módulo.'
  };
  const betaDoc = {
    title: 'Elegibilidade de afastamento Beta',
    summary: 'Regra Beta pendente em elaboração.'
  };
  const alphaDef = {
    id: 'def-alpha-1',
    ruleKey: 'alpha.amount-cap',
    version: 1,
    status: 'approved',
    ruleType: 'JSON_LOGIC_DECISION',
    contextKey: 'benefits',
    resourceKey: 'benefits.alpha',
    serviceKey: 'benefits-service',
    condition: { '<=': [{ var: 'request.requestedAmount' }, 3000] },
    parameters: {
      nullSemantics: 'FAIL_CLOSED',
      operationKeys: ['CREATE'],
      'praxis.domainRuleDocumentation': alphaDoc
    },
    definition: { documentation: alphaDoc },
    documentation: alphaDoc
  };
  const betaDef = {
    id: 'def-beta-1',
    ruleKey: 'beta.eligibility-check',
    version: 1,
    status: 'draft',
    ruleType: 'validation',
    contextKey: 'leave',
    resourceKey: 'leave.beta',
    serviceKey: 'leave-service',
    condition: { '>=': [{ var: 'request.days' }, 1] },
    parameters: {
      nullSemantics: 'FAIL_CLOSED',
      operationKeys: ['CREATE'],
      'praxis.domainRuleDocumentation': betaDoc
    },
    definition: { documentation: betaDoc },
    documentation: betaDoc
  };
  const alphaWorkspace = {
    id: 'ws-alpha-1', ruleKey: alphaDef.ruleKey, status: 'OPEN', revision: 2,
    etag: 'ws-alpha-etag-2', parameters: alphaDef.parameters, condition: alphaDef.condition,
    documentation: alphaDoc,
    updatedAt: '2026-11-23T12:00:00Z'
  };
  const betaWorkspace = {
    id: 'ws-beta-1', ruleKey: betaDef.ruleKey, status: 'OPEN', revision: 1,
    etag: 'ws-beta-etag-1', parameters: betaDef.parameters, condition: betaDef.condition,
    documentation: betaDoc,
    updatedAt: '2026-11-23T12:00:00Z'
  };

  await page.route('**/app-config.json', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      mode: 'remote',
      configApiBaseUrl: '',
      locale: 'pt-BR',
      projectionPath: null,
      initialDecisionKey: alphaDef.ruleKey
    })
  }));
  await page.route('**/auth/session', route => route.fulfill({ status: 204 }));
  await page.route('**/api/**', async route => {
    const reqUrl = new URL(route.request().url());
    const pathname = reqUrl.pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname.endsWith('/definitions/catalog')) {
      catalogReads += 1;
      return json({
        schemaVersion: 'praxis-domain-rule-catalog.v1',
        page: 0,
        limit: 12,
        hasMore: false,
        candidates: [
          {
            definitionId: alphaDef.id, ruleKey: alphaDef.ruleKey, version: 1,
            ruleType: alphaDef.ruleType, status: alphaDef.status,
            contextKey: alphaDef.contextKey, resourceKey: alphaDef.resourceKey,
            serviceKey: alphaDef.serviceKey, semanticOwner: 'benefits-owner', updatedAt: '2026-11-23T12:00:00Z'
          },
          {
            definitionId: betaDef.id, ruleKey: betaDef.ruleKey, version: 1,
            ruleType: betaDef.ruleType, status: betaDef.status,
            contextKey: betaDef.contextKey, resourceKey: betaDef.resourceKey,
            serviceKey: betaDef.serviceKey, semanticOwner: 'leave-owner', updatedAt: '2026-11-23T12:00:00Z'
          }
        ]
      });
    }
    if (pathname.endsWith('/definitions/capabilities')) {
      return json({
        tenantId: 'rio',
        environment: 'stage',
        definitions: [
          { definitionId: alphaDef.id, ruleKey: alphaDef.ruleKey, version: 1, availableActions: ['CREATE_NEW_VERSION'] },
          { definitionId: betaDef.id, ruleKey: betaDef.ruleKey, version: 1, availableActions: ['CREATE_NEW_VERSION'] }
        ]
      });
    }
    if (pathname.endsWith('/definitions')) return json([alphaDef, betaDef]);
    if (pathname.endsWith(`/definitions/${alphaDef.id}`)) return json(alphaDef);
    if (pathname.endsWith(`/definitions/${betaDef.id}`)) return json(betaDef);
    if (pathname.endsWith(`/definitions/${alphaDef.id}/facts`)) {
      return json({
        definitionId: alphaDef.id, ruleKey: alphaDef.ruleKey, definitionVersion: 1,
        schemaVersion: 'praxis.domain-rule-fact-catalog.v1',
        facts: [{
          path: 'request.requestedAmount', valueType: 'number', nullable: false,
          labels: { 'pt-BR': 'Valor solicitado', 'en-US': 'Requested amount' },
          descriptions: { 'pt-BR': 'Valor da solicitação.', 'en-US': 'Requested value.' },
          sensitivity: 'INTERNAL'
        }]
      });
    }
    if (pathname.endsWith(`/definitions/${betaDef.id}/facts`)) {
      return json({
        definitionId: betaDef.id, ruleKey: betaDef.ruleKey, definitionVersion: 1,
        schemaVersion: 'praxis.domain-rule-fact-catalog.v1',
        facts: [{
          path: 'request.days', valueType: 'number', nullable: false,
          labels: { 'pt-BR': 'Quantidade de dias', 'en-US': 'Days count' },
          descriptions: { 'pt-BR': 'Dias informados.', 'en-US': 'Requested days.' },
          sensitivity: 'INTERNAL'
        }]
      });
    }
    if (pathname.endsWith('/parameters')) return json({ schemaVersion: 'praxis.domain-rule-parameters.v1', parameters: [] });
    if (pathname.endsWith('/workspaces')) return json([alphaWorkspace, betaWorkspace]);
    if (pathname.endsWith(`/workspaces/${alphaWorkspace.id}/capabilities`)) {
      return json({ availableActions: ['VIEW', 'SAVE_DRAFT', 'SUBMIT'] });
    }
    if (pathname.endsWith(`/workspaces/${betaWorkspace.id}/capabilities`)) {
      return json({ availableActions: ['VIEW', 'SAVE_DRAFT', 'SUBMIT'] });
    }
    if (pathname.endsWith('/lifecycle')) return json({ workspaceId: null, latestTestRun: null, testRuns: [], reviews: [] });
    if (pathname.endsWith('/scenarios')) return json([]);
    if (pathname.endsWith('/snapshots/head/status') || pathname.endsWith('/rollouts') || pathname.endsWith('/rollout-policies')) {
      return json({ availableActions: [] });
    }
    if (pathname.endsWith('/snapshots') || pathname.endsWith('/reviews') || pathname.endsWith('/timeline')) return json([]);
    return route.fallback();
  });

  // 1. Arrive via host deep-link with scope params
  await page.goto('/catalog?resourceKey=benefits.alpha&tenantId=rio&organizationId=ALL&environment=stage');
  await expect(page.locator('#decision-title')).toHaveText('Limite financeiro do benefício Alfa');
  expect(catalogReads).toBe(1);

  // Environment menu popover opens cleanly and closes on Escape
  await page.getByTestId('studio-environment-trigger').click();
  await expect(page.getByTestId('studio-environment-popover')).toBeVisible();
  await expect(page.getByTestId('studio-environment-popover')).toContainText('rio');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('studio-environment-popover')).toHaveCount(0);

  // 2. Navigate to Overview via sidebar: deep-link params stripped, environment params preserved
  await page.getByTestId('nav-module-overview').click();
  await expect(page.getByTestId('catalog-portfolio-overview')).toBeVisible();
  const overviewUrl = new URL(page.url());
  expect(overviewUrl.pathname).toBe('/overview');
  expect(overviewUrl.searchParams.get('tenantId')).toBe('rio');
  expect(overviewUrl.searchParams.get('organizationId')).toBe('ALL');
  expect(overviewUrl.searchParams.get('environment')).toBe('stage');
  expect(overviewUrl.searchParams.has('resourceKey')).toBe(false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Open Beta rule directly from Overview without being clobbered back to Alpha deep-link
  await page.getByTestId('portfolio-queue-item-beta.eligibility-check').click();
  await expect(page.locator('#decision-title')).toHaveText('Elegibilidade de afastamento Beta');

  // 3. Navigate to Reviews queue, refresh explicitly, search and open Beta in Rule mode
  await page.getByTestId('nav-module-reviews').click();
  await expect(page.getByTestId('reviews-page')).toBeVisible();
  await page.getByTestId('reviews-refresh-btn').click();
  expect(catalogReads).toBe(2);
  await page.getByTestId('reviews-search-input').fill('afastamento Beta');
  await expect(page.getByTestId('reviews-item-beta.eligibility-check')).toBeVisible();
  await expect(page.getByTestId('reviews-item-alpha.amount-cap')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByTestId('reviews-open-beta.eligibility-check').click();
  await expect(page.locator('#decision-title')).toHaveText('Elegibilidade de afastamento Beta');
  await expect(page.locator('.decision-navigation').getByRole('button', { name: /^Regra/ })).toHaveAttribute('aria-current', 'page');

  // 4. Ctrl+K decision switch INSIDE /catalog must update both title and capabilities/facts
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('command-palette-dialog')).toBeVisible();
  await page.getByTestId('command-palette-input').fill('benefício Alfa');
  await page.keyboard.press('Enter');
  await expect(page.locator('#decision-title')).toHaveText('Limite financeiro do benefício Alfa');
  await expect(page.getByTestId('decision-subtitle')).toHaveCount(0);

  // 5. Dirty draft protection on module route leave (canDeactivate)
  await page.getByRole('button', { name: 'Editar regra', exact: true }).click();
  await expect(page.locator('.draft-workspace')).toBeVisible();
  await page.locator('.draft-workspace').getByRole('spinbutton', { name: 'Valor' }).fill('2800');
  await expect(page.locator('.draft-workspace .draft-compare section.changed')).toBeVisible();
  await page.getByTestId('nav-module-overview').click();
  await expect(page.getByRole('button', { name: 'Continuar editando', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar editando', exact: true }).click();
  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.locator('.draft-workspace').getByRole('spinbutton', { name: 'Valor' })).toHaveValue('2800');

  await page.getByTestId('nav-module-overview').click();
  await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await expect(page.getByTestId('catalog-portfolio-overview')).toBeVisible();
  await expect(page).toHaveURL(/\/overview/);

  // 6. Desktop rail collapse checks + narrow viewport overflow guard
  await page.getByTestId('workspace-track-business').click();
  if (testInfo.project.name === 'desktop') {
    await page.getByTestId('studio-sidebar-toggle').click();
    await expect(page.getByTestId('nav-badge-dot-reviews')).toBeVisible();
    await page.getByTestId('studio-sidebar-toggle').click();
    await page.getByTestId('explorer-filters-toggle').click();
    await expect(page.getByTestId('explorer-filters-panel')).toBeVisible();
    await page.getByTestId('explorer-collapse-btn').click();
    await page.getByTestId('inspector-collapse-btn').click();
    await expect(page.locator('.workspace.explorer-collapsed.inspector-collapsed')).toBeVisible();
    await page.getByTestId('studio-toggle-explorer').click();
    await page.getByTestId('studio-toggle-inspector').click();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('scopes evaluated facts with rich popovers and navigates 5-stage pipeline without tall empty towers', async ({ page }) => {
  const mkRuleDef = (idx: number, stage: 'PROTECTED_GUARD' | 'DOMAIN_DECISION', overridePolicy: 'FORBIDDEN' | 'PARAMETERIZABLE') => ({
    id: `def-stage-${idx}`,
    ruleKey: `benefits.stage-rule-${idx}`,
    version: 1,
    status: 'approved',
    ruleType: 'validation',
    contextKey: 'benefits',
    resourceKey: 'benefits.requests',
    serviceKey: 'benefits-service',
    condition: stage === 'PROTECTED_GUARD'
      ? { '<=': [{ var: 'draft.dtini' }, { var: 'employment.dtvac' }] }
      : { '<=': [{ var: 'draft.amount' }, 5000] },
    parameters: {
      nullSemantics: 'FAIL_CLOSED',
      operationKeys: ['CREATE'],
      'praxis.domainRuleDocumentation': {
        title: `Regra estruturada ${idx}`,
        summary: `Validação ${idx} para etapa ${stage}.`
      }
    },
    definition: {
      ruleSetKey: 'benefits.requests',
      slotKey: `slot_${idx}`,
      decisionStage: stage,
      overridePolicy,
      requiredFactPaths: ['draft.dtini', 'employment.dtvac', 'draft.amount', 'neighborhood.history'],
      documentation: {
        title: `Regra estruturada ${idx}`,
        summary: `Validação ${idx} para etapa ${stage}.`
      }
    }
  });

  const defs = [
    mkRuleDef(1, 'PROTECTED_GUARD', 'FORBIDDEN'),
    ...Array.from({ length: 8 }, (_, idx) => mkRuleDef(idx + 2, 'DOMAIN_DECISION', 'PARAMETERIZABLE'))
  ];

  const factCatalogBody = (defId: string, ruleKey: string) => ({
    definitionId: defId,
    ruleKey,
    definitionVersion: 1,
    schemaVersion: 'praxis.domain-rule-fact-catalog.v1',
    facts: [
      {
        path: 'draft.dtini',
        valueType: 'date',
        nullable: true,
        labels: { 'pt-BR': 'draft: dtini', 'en-US': 'draft: dtini' },
        descriptions: { 'pt-BR': 'Data de início da solicitação. Orientação operacional: Deve ser igual ou posterior ao ingresso.' },
        providerRef: 'benefits.request',
        evidenceRefs: [],
        sensitivity: 'NON_SENSITIVE',
        redaction: 'NONE'
      },
      {
        path: 'employment.dtvac',
        valueType: 'date',
        nullable: true,
        labels: { 'pt-BR': 'vinculo: dtvac', 'en-US': 'employment: vacDate' },
        descriptions: { 'pt-BR': 'Data de encerramento do vínculo.' },
        groupLabels: { 'pt-BR': 'Vínculo', 'en-US': 'Employment' },
        providerRef: 'workforce.employment',
        evidenceRefs: [],
        sensitivity: 'PERSONAL',
        redaction: 'MASK'
      },
      {
        path: 'draft.amount',
        valueType: 'number',
        nullable: false,
        labels: { 'pt-BR': 'Valor solicitado', 'en-US': 'Requested amount' },
        descriptions: { 'pt-BR': 'Quantia solicitada no pedido.' },
        providerRef: 'benefits.request',
        evidenceRefs: [],
        sensitivity: 'NON_SENSITIVE',
        redaction: 'NONE'
      },
      {
        path: 'neighborhood.history',
        valueType: 'string-array',
        nullable: true,
        labels: { 'pt-BR': 'neighborhood: historicoAnterior', 'en-US': 'neighborhood: priorHistory' },
        descriptions: { 'pt-BR': 'Fato de avaliação do RuleSet benefits.requests (neighborhood.history).' },
        providerRef: 'benefits.neighborhood',
        evidenceRefs: [],
        sensitivity: 'NON_SENSITIVE',
        redaction: 'NONE'
      }
    ]
  });

  await page.route('**/app-config.json', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      mode: 'remote',
      configApiBaseUrl: '',
      locale: 'pt-BR',
      projectionPath: null,
      initialDecisionKey: defs[0]!.ruleKey
    })
  }));
  await page.route('**/auth/session', route => route.fulfill({ status: 204 }));
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname.endsWith('/definitions/catalog')) {
      return json({
        schemaVersion: 'praxis-domain-rule-catalog.v1',
        page: 0,
        limit: 12,
        hasMore: false,
        candidates: defs.map(def => ({
          definitionId: def.id,
          ruleKey: def.ruleKey,
          version: def.version,
          ruleType: def.ruleType,
          status: def.status,
          contextKey: def.contextKey,
          resourceKey: def.resourceKey,
          serviceKey: def.serviceKey,
          semanticOwner: 'benefits-owner',
          updatedAt: '2026-11-23T12:00:00Z'
        }))
      });
    }
    if (pathname.endsWith('/definitions/capabilities')) {
      return json({ tenantId: 'rio', environment: 'local', definitions: [] });
    }
    if (pathname.endsWith('/definitions')) return json(defs);
    for (const def of defs) {
      if (pathname.endsWith(`/definitions/${def.id}`)) return json(def);
      if (pathname.endsWith(`/definitions/${def.id}/facts`)) return json(factCatalogBody(def.id, def.ruleKey));
    }
    if (pathname.endsWith('/parameters')) return json({ schemaVersion: 'praxis.domain-rule-parameters.v1', parameters: [] });
    if (pathname.endsWith('/workspaces')) return json([]);
    if (pathname.endsWith('/lifecycle')) return json({ workspaceId: null, latestTestRun: null, testRuns: [], reviews: [] });
    if (pathname.endsWith('/scenarios')) return json([]);
    if (pathname.endsWith('/snapshots/head/status') || pathname.endsWith('/rollouts') || pathname.endsWith('/rollout-policies')) {
      return json({ availableActions: [] });
    }
    if (pathname.endsWith('/snapshots') || pathname.endsWith('/reviews') || pathname.endsWith('/timeline')) return json([]);
    return route.fallback();
  });

  await page.goto('/catalog?resourceKey=benefits.requests');
  await expect(page.locator('#decision-title')).toHaveText('Regra estruturada 1');

  // 1. Scoped evaluated facts (2 of 4) grouped without raw prefix/nullable leaks
  const factsStrip = page.getByTestId('evaluated-facts-strip');
  await expect(factsStrip).toBeVisible();
  await expect(factsStrip.getByTestId('evaluated-facts-scope-badge')).toContainText('2 de 4 dados da operação');
  await expect(factsStrip).toContainText('Dados do registro');
  await expect(factsStrip).toContainText('Vínculo');
  await expect(factsStrip).not.toContainText('Histórico Anterior');

  // Open chip popover and confirm rich hint + Opcional (never "nullable" or "Path:")
  await factsStrip.locator('.pax-term-trigger').first().click();
  const popover = page.locator('.pax-term-card');
  await expect(popover).toBeVisible();
  await expect(popover).toContainText('Orientação');
  await expect(popover).toContainText('Deve ser igual ou posterior ao ingresso.');
  await expect(popover).toContainText('Opcional');
  await expect(popover).not.toContainText('nullable');
  await expect(popover).not.toContainText('Path:');
  await page.keyboard.press('Escape');

  // Expand remaining catalog facts on demand
  await factsStrip.getByTestId('evaluated-facts-catalog-toggle').click();
  await expect(factsStrip.getByTestId('evaluated-facts-catalog-panel')).toBeVisible();
  await expect(factsStrip.getByTestId('evaluated-facts-catalog-panel')).toContainText('Histórico Anterior');

  // 2. Interactive 5-stage horizontal stepper & focused stage panel
  const dag = page.getByTestId('rule-decision-plan-dag');
  await expect(dag.getByTestId('dag-focused-stage-panel')).toBeVisible();
  await expect(dag.getByTestId('dag-causal-subtitle')).toContainText('Etapa 1 de 5 · Pré-requisitos obrigatórios');

  // Stage 02 has 8 rules: capped at 6 initially with expand button + jump-back CTA
  await dag.getByTestId('dag-stage-DOMAIN_DECISION').click();
  await expect(dag.getByTestId('dag-focused-stage-panel').locator('.dag-node')).toHaveCount(6);
  await expect(dag.getByTestId('dag-jump-current-stage')).toBeVisible();
  await dag.getByTestId('dag-stage-expand-btn').click();
  await expect(dag.getByTestId('dag-focused-stage-panel').locator('.dag-node')).toHaveCount(8);

  // Stage 04 is empty: renders compact empty banner without tall tower
  await dag.getByTestId('dag-stage-TRANSFORMATION_INTENT').click();
  await expect(dag.getByTestId('dag-focused-empty-stage')).toBeVisible();
  await dag.getByTestId('dag-jump-current-stage').click();
  await expect(dag.getByTestId('dag-node-benefits.stage-rule-1')).toBeVisible();

  // Switch to all-stages view cleanly
  await dag.getByTestId('dag-view-all').click();
  await expect(dag.getByTestId('dag-all-stages-panel')).toBeVisible();
  await dag.getByTestId('dag-view-focused').click();

  // 3. Switch to 02 Regra and check scoped cards + collapsed remaining facts
  await page.locator('.decision-navigation').getByRole('button', { name: /^Regra/ }).click();
  await expect(page.locator('#decision-rule .rule-facts-col > section > .fact-cards > .fact-card')).toHaveCount(2);
  const otherDisclosure = page.getByTestId('rule-other-catalog-facts');
  await expect(otherDisclosure).toBeVisible();
  await expect(otherDisclosure).not.toHaveAttribute('open', '');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('Fase C rule terminology, zero-"?" expression formatting, and focused edit mode on desktop and narrow', async ({ page }, testInfo) => {
  const compoundCondition = {
    and: [
      {
        or: [
          { '!': [{ '==': [{ var: 'scheduleCode.requireEntryExit' }, true] }] },
          { and: [{ '!=': [{ var: 'draft.entryTime' }, null] }, { '!=': [{ var: 'draft.exitTime' }, null] }] }
        ]
      },
      {
        '>=': [
          {
            '+': [
              { '*': [{ toNumber: [{ substr: [{ var: 'draft.exitTime' }, 0, 2] }] }, 60] },
              { toNumber: [{ substr: [{ var: 'draft.exitTime' }, 3, 2] }] }
            ]
          },
          {
            '+': [
              { '*': [{ toNumber: [{ substr: [{ var: 'draft.entryTime' }, 0, 2] }] }, 60] },
              { toNumber: [{ substr: [{ var: 'draft.entryTime' }, 3, 2] }] }
            ]
          }
        ]
      }
    ]
  };
  const editableCondition = {
    or: [
      { '===': [{ coalesce: [{ var: 'draft.requestedAmount' }, null] }, null] },
      { '<=': [{ var: 'draft.requestedAmount' }, 3000] }
    ]
  };

  const timeDoc = {
    title: 'Janela de entrada e saída',
    summary: 'Quando a modalidade exige horário, saída deve ser maior ou igual à entrada.'
  };
  const amountDoc = {
    title: 'Limite de valor solicitado',
    summary: 'Garante que o valor não exceda o teto do benefício.'
  };

  const defs = [
    {
      id: 'def-phase-c-complex',
      ruleKey: 'benefits.requests.time-window',
      version: 1,
      ruleType: 'validation',
      status: 'DRAFT',
      contextKey: 'benefits.requests',
      resourceKey: 'benefits.requests',
      serviceKey: 'benefits-service',
      priority: 10,
      condition: compoundCondition,
      parameters: {
        ruleKey: 'benefits.requests.time-window',
        reasonCode: 'INVALID_TIME_WINDOW',
        nullSemantics: 'FAIL_CLOSED',
        operationKeys: ['CREATE'],
        'praxis.domainRuleDocumentation': timeDoc
      },
      definition: { documentation: timeDoc },
      documentation: timeDoc,
      governance: { lifecycleBoundary: 'REFERENCE_DRAFT_ONLY' }
    },
    {
      id: 'def-phase-c-editable',
      ruleKey: 'benefits.requests.max-amount',
      version: 1,
      ruleType: 'validation',
      status: 'DRAFT',
      contextKey: 'benefits.requests',
      resourceKey: 'benefits.requests',
      serviceKey: 'benefits-service',
      priority: 20,
      condition: editableCondition,
      parameters: {
        ruleKey: 'benefits.requests.max-amount',
        reasonCode: 'MAX_AMOUNT_EXCEEDED',
        nullSemantics: 'FAIL_CLOSED',
        operationKeys: ['CREATE'],
        'praxis.domainRuleDocumentation': amountDoc
      },
      definition: { documentation: amountDoc },
      documentation: amountDoc,
      governance: { lifecycleBoundary: 'REFERENCE_DRAFT_ONLY' }
    }
  ];

  await page.route('**/app-config.json', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      mode: 'remote',
      configApiBaseUrl: '',
      locale: 'pt-BR',
      projectionPath: null,
      initialDecisionKey: 'benefits.requests.time-window'
    })
  }));
  await page.route('**/auth/session', route => route.fulfill({ status: 204 }));
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname.endsWith('/definitions/catalog')) {
      return json({
        schemaVersion: 'praxis-domain-rule-catalog.v1',
        page: 0,
        limit: 12,
        hasMore: false,
        candidates: defs.map(def => ({
          definitionId: def.id,
          ruleKey: def.ruleKey,
          version: def.version,
          ruleType: def.ruleType,
          status: def.status,
          contextKey: def.contextKey,
          resourceKey: def.resourceKey,
          serviceKey: def.serviceKey,
          semanticOwner: 'benefits-owner',
          updatedAt: '2026-11-24T05:00:00Z'
        }))
      });
    }
    if (pathname.endsWith('/definitions/capabilities')) {
      return json({
        tenantId: 'rio',
        environment: 'local',
        definitions: defs.map(def => ({
          definitionId: def.id,
          ruleKey: def.ruleKey,
          version: def.version,
          availableActions: ['VIEW']
        }))
      });
    }
    if (pathname.endsWith('/definitions')) return json(defs);
    for (const def of defs) {
      if (pathname.endsWith(`/definitions/${def.id}`)) return json(def);
    }
    if (pathname.endsWith('/def-phase-c-complex/facts')) {
      return json({
        definitionId: 'def-phase-c-complex',
        ruleKey: 'benefits.requests.time-window',
        definitionVersion: 1,
        schemaVersion: 'praxis.domain-rule-fact-catalog.v1',
        facts: [
          {
            path: 'scheduleCode.requireEntryExit',
            valueType: 'boolean',
            nullable: true,
            labels: { 'pt-BR': 'Exige Horário', 'en-US': 'Requires schedule' },
            descriptions: { 'pt-BR': 'Indica se a modalidade exige hora de entrada e saída.' },
            providerRef: 'benefits.catalog',
            evidenceRefs: [],
            sensitivity: 'NON_SENSITIVE',
            redaction: 'NONE'
          },
          {
            path: 'draft.entryTime',
            valueType: 'string',
            nullable: true,
            labels: { 'pt-BR': 'Hora Entrada', 'en-US': 'Entry time' },
            descriptions: { 'pt-BR': 'Hora inicial informada.' },
            providerRef: 'benefits.request',
            evidenceRefs: [],
            sensitivity: 'NON_SENSITIVE',
            redaction: 'NONE'
          },
          {
            path: 'draft.exitTime',
            valueType: 'string',
            nullable: true,
            labels: { 'pt-BR': 'Hora Saída', 'en-US': 'Exit time' },
            descriptions: { 'pt-BR': 'Hora final informada.' },
            providerRef: 'benefits.request',
            evidenceRefs: [],
            sensitivity: 'NON_SENSITIVE',
            redaction: 'NONE'
          }
        ]
      });
    }
    if (pathname.endsWith('/def-phase-c-editable/facts')) {
      return json({
        definitionId: 'def-phase-c-editable',
        ruleKey: 'benefits.requests.max-amount',
        definitionVersion: 1,
        schemaVersion: 'praxis.domain-rule-fact-catalog.v1',
        facts: [
          {
            path: 'draft.requestedAmount',
            valueType: 'number',
            nullable: false,
            labels: { 'pt-BR': 'Valor Solicitado', 'en-US': 'Requested amount' },
            descriptions: { 'pt-BR': 'Valor informado na solicitação.' },
            providerRef: 'benefits.request',
            evidenceRefs: [],
            sensitivity: 'NON_SENSITIVE',
            redaction: 'NONE'
          }
        ]
      });
    }
    if (pathname.endsWith('/parameters')) return json({ schemaVersion: 'praxis.domain-rule-parameters.v1', parameters: [] });
    if (pathname.endsWith('/workspaces')) {
      return json([
        {
          id: 'ws-phase-c-editable',
          ruleKey: 'benefits.requests.max-amount',
          baseDefinitionId: 'def-phase-c-editable',
          status: 'OPEN',
          revision: 1,
          etag: 'etag-c-1',
          condition: editableCondition,
          parameters: defs[1]!.parameters,
          documentation: amountDoc,
          availableActions: ['VIEW', 'UPDATE_DRAFT']
        }
      ]);
    }
    if (pathname.endsWith('/workspaces/ws-phase-c-editable/capabilities')) {
      return json({
        workspaceId: 'ws-phase-c-editable',
        ruleKey: 'benefits.requests.max-amount',
        status: 'OPEN',
        revision: 1,
        etag: 'etag-c-1',
        availableActions: ['VIEW', 'UPDATE_DRAFT'],
        blockers: []
      });
    }
    if (pathname.endsWith('/lifecycle')) return json({ workspaceId: 'ws-phase-c-editable', latestTestRun: null, testRuns: [], reviews: [] });
    if (pathname.endsWith('/scenarios')) return json([]);
    if (pathname.endsWith('/snapshots/head/status') || pathname.endsWith('/rollouts') || pathname.endsWith('/rollout-policies')) {
      return json({ availableActions: [] });
    }
    if (pathname.endsWith('/snapshots') || pathname.endsWith('/reviews') || pathname.endsWith('/timeline')) return json([]);
    return route.fallback();
  });

  await page.goto('/catalog?resourceKey=benefits.requests');
  await expect(page.locator('#decision-title')).toHaveText('Janela de entrada e saída');

  // Switch to 02 Regra and check Option A terminology + zero-"?" compound expression
  await page.locator('.decision-navigation').getByRole('button', { name: /^Regra/ }).click();
  await expect(page.locator('#decision-rule')).not.toContainText('JSON Logic');
  const disclosure = page.getByTestId('rule-expression-disclosure');
  await expect(disclosure.locator('summary')).toHaveText('Ver critério lógico completo');
  await disclosure.locator('summary').click();
  const formattedBusiness = page.getByTestId('rule-formatted-expression');
  await expect(formattedBusiness).toBeVisible();
  await expect(formattedBusiness).not.toContainText('?');
  await expect(formattedBusiness).toContainText('minutos(Hora Saída) ≥ minutos(Hora Entrada)');

  // Toggle Technical Mode and confirm header + raw expression without "?"
  await page.getByTestId('view-depth-technical').click();
  await expect(disclosure.locator('summary')).toHaveText('Expressão lógica da decisão');
  await expect(formattedBusiness).not.toContainText('?');
  await expect(formattedBusiness).toContainText('toNumber(substr(draft.exitTime, 0, 2)) * 60');
  await page.getByTestId('view-depth-business').click();

  // Select editable rule and enter Focused Edit Mode
  if (testInfo.project.name === 'narrow') {
    await page.locator('.narrow-back').click();
  }
  await page.locator('pax-decision-explorer-rail').getByRole('button', { name: /Limite de valor solicitado/ }).click();
  await page.locator('.decision-navigation').getByRole('button', { name: /^Regra/ }).click();
  await page.getByRole('button', { name: 'Editar regra', exact: true }).click();

  const draftBox = await page.locator('.draft-workspace').boundingBox();
  const ruleRefBox = await page.locator('#decision-rule').boundingBox();
  expect(draftBox).not.toBeNull();
  expect(ruleRefBox).not.toBeNull();
  expect(draftBox!.y).toBeLessThan(ruleRefBox!.y);

  await expect(page.getByTestId('draft-focused-badge')).toBeVisible();
  await expect(page.getByTestId('draft-sticky-footer')).toBeVisible();
  await expect(page.getByTestId('fact-redaction-summary')).toBeVisible();

  await page.getByTestId('representation-mode-table').click();
  await expect(page.getByTestId('decision-table-operator-0').locator('option:checked')).toHaveText('menor ou igual a (≤)');

  await page.getByTestId('representation-mode-expression').click();
  await expect(page.getByTestId('decision-domain-expression')).toContainText('Valor Solicitado ≤ 3000');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('aligns 03 Testar, 04 Operar, 05 Histórico, and /access with Business/Technical lens, container responsiveness, and Light/Dark WCAG AA', async ({ page }, testInfo) => {
  await mockGovernedBackend(page, false);
  await page.route('**/api/**', async route => {
    const req = route.request();
    const pathname = new URL(req.url()).pathname;
    const json = (value: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });

    if (pathname.endsWith(`/definitions/${definition.id}/facts`)) {
      return json({
        definitionId: definition.id,
        ruleKey: definition.ruleKey,
        definitionVersion: definition.version,
        schemaVersion: 'praxis.domain-rule-fact-catalog.v1',
        facts: [
          {
            path: 'request.requestedAmount',
            valueType: 'number',
            nullable: false,
            labels: { 'pt-BR': 'Valor solicitado', 'en-US': 'Requested amount' },
            descriptions: { 'pt-BR': 'Valor informado na solicitação.', 'en-US': 'Amount supplied by the request.' },
            providerRef: 'quickstart.extraordinary-benefit-request',
            evidenceRefs: ['quickstart://extraordinary-benefit/requested-amount'],
            sensitivity: 'SENSITIVE',
            redaction: 'MASK'
          },
          {
            path: 'neighborhood: previousRequests',
            valueType: 'number',
            nullable: true,
            labels: { 'pt-BR': 'Solicitações anteriores', 'en-US': 'Previous requests' },
            descriptions: { 'pt-BR': 'Fato de avaliação do RuleSet benefits-rules (v1).' },
            providerRef: 'quickstart.extraordinary-benefit-request.history',
            evidenceRefs: [],
            sensitivity: 'NON_SENSITIVE',
            redaction: 'NONE'
          }
        ]
      });
    }
    if (pathname.endsWith(`/definitions/${definition.id}/timeline`)) {
      return json({
        events: [
          {
            eventType: 'WORKSPACE_CREATED',
            occurredAt: '2026-10-21T15:30:00Z',
            summary: 'Workspace aberto para ajuste do teto',
            status: 'OPEN',
            actor: 'author-1'
          },
          {
            eventType: 'TEST_RUN_RECORDED',
            occurredAt: '2026-10-21T16:10:00Z',
            summary: 'Bateria sandbox validada',
            status: 'PASSED',
            actor: 'author-1'
          }
        ]
      });
    }
    if (pathname.endsWith('/workspaces/workspace-1/reviews') && req.method() === 'GET') {
      return json([
        {
          id: 'rev-d-1',
          workspaceId: 'workspace-1',
          workspaceRevision: 4,
          reviewerRef: 'approver-lead',
          decision: 'APPROVE',
          rationale: 'Aprovado após verificação do limite.',
          reviewedAt: '2026-10-21T17:00:00Z'
        }
      ]);
    }
    if (pathname.endsWith('/snapshots/head/status')) {
      return json({
        ruleSetKey: 'quickstart.extraordinary-benefit.eligibility',
        operationKey: 'CREATE',
        activeSnapshotKey: 'snapshot-active-002',
        ruleSetVersion: 2,
        publicationRevision: 2,
        activationRevision: 3,
        headEtag: '"head-phase-d"',
        executionReady: true,
        governanceState: 'READY'
      });
    }
    if (pathname.endsWith('/execution-summary')) {
      return json({
        snapshotKey: 'snapshot-active-002',
        totalObservations: 10,
        distinctHosts: 2,
        firstObservedAtUtc: '2026-10-21T14:00:00Z',
        lastObservedAtUtc: '2026-10-21T17:00:00Z',
        outcomeCounts: {
          ALLOW: 8,
          DENY: 2,
          NOT_APPLICABLE: 0,
          INCONCLUSIVE: 0,
          TECHNICAL_ERROR: 0
        }
      });
    }
    return route.fallback();
  });

  await page.goto('/catalog');
  if (testInfo.project.name === 'narrow') {
    await page.getByRole('button', { name: /O valor solicitado deve respeitar o limite do programa/ }).click();
  }

  // 1. 03 Testar: scoped fact partition, clean labels, and sandbox KPI summary strip
  await page.locator('.decision-navigation').getByRole('button', { name: /^Testar/ }).click();
  await expect(page.getByRole('spinbutton', { name: 'Valor solicitado' })).toBeVisible();
  const otherFacts = page.getByTestId('scenario-other-facts');
  await expect(otherFacts).toBeVisible();
  await expect(otherFacts).toContainText('Outros dados disponíveis na operação (1)');

  await page.getByRole('button', { name: 'Comparar com a versão ativa' }).click();
  const summaryStrip = page.getByTestId('sandbox-summary-strip');
  await expect(summaryStrip).toBeVisible();
  await expect(summaryStrip).toContainText('2 cenários');

  // 2. 04 Operar: Business vs Technical lens across gates, reviews, and snapshot outcomes
  await page.locator('.decision-navigation').getByRole('button', { name: /^Operar/ }).click();
  await expect(page.getByTestId('governance-gate-REVIEW')).toContainText('Revisão independente (4-olhos)');
  await expect(page.locator('.review-list')).toContainText('Aprovado');
  await expect(page.locator('.review-list')).not.toContainText('2026-10-21T17:00:00Z');

  const cockpit = page.locator('pax-snapshot-cockpit');
  await cockpit.getByLabel('Operação governada', { exact: true }).selectOption('CREATE');
  await expect(cockpit.locator('.outcome-strip [data-outcome="ALLOW"]')).toContainText('Permitida');

  await page.getByTestId('view-depth-technical').click();
  await expect(page.getByTestId('governance-gate-REVIEW')).toContainText('REVIEW');
  await expect(page.locator('.review-list')).toContainText('APPROVE');
  await expect(page.locator('.review-list')).toContainText('2026-10-21T17:00:00Z');
  await expect(cockpit.locator('.outcome-strip [data-outcome="ALLOW"]')).toContainText('ALLOW');
  await page.getByTestId('view-depth-business').click();

  // 3. 05 Histórico: humanized timeline event pills and localized timestamps without overflow
  await page.locator('.decision-navigation').getByRole('button', { name: /^Histórico/ }).click();
  const historyTimeline = page.locator('.timeline[aria-labelledby="timeline-title"]');
  await expect(historyTimeline).toContainText('Rascunho criado');
  await expect(historyTimeline).toContainText('Teste registrado');
  await expect(historyTimeline).not.toContainText('2026-10-21T15:30:00Z');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // 4. /access: upgraded design-system cards in Light and Dark Mode + Axe 0 violations
  await page.getByTestId('workspace-track-authorization').click();
  await expect(page.getByTestId('access-authorization-workspace')).toBeVisible();
  await page.locator('pax-access-draft-review details.review > summary').click();
  await page.locator('pax-access-release details.release > summary').click();
  await expect(page.getByText('Etapa 1 · Catálogo e rascunho')).toBeVisible();
  await expect(page.getByText('Etapa 2 · Release e ativação OPA')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByTestId('studio-theme-toggle').click();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark-tech');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByTestId('studio-theme-toggle').click();
});

test('stretches explorer virtual scroll to fill tall viewport, aligns rail borders, and eliminates duplicate collapse buttons', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'desktop') {
    await page.setViewportSize({ width: 1440, height: 1100 });
  }

  const defs = Array.from({ length: 50 }, (_, index) => {
    const n = index + 1;
    const ruleSetKey = n <= 25 ? 'benefits.eligibility' : 'payroll.benefits';
    return {
      id: `def-tall-${n}`,
      ruleKey: `${ruleSetKey}.rule-${n}`,
      version: 1,
      status: 'approved',
      ruleType: 'validation',
      contextKey: 'benefits',
      resourceKey: `${ruleSetKey}.requests`,
      serviceKey: 'benefits-service',
      condition: { '<=': [{ var: 'request.amount' }, 1000 + n] },
      parameters: {
        nullSemantics: 'FAIL_CLOSED',
        operationKeys: ['CREATE'],
        'praxis.domainRuleDocumentation': {
          title: `Regra estruturada de elegibilidade ${n}`,
          summary: `Valida o critério ${n} no fluxo de elegibilidade.`
        }
      },
      definition: {
        ruleSetKey,
        slotKey: `slot_${n}`,
        decisionStage: 'DOMAIN_DECISION',
        overridePolicy: 'PARAMETERIZABLE',
        requiredFactPaths: ['request.amount'],
        documentation: {
          title: `Regra estruturada de elegibilidade ${n}`,
          summary: `Valida o critério ${n} no fluxo de elegibilidade.`
        }
      }
    };
  });

  await page.route('**/app-config.json', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      mode: 'remote',
      configApiBaseUrl: '',
      locale: 'pt-BR',
      projectionPath: null,
      initialDecisionKey: defs[29]!.ruleKey
    })
  }));
  await page.route('**/auth/session', route => route.fulfill({ status: 204 }));
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname.endsWith('/definitions/catalog')) {
      return json({
        schemaVersion: 'praxis-domain-rule-catalog.v1',
        page: 0,
        limit: 12,
        hasMore: false,
        candidates: defs.map(def => ({
          definitionId: def.id,
          ruleKey: def.ruleKey,
          version: def.version,
          ruleType: def.ruleType,
          status: def.status,
          contextKey: def.contextKey,
          resourceKey: def.resourceKey,
          serviceKey: def.serviceKey,
          semanticOwner: 'benefits-owner',
          updatedAt: '2026-11-24T10:00:00Z'
        }))
      });
    }
    if (pathname.endsWith('/definitions/capabilities')) {
      return json({ tenantId: 'rio', environment: 'stage', definitions: [] });
    }
    if (pathname.endsWith('/definitions')) return json(defs);
    for (const def of defs) {
      if (pathname.endsWith(`/definitions/${def.id}`)) return json(def);
      if (pathname.endsWith(`/definitions/${def.id}/facts`)) {
        return json({
          definitionId: def.id,
          ruleKey: def.ruleKey,
          definitionVersion: 1,
          schemaVersion: 'praxis.domain-rule-fact-catalog.v1',
          facts: [
            {
              path: 'request.amount',
              valueType: 'number',
              nullable: false,
              labels: { 'pt-BR': 'Valor solicitado', 'en-US': 'Requested amount' },
              descriptions: { 'pt-BR': 'Quantia solicitada no pedido.' },
              providerRef: 'benefits.request',
              evidenceRefs: [],
              sensitivity: 'NON_SENSITIVE',
              redaction: 'NONE'
            }
          ]
        });
      }
    }
    if (pathname.endsWith('/parameters')) return json({ schemaVersion: 'praxis.domain-rule-parameters.v1', parameters: [] });
    if (pathname.endsWith('/workspaces')) return json([]);
    if (pathname.endsWith('/lifecycle')) return json({ workspaceId: null, latestTestRun: null, testRuns: [], reviews: [] });
    if (pathname.endsWith('/scenarios')) return json([]);
    if (pathname.endsWith('/snapshots/head/status') || pathname.endsWith('/rollouts') || pathname.endsWith('/rollout-policies')) {
      return json({ availableActions: [] });
    }
    if (pathname.endsWith('/snapshots') || pathname.endsWith('/reviews') || pathname.endsWith('/timeline')) return json([]);
    return route.fallback();
  });

  await page.goto('/catalog?tenantId=rio&organizationId=ALL&environment=stage');
  await expect(page.locator('.decision-virtual-viewport')).toBeVisible();

  await expect.poll(async () => page.evaluate(() => {
    const viewport = document.querySelector('.decision-virtual-viewport')?.getBoundingClientRect();
    const selected = document.querySelector('.decision-row.selected')?.getBoundingClientRect();
    if (!viewport || !selected) return false;
    return selected.top >= viewport.top - 2 && selected.bottom <= viewport.bottom + 2;
  })).toBe(true);

  if (testInfo.project.name === 'desktop') {
    await expect(page.locator('#decision-title')).toHaveText('Regra estruturada de elegibilidade 30');

    // Unambiguous single toggle per panel: no duplicate topbar reopen buttons while panels are open
    await expect(page.getByTestId('studio-sidebar-toggle')).toHaveCount(1);
    await expect(page.getByTestId('explorer-collapse-btn')).toHaveCount(1);
    await expect(page.getByTestId('inspector-collapse-btn')).toHaveCount(1);
    await expect(page.getByTestId('studio-toggle-explorer')).toHaveCount(0);
    await expect(page.getByTestId('studio-toggle-inspector')).toHaveCount(0);

    // 4-column viewport lock: all 4 column footers align flush and outer window has no disconnected scrollbar
    const geometry = await page.evaluate(() => {
      const list = document.querySelector('.decision-list')?.getBoundingClientRect();
      const viewport = document.querySelector('.decision-virtual-viewport')?.getBoundingClientRect();
      const sidebarFooter = document.querySelector('.sidebar-footer')?.getBoundingClientRect();
      const explorerFooter = document.querySelector('.explorer-footer')?.getBoundingClientRect();
      const mainFooter = document.querySelector('.fixture-boundary')?.getBoundingClientRect();
      const inspectorFooter = document.querySelector('.inspector-footer')?.getBoundingClientRect();
      const explorerHeader = document.querySelector('.catalog-pane .pane-heading')?.getBoundingClientRect();
      const inspectorHeader = document.querySelector('.inspector-rail .inspector-header')?.getBoundingClientRect();
      const headerCopy = document.querySelector('.decision-header-copy')?.getBoundingClientRect();
      const headerActions = document.querySelector('.decision-actions')?.getBoundingClientRect();
      return {
        listHeight: list?.height ?? 0,
        viewportHeight: viewport?.height ?? 0,
        sidebarFooterTop: sidebarFooter?.top ?? -1,
        explorerFooterTop: explorerFooter?.top ?? -1,
        mainFooterTop: mainFooter?.top ?? -1,
        inspectorFooterTop: inspectorFooter?.top ?? -1,
        explorerHeaderBottom: explorerHeader?.bottom ?? -1,
        inspectorHeaderBottom: inspectorHeader?.bottom ?? -1,
        docScrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        copyBottom: headerCopy?.bottom ?? 0,
        actionsTop: headerActions?.top ?? 0
      };
    });

    expect(geometry.viewportHeight).toBeGreaterThanOrEqual(600);
    expect(geometry.viewportHeight / geometry.listHeight).toBeGreaterThanOrEqual(0.75);
    expect(Math.abs(geometry.sidebarFooterTop - geometry.explorerFooterTop)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(geometry.explorerFooterTop - geometry.mainFooterTop)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(geometry.mainFooterTop - geometry.inspectorFooterTop)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(geometry.explorerHeaderBottom - geometry.inspectorHeaderBottom)).toBeLessThanOrEqual(1.5);
    expect(geometry.docScrollHeight).toBeLessThanOrEqual(geometry.innerHeight + 2);
    expect(geometry.actionsTop).toBeGreaterThanOrEqual(geometry.copyBottom - 2);

    // Scrolling back to top verifies Group #1 heading sits flush without 50px top void
    await page.evaluate(() => {
      const vp = document.querySelector('.decision-virtual-viewport');
      if (vp) vp.scrollTop = 0;
    });
    await expect(page.locator('.virtual-heading-first')).toBeVisible();
    const firstHeadingGap = await page.evaluate(() => {
      const list = document.querySelector('.decision-list')?.getBoundingClientRect();
      const heading = document.querySelector('.virtual-heading-first')?.getBoundingClientRect();
      if (!list || !heading) return 999;
      return heading.top - list.top;
    });
    expect(firstHeadingGap).toBeLessThanOrEqual(24);

    // Native top-layer <dialog> create modal opens and dismisses via Escape
    await page.getByTestId('toggle-new-decision').click();
    const createDialog = page.locator('dialog[data-testid="decision-create-form"]');
    await expect(createDialog).toBeVisible();
    expect(await createDialog.evaluate(el => (el as HTMLDialogElement).open)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(createDialog).toHaveCount(0);

    // Collapse & reopen flow restores full virtual scroll height
    await page.getByTestId('explorer-collapse-btn').click();
    await expect(page.getByTestId('studio-toggle-explorer')).toBeVisible();
    await page.getByTestId('studio-toggle-explorer').click();
    await expect(page.getByTestId('studio-toggle-explorer')).toHaveCount(0);
    await expect(page.locator('.decision-virtual-viewport')).toBeVisible();

    await page.getByTestId('inspector-collapse-btn').click();
    await expect(page.getByTestId('studio-toggle-inspector')).toBeVisible();
    await page.getByTestId('studio-toggle-inspector').click();
    await expect(page.getByTestId('studio-toggle-inspector')).toHaveCount(0);
  } else {
    const mobileHeader = await page.evaluate(() => {
      const bar = document.querySelector('.product-bar')?.getBoundingClientRect();
      const center = document.querySelector('.bar-center');
      return {
        height: bar?.height ?? 0,
        centerOrder: center ? getComputedStyle(center).order : ''
      };
    });
    expect(mobileHeader.height).toBeLessThanOrEqual(101);
    expect(mobileHeader.centerOrder).toBe('0');
  }

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
