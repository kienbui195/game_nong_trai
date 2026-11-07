// Bộ e2e: chạy trên bản build thật (vite preview, không HMR) + server e2e (DB nongtrai_e2e, đồng hồ tua được).
// Chạy: cd web && npx playwright test   (cần MySQL dev: docker compose -f dev/compose.yaml up -d)
import { defineConfig, devices } from '@playwright/test';

const API_PORT = 45330;
const WEB_PORT = 5190;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // dùng chung một server + một đồng hồ: chạy lần lượt để test không ảnh hưởng nhau
  retries: 0, // không retry: lỗi lúc có lúc không phải lộ ra
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/report.json' }], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: { executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] },
  },
  projects: [{ name: 'pixel7', use: { ...devices['Pixel 7'], hasTouch: true } }],
  webServer: [
    {
      command: 'npx tsx test/e2e-server.ts',
      cwd: '../server',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { E2E_API_PORT: String(API_PORT) },
    },
    {
      command: `npx vite build && npx vite preview --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { API_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
