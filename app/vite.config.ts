import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The commit this build came from: GitHub Actions sets GITHUB_SHA; a local build says 'local'.
// Stamped into index.html (<meta name="build-commit">) as the live check's proof of freshness:
// GitHub Pages' CDN ignores the query string, so only content proves a page is new.
// This app's tsconfig type-checks this file without Node's types, so process is reached through globalThis.
const nodeEnv = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
const buildCommit = nodeEnv?.GITHUB_SHA ?? 'local';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'stamp-build-commit',
      transformIndexHtml: (html: string) => html.replace('__BUILD_COMMIT__', buildCommit),
    },
  ],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
