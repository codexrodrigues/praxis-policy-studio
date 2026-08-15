import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

type Persona = {
  readonly key: string;
  readonly username?: string;
  readonly password?: string;
  readonly allowedProbe: { readonly method: 'GET' | 'POST'; readonly path: string };
  readonly forbiddenProbes: readonly { readonly method: 'POST'; readonly path: string }[];
};

const definitions = '/api/praxis/config/domain-rules/definitions';
const workspaces = '/api/praxis/config/domain-rules/workspaces';
const review = `${workspaces}/policy-studio-live-missing/reviews`;
const publication = '/api/praxis/config/domain-rules/publications';
const activate = '/api/praxis/config/domain-rules/snapshots/policy-studio-live-missing/activate';
const operationalTest =
  '/api/human-resources/extraordinary-benefit-requests/actions/run-policy-studio-operational-test';
const adversarialTenant = 'tenant-from-browser';
const adversarialEnvironment = 'environment-from-browser';
const authorizedProbeStatuses = [200, 201, 204, 400, 404, 409, 412, 422, 428] as const;

const personas: readonly Persona[] = [
  {
    key: 'author',
    username: process.env.POLICY_STUDIO_LIVE_AUTHOR_USERNAME,
    password: process.env.POLICY_STUDIO_LIVE_AUTHOR_PASSWORD,
    allowedProbe: { method: 'POST', path: workspaces },
    forbiddenProbes: [
      { method: 'POST', path: review },
      { method: 'POST', path: publication },
      { method: 'POST', path: activate },
      { method: 'POST', path: operationalTest }
    ]
  },
  ...(['A', 'B'] as const).map(suffix => ({
    key: `approver-${suffix.toLowerCase()}`,
    username: process.env[`POLICY_STUDIO_LIVE_APPROVER_${suffix}_USERNAME`],
    password: process.env[`POLICY_STUDIO_LIVE_APPROVER_${suffix}_PASSWORD`],
    allowedProbe: { method: 'POST' as const, path: review },
    forbiddenProbes: [
      { method: 'POST' as const, path: workspaces },
      { method: 'POST' as const, path: publication },
      { method: 'POST' as const, path: activate },
      { method: 'POST' as const, path: operationalTest }
    ]
  })),
  {
    key: 'publisher',
    username: process.env.POLICY_STUDIO_LIVE_PUBLISHER_USERNAME,
    password: process.env.POLICY_STUDIO_LIVE_PUBLISHER_PASSWORD,
    allowedProbe: { method: 'POST', path: publication },
    forbiddenProbes: [
      { method: 'POST', path: workspaces },
      { method: 'POST', path: review },
      { method: 'POST', path: activate },
      { method: 'POST', path: operationalTest }
    ]
  },
  {
    key: 'operator',
    username: process.env.POLICY_STUDIO_LIVE_OPERATOR_USERNAME,
    password: process.env.POLICY_STUDIO_LIVE_OPERATOR_PASSWORD,
    allowedProbe: { method: 'POST', path: operationalTest },
    forbiddenProbes: [
      { method: 'POST', path: workspaces },
      { method: 'POST', path: review },
      { method: 'POST', path: publication }
    ]
  },
  {
    key: 'auditor',
    username: process.env.POLICY_STUDIO_LIVE_AUDITOR_USERNAME,
    password: process.env.POLICY_STUDIO_LIVE_AUDITOR_PASSWORD,
    allowedProbe: { method: 'GET', path: definitions },
    forbiddenProbes: [
      { method: 'POST', path: workspaces },
      { method: 'POST', path: review },
      { method: 'POST', path: publication },
      { method: 'POST', path: activate },
      { method: 'POST', path: operationalTest }
    ]
  }
];

const missingCredentials = personas.some(persona => !persona.username || !persona.password);

test.describe('Policy Studio live multi-persona governance', () => {
  test.skip(missingCredentials,
    'Set all POLICY_STUDIO_LIVE_* persona credentials and start the Quickstart on the official 8088 origin.');

  test('anonymous browser remains outside the governed catalog', async ({ page }) => {
    const session = await page.request.get('/auth/session');
    expect(session.status()).toBe(401);

    const definitionsResponse = await governedRequest(page.request, { method: 'GET', path: definitions });
    expect([401, 403]).toContain(definitionsResponse.status());

    await page.goto('/catalog');
    await expect(page.locator('.development-login')).toBeVisible();
    await expect(page.locator('.decision-list')).toHaveCount(0);
  });

  for (const persona of personas) {
    test(`${persona.key} sees the governed catalog without receiving another persona responsibility`, async ({ page }) => {
      await login(page, persona);

      const session = await page.request.get('/auth/session');
      expect(session.status(), `${persona.key} session`).toBe(204);

      await page.goto('/catalog');
      await expect(page.locator('.decision-list')).toBeVisible();
      await expect(page.locator('.development-login')).toHaveCount(0);

      const definitionsResponse = await governedRequest(page.request, { method: 'GET', path: definitions });
      expect(definitionsResponse.status(), `${persona.key} definition catalog`).toBe(200);
      const definitionsBody = await definitionsResponse.text();
      expect(definitionsBody, `${persona.key} must not project the caller tenant header`)
        .not.toContain(adversarialTenant);
      expect(definitionsBody, `${persona.key} must not project the caller environment header`)
        .not.toContain(adversarialEnvironment);

      const allowed = await governedRequest(page.request, persona.allowedProbe);
      expect(
        authorizedProbeStatuses,
        `${persona.key} must cross its allowed route matcher without a server error`
      ).toContain(allowed.status());

      for (const probe of persona.forbiddenProbes) {
        const forbidden = await governedRequest(page.request, probe);
        expect(forbidden.status(), `${persona.key} must not cross ${probe.path}`).toBe(403);
      }
    });
  }
});

async function login(page: Page, persona: Persona): Promise<void> {
  const response = await page.request.post('/auth/login', {
    data: { username: persona.username, password: persona.password }
  });
  expect(response.status(), `${persona.key} login`).toBe(204);
}

async function governedRequest(
  request: APIRequestContext,
  probe: { readonly method: 'GET' | 'POST'; readonly path: string }
) {
  const headers = {
    Origin: 'http://127.0.0.1:4302',
    'X-Tenant-ID': adversarialTenant,
    'X-Env': adversarialEnvironment
  };
  return probe.method === 'GET'
    ? request.get(probe.path, { headers })
    : request.post(probe.path, { headers, data: {} });
}
