// Server-side Supabase client (uses the SECRET key → bypasses RLS). Never ship this
// key to the browser; the front-end uses SUPABASE_PUBLISHABLE_KEY instead.
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://grlkuouatrehmrutulhj.supabase.co';
const SECRET = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SECRET) {
  console.error('❌ SUPABASE_SECRET_KEY not set in this shell.');
  process.exit(1);
}

export const supabase = createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false } });
