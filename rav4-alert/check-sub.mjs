// Quick verifier: show the most recent subscribers + their watchlists.
import { supabase } from './supabase/client.mjs';
const { data: subs } = await supabase.from('subscribers')
  .select('id,email,confirmed,created_at').order('created_at', { ascending: false }).limit(5);
console.log('Recent subscribers:');
for (const s of subs || []) {
  const { data: wls } = await supabase.from('watchlists').select('name,filters,active').eq('subscriber_id', s.id);
  console.log(`• ${s.email}  confirmed=${s.confirmed}  → ${wls?.length || 0} watchlist(s)`);
  for (const w of wls || []) console.log(`    - ${w.name}: ${JSON.stringify(w.filters)}`);
}
