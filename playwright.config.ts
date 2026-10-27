import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['POLICY_STUDIO_BASE_URL'] ?? 'http://127.0.0.1:4302';
const port = new URL(baseURL).port || '4302';

export default defineConfig({
  testDir: './e2e',
  testIgnore: /\.live\.spec\.ts/,
  outputDir: 'test-results',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'narrow', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }
  ],
  webServer: {
    command: `npx ng serve --host 127.0.0.1 --port ${port}`,
    url: `${baseURL}/projections/quickstart-benefit-eligibility.v1.json`,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000
  }
});
