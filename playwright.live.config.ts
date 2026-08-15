import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /policy-studio-multipersona\.live\.spec\.ts/,
  outputDir: 'test-results-live',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-live', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4302',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4302/catalog',
    reuseExistingServer: true,
    timeout: 120_000
  }
});
