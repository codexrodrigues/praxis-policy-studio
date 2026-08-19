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
}

async function mockGovernedBackend(page: Page, operationalAllowed: boolean): Promise<void> {
  const authoringStreams: MockState = {
    sequence: 0, components: new Map<string, string>(), createdScenario: null, savedCondition: null
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
  await page.route('**/api/**', async route => governedResponse(route, operationalAllowed, authoringStreams));
  await page.route('**/schemas/**', async route => governedResponse(route, operationalAllowed, authoringStreams));
  await page.route('**/auth/session', route => route.fulfill({ status: 204 }));
}

async function governedResponse(
  route: Route,
  operationalAllowed: boolean,
  authoringStreams: MockState
): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const currentWorkspace = authoringStreams.savedCondition == null ? workspace : {
    ...workspace, revision: 5, etag: 'workspace-etag-5', condition: authoringStreams.savedCondition
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
    const payload = component === 'policy-decision-explanation'
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
              candidates: [{
                definitionId: definition.id, ruleKey: definition.ruleKey, version: definition.version,
                ruleType: 'JSON_LOGIC_DECISION', status: definition.status,
                contextKey: 'benefits', resourceKey: definition.resourceKey,
                serviceKey: definition.serviceKey, semanticOwner: 'benefits-policy',
                updatedAt: '2026-08-16T12:00:00Z'
              }],
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
    definitions: [{ definitionId: definition.id, ruleKey: definition.ruleKey, version: 1, availableActions: [] }]
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
  if (path.endsWith('/definitions')) return json([definition]);
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
  if (path.endsWith(`/definitions/${definition.id}`)) return json(definition);
  if (path.endsWith(`/definitions/${definition.id}/timeline`)) return json([]);
  if (path.endsWith('/workspaces')) return json([workspace]);
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
  if (path.endsWith('/workspaces/workspace-1/reviews')) return json([]);
  if (path.endsWith('/workspaces/workspace-1/test-runs')) return json([]);
  if (path.endsWith('/workspaces/workspace-1/capabilities')) return json({
    workspaceId: workspace.id, ruleKey: workspace.ruleKey, status: 'OPEN', revision: 4,
    etag: workspace.etag, availableActions: ['VIEW', 'UPDATE_DRAFT', 'MANAGE_SCENARIOS', 'RECORD_TEST_RUN'], blockers: []
  });
  if (path.endsWith('/workspaces/workspace-1/draft') && request.method() === 'PUT') {
    const body = request.postDataJSON() as { condition: unknown; parameters: unknown };
    expect(request.headers()['if-match']).toBe('"workspace-etag-4"');
    expect(body.condition).toEqual({ or: [
      { '===': [{ coalesce: [{ var: 'request.requestedAmount' }] }, null] },
      { '<=': [{ var: 'request.requestedAmount' }, 2750] }
    ] });
    expect(body.parameters).toEqual(workspace.parameters);
    authoringStreams.savedCondition = body.condition;
    return json({ ...workspace, revision: 5, etag: 'workspace-etag-5', condition: body.condition });
  }
  if (path.endsWith('/workspaces/workspace-1')) return json(currentWorkspace);
  if (path.endsWith('/policy-studio/sandbox/runs') && request.method() === 'POST') {
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
  if (path.endsWith('/snapshots/head/status')) return json({}, 404);
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

  await page.getByLabel('O que você precisa encontrar?').fill('regras que limitam o valor do auxílio');
  await page.getByRole('button', { name: 'Descobrir', exact: true }).click();
  const candidate = page.getByRole('button', { name: /grant\.amount-parameters/ });
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

  await page.getByRole('button', { name: /^Regra/ }).click();
  await expect(page.locator('#decision-rule')).toBeFocused();
  await expect(page).toHaveURL(/\/catalog$/);
  expect(configLoads).toBe(1);

  await page.getByRole('button', { name: 'Testar regra', exact: true }).click();
  await page.getByRole('button', { name: 'Editar regra', exact: true }).click();
  await expect(page.locator('.draft-workspace')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Regra/ })).toHaveAttribute('aria-current', 'page');
  await page.locator('.draft-workspace').getByRole('spinbutton', { name: 'Valor' }).fill('2750');
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
