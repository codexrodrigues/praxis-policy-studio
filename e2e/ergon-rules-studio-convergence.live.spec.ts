import { expect, test } from '@playwright/test';

const ergonBackendUrl = (process.env.ERGON_SHOWCASE_LIVE_BACKEND_URL || '').replace(/\/$/, '');
const studioOrigin = new URL(
  process.env.POLICY_STUDIO_LIVE_STUDIO_URL || 'http://127.0.0.1:4302'
).origin;
const ergonUsername = process.env.ERGON_SHOWCASE_LIVE_USERNAME || 'ergon.admin';
const ergonPassword = process.env.ERGON_SHOWCASE_LIVE_PASSWORD || '';

test.describe('Ergon Showcase <-> Praxis Rules Studio live convergence (C9)', () => {
  test.skip(
    !ergonBackendUrl || !ergonPassword,
    'Set ERGON_SHOWCASE_LIVE_BACKEND_URL and ERGON_SHOWCASE_LIVE_PASSWORD to run against a live praxis-ergon-showcase (:8086).'
  );

  test('authenticates against praxis-ergon-showcase, verifies seeded RN-013 definitions, /schemas/actions operational proof, and 6-stage DAG in Praxis Rules Studio', async ({
    page
  }) => {
    await page.route('**/app-config.json', async route => {
      const response = await route.fetch();
      const json = (await response.json()) as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...json,
          mode: 'remote',
          configApiBaseUrl: ergonBackendUrl
        })
      });
    });

    const loginRes = await page.request.post(`${ergonBackendUrl}/auth/login`, {
      headers: { Origin: studioOrigin },
      data: { username: ergonUsername, password: ergonPassword }
    });
    expect([200, 204]).toContain(loginRes.status());

    const actionsRes = await page.request.get(
      `${ergonBackendUrl}/schemas/actions?resource=administracao-pessoal.regras-frequencia-estatutaria`,
      { headers: { Origin: studioOrigin } }
    );
    expect(actionsRes.status()).toBe(200);
    const actionsBody = (await actionsRes.json()) as {
      actions?: Array<{ id?: string; path?: string; tags?: string[] }>;
    };
    expect(
      actionsBody.actions?.some(
        action =>
          action.id === 'run-rules-studio-operational-test' &&
          action.path === '/api/praxis/rules-studio/actions/run-rules-studio-operational-test' &&
          action.tags?.includes('operational-proof')
      )
    ).toBe(true);

    await page.goto(
      '/catalog?ruleSetKey=ergon.administracao-pessoal.regras-frequencia.rn013&slotKey=rn013.qtd_max_non_negative&decisionKey=product.ergon.rn013.erg08380'
    );
    await expect(page.getByTestId('rule-decision-plan-dag')).toBeVisible();
    await expect(page.getByTestId('dag-ruleset-key')).toContainText(
      'ergon.administracao-pessoal.regras-frequencia.rn013'
    );
    await expect(page.getByTestId('dag-stage-PROTECTED_GUARD')).toContainText('ERG-00019');
    await expect(page.getByTestId('dag-stage-DOMAIN_DECISION')).toContainText('ERG-08380');
    await expect(page.getByTestId('dag-stage-POST_DECISION')).toContainText('ERG-08393');

    await expect(page.getByTestId('dag-concept-chip-tipoFrequencia')).toBeVisible();
    await page.getByTestId('dag-concept-chip-tipoFrequencia').click();
    await expect(page.getByTestId('dag-ruleset-key')).toContainText(
      'ergon.administracao-pessoal.frequencias.lancamento'
    );
    await expect(page.getByTestId('dag-stage-DOMAIN_DECISION')).toContainText('ERG-00446');
  });
});
