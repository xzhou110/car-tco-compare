/* eslint-disable no-restricted-imports -- purity debt (retrofit step 3, DECISIONS.md ADR-001 of 2026-10-21): a network client inside the pure folder; this file moves to an adapters folder. */
import { createClient } from '@supabase/supabase-js';

// Both injected at build time (Actions variables, or app/.env.local for a local build); no
// hard-coded fallback, because this repository is public.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
if (!url || !key) {
  throw new Error('Deal Alerts: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set at build time (app/.env.local locally, Actions variables in CI).');
}

export const supabase = createClient(url, key);
