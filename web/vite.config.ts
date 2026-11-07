import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@core': path.resolve(__dirname, '../core/src'),
    },
  },
  server: {
    fs: { allow: ['..'] },
    // dev: chuyển /api sang server NestJS chạy ở máy
    proxy: { '/api': process.env.API_URL ?? 'http://127.0.0.1:45230' },
  },
  build: { chunkSizeWarningLimit: 2000 },
});
