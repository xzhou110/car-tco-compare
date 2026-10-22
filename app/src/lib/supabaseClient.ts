/* eslint-disable no-restricted-imports -- purity debt (retrofit step 3, DECISIONS.md ADR-001 of 2026-10-21): a network client inside the pure folder; this file moves to an adapters folder. */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://grlkuouatrehmrutulhj.supabase.co';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(url, key);
