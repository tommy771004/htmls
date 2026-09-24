import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// 雲端環境預先裝好的 Chromium；本機沒有這個路徑時改用 Playwright 自己下載的版本。
const localChromium = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4318/',
    launchOptions: existsSync(localChromium) ? { executablePath: localChromium } : {},
  },
  webServer: {
    command: 'node scripts/serve-built.mjs 4318',
    url: 'http://127.0.0.1:4318/',
    reuseExistingServer: true,
  },
});
