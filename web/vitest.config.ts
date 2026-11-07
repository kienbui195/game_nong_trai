import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src'), '@core': path.resolve(__dirname, '../core/src') } },
  test: { include: ['test/**/*.test.ts'] },
});
