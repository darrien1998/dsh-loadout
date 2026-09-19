import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dsh = (relative: string): string => fileURLToPath(new URL(`../deepseek-harness-0.1.5/${relative}`, import.meta.url))

// Every DSH import resolves against the pinned sibling checkout, never an
// npm canary: the analyzer parses compositions with the loader's own YAML
// dialect, discovery uses the roster's own scanner, and the materialize row
// reads the harness home the launcher itself uses.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**'],
  },
  resolve: {
    alias: {
      '@deepseek-ai/dsh-agent-presets': dsh('packages/preset/agent-presets/lib/index.js'),
      '@deepseek-ai/dsh-home-paths': dsh('packages/util/home-paths/lib/index.js'),
      '@deepseek-ai/cordis-plugin-loader': dsh('vendor/loader/lib/index.js'),
      '@deepseek-ai/cordis-plugin-include': dsh('vendor/include/lib/index.js'),
    },
  },
})
