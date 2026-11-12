// Server-side Supabase client (uses the SECRET key → bypasses RLS). Never ship this
// key to the browser; the front-end uses SUPABASE_PUBLISHABLE_KEY instead.
import { createClient } from '@supabase/supabase-js';

// Both from the environment only: this repository is public, and a missing URL must not
// silently point at the live project. The Actions workflow passes the SUPABASE_URL secret.
export const SUPABASE_URL = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL not set in this shell (the project URL, https://<ref>.supabase.co).');
  process.exit(1);
}
if (!SECRET) {
  console.error('❌ SUPABASE_SECRET_KEY not set in this shell.');
  process.exit(1);
}

export const supabase = createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false } });
