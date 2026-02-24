/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { readFileSync } from 'fs'
import istanbul from 'vite-plugin-istanbul'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }
const apiTarget = process.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

export default defineConfig({
  plugins: process.env.VITE_COVERAGE === 'true'
    ? [istanbul({ include: 'src/**', exclude: ['node_modules', '**/*.test.ts', '**/*.spec.ts', '**/*.wtr.ts'], requireEnv: false })]
    : [],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'jsdom',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/types.ts',
        'src/env.d.ts',
        'src/icons.ts',
        '**/*.spec.ts',
        '**/*.wtr.ts',
        'src/playwright-fixtures.ts',
        'src/components/**',
        'src/pages/**',
      ],
      thresholds: {
        lines: 95,
        statements: 95,
        branches: 95,
        functions: 95,
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true, configure: (p) => p.on('error', () => {}) },
      '/health': { target: apiTarget, changeOrigin: true, configure: (p) => p.on('error', () => {}) },
    },
  },
})
