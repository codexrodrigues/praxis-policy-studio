import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.POLICY_STUDIO_LIVE_STUDIO_URL || 'http://127.0.0.1:4302';
const port = new URL(baseURL).port || '4302';

export default defineConfig({
  testDir: './e2e',
  testMatch: /policy-studio-multipersona\.live\.spec\.ts/,
  outputDir: 'test-results-live',
  fullyParallel: false,
  retries: 0,
  expect: {
    timeout: 25_000
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-live', open: 'never' }]],
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: process.env.POLICY_STUDIO_LIVE_STUDIO_URL
    ? undefined
    : {
        command: `npx ng serve --host 127.0.0.1 --port ${port}`,
        url: `${baseURL}/projections/quickstart-benefit-eligibility.v1.json`,
        reuseExistingServer: true,
        timeout: 120_000
      }
});
