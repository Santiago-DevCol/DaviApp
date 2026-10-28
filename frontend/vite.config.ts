/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Backend origin used only by the dev-server proxy (see README).
const BACKEND_URL = 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // The app talks to `/api/*`; in development Vite forwards it to the
      // NestJS backend and strips the prefix. SSE streams pass through as-is.
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  resolve: {
    // Mirrors the `@/*` path alias from tsconfig.json; `/src` is root-relative for Vite.
    alias: [{ find: /^@\//, replacement: '/src/' }],
  },
  optimizeDeps: {
    // `@techdocs/shared` is a linked CommonJS workspace package; Vite skips
    // pre-bundling linked packages by default, so it must be listed here.
    include: ['@techdocs/shared'],
  },
  build: {
    commonjsOptions: { include: [/packages\/shared/, /node_modules/] },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
});
