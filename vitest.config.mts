import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const localEnvironment = loadEnv('test', process.cwd(), '')

for (const [name, value] of Object.entries(localEnvironment)) {
  if (process.env[name] === undefined) process.env[name] = value
}

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/verificar-email?token=token-de-teste',
      },
    },
    include: ['tests/**/*.test.{ts,tsx}'],
    pool: 'threads',
    fileParallelism: false,
    clearMocks: true,
    restoreMocks: true,
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
})
