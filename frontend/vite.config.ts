/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { readFileSync } from 'fs'
import istanbul from 'vite-plugin-istanbul'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }
const apiTarget = process.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

export default defineConfig({
  plugins: process.env.VITE_COVERAGE === 'true'
    ? [
        // Suppress istanbul from instrumenting TypeScript's synthesized __decorateClass helper.
        // esbuild inlines this helper at the top of every file that uses TS decorators; the
        // helper body contains ~12 branch arms with no source-map entries, which appear as
        // uncovered "ghost" branches attributed to random TypeScript lines and push branch
        // coverage below threshold.  Adding /* istanbul ignore next */ before the declaration
        // causes babel-plugin-istanbul (which runs after this plugin via enforce:'post') to
        // skip instrumenting the entire arrow-function expression.
        {
          name: 'suppress-ts-helper-coverage',
          transform(code: string, id: string) {
            if (/node_modules/.test(id) || !/\.(ts|tsx)$/.test(id)) return null
            if (!code.includes('var __decorateClass =')) return null
            return {
              code: code.replace('var __decorateClass =', '\n/* istanbul ignore next */\nvar __decorateClass ='),
              map: null,
            }
          },
        },
        istanbul({ include: 'src/**', exclude: ['node_modules', '**/*.test.ts', '**/*.spec.ts', '**/*.wtr.ts'], requireEnv: false }),
      ]
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
