// Verify phase2b.sql RPCs end-to-end on a throwaway subscriber, then clean it up.
// Run: node verify-rpc.mjs   (needs SUPABASE_SECRET_KEY)
import { supabase } from './supabase/client.mjs';

const email = `verify_${Date.now()}@example.com`;
const { data: sub, error: e1 } = await supabase.from('subscribers').insert({ email, confirmed: false }).select().single();
if (e1) { console.error('❌ insert:', e1.message); process.exit(1); }
console.log(`test subscriber ${email} · confirmed=${sub.confirmed}`);

const { data: c1, error: e2 } = await supabase.rpc('confirm_subscriber', { p_token: sub.confirm_token });
if (e2) { console.error('❌ confirm_subscriber:', e2.message); process.exit(1); }
const { data: a1 } = await supabase.from('subscribers').select('confirmed').eq('id', sub.id).single();
console.log(`confirm_subscriber returned ${c1} · confirmed now = ${a1.confirmed}`);

const { data: u1, error: e3 } = await supabase.rpc('unsubscribe_all', { p_token: sub.unsubscribe_token });
if (e3) { console.error('❌ unsubscribe_all:', e3.message); process.exit(1); }
const { data: a2 } = await supabase.from('subscribers').select('unsubscribed_at').eq('id', sub.id).single();
console.log(`unsubscribe_all returned ${u1} · unsubscribed_at = ${a2.unsubscribed_at} (row kept, not deleted)`);

await supabase.from('subscribers').delete().eq('id', sub.id);
console.log('cleaned up test subscriber.');
