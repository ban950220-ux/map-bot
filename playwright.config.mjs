import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1200, height: 900 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
