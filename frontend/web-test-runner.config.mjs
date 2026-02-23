import { playwrightLauncher } from '@web/test-runner-playwright'
import { esbuildPlugin } from '@web/dev-server-esbuild'

export default {
  files: 'src/**/*.wtr.ts',
  // Exclude the 'development' export condition so Lit loads its production build
  nodeResolve: { exportConditions: ['browser', 'import', 'default'] },
  plugins: [
    // Transpile TypeScript; pass tsconfig so esbuild sees experimentalDecorators: true
    esbuildPlugin({ ts: true, tsconfig: './tsconfig.json', define: { 'process.env.NODE_ENV': '"production"' } }),
  ],
  browsers: [playwrightLauncher({ product: 'chromium' })],
}
