// ESLint flat config for the engineering standard (D:/Meaningful/AI/agent-skills/rules/engineering-principles.md):
// the size rule (principle 5) and the import boundaries (principles 2 and 3). Copied from the engineering-audit
// skill's templates/eslint.config.js (2026-10-21) and adapted to this app's recorded aliases (PROJECT.md):
//   engine/   -> src/lib/          (pure: tco, depreciation, resolveVehicle, format; listings.ts and supabaseClient.ts
//                                   are known offenders marked in the files until retrofit step 3 moves their I/O out)
//   ui/       -> src/components/
//   adapters/ -> none yet; src/state/ holds the hook that owns localStorage, the share link and profiles, above the engine
//   app/      -> src/App.tsx and src/main.tsx (the shell is two files, not a folder)
// src/data/ (reference tables and presets) is ignored, not exempted. Run: npm run lint (part of npm run check).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const ENGINE = ['src/lib/**'];
const UI = ['src/components/**'];
const UPPER_OF_ENGINE = ['**/adapters/**', '**/storage/**', '**/cloud/**', '**/state/**', '**/ui/**', '**/screens/**', '**/components/**', '**/app/**', '**/App', '**/main'];
const APP_SHELL = ['**/app/**', '**/App', '**/main'];
// This app's network client (@supabase/supabase-js) joins the template's list: a database client is I/O.
const FRAMEWORK_AND_IO = ['react', 'react-dom', 'react-native', 'react/*', 'react-native/*', 'expo', 'expo-*', '@expo/*', '@react-navigation/*',
  '@supabase/*',
  'fs', 'fs/*', 'node:fs', 'node:fs/*', 'http', 'https', 'node:http', 'node:https', 'child_process', 'node:child_process', 'path', 'node:path', 'os', 'node:os'];

export default tseslint.config(
  { ignores: ['dist/**', 'dist-*/**', 'build/**', 'coverage/**', '.expo/**', 'node_modules/**', 'src/data/**', '**/*.generated.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    rules: {
      // Principle 5: a file over 500 lines fails lint; the audit warns from 300. Existing offenders carry a one-line
      // `/* eslint-disable max-lines */` with the DECISIONS.md entry that names the split.
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Principle 2: the engine is pure. No framework, no I/O, no clock or storage globals, nothing from the layers above.
    files: ENGINE,
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: FRAMEWORK_AND_IO, message: 'src/lib/ is pure: no framework or I/O imports; pass data in as arguments' },
          { group: UPPER_OF_ENGINE, message: 'src/lib/ imports nothing above it (state, components, App, main)' },
        ],
      }],
      'no-restricted-globals': ['error', 'document', 'window', 'navigator', 'localStorage', 'sessionStorage', 'fetch'],
    },
  },
  {
    // Principle 3: the UI uses the engine and the hooks, never the app shell.
    files: UI,
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: APP_SHELL, message: 'src/components/ never imports the app shell (App, main)' }] }] },
  },
);
