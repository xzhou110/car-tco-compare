// Seed a test subscriber + their two RAV4 Hybrid watchlists, so alert-cron has
// something to run against. Idempotent: re-runnable (clears the user's watchlists first).
//
// Run:  node seed-watchlists.mjs   (needs SUPABASE_SECRET_KEY)

import { supabase } from './supabase/client.mjs';

const EMAIL = 'pastnoefuture@gmail.com';

// upsert subscriber (confirmed so the cron picks them up)
let { data: sub } = await supabase.from('subscribers').select('*').eq('email', EMAIL).maybeSingle();
if (!sub) {
  const { data, error } = await supabase.from('subscribers').insert({ email: EMAIL, confirmed: true }).select().single();
  if (error) { console.error('❌ insert subscriber:', error.message); process.exit(1); }
  sub = data;
} else {
  await supabase.from('subscribers').update({ confirmed: true }).eq('id', sub.id);
}
console.log('subscriber:', sub.email, sub.id);

// fresh watchlists
await supabase.from('watchlists').delete().eq('subscriber_id', sub.id);
const watchlists = [
  {
    subscriber_id: sub.id, name: 'RAV4 Hybrid — under $30k (any trim)', active: true,
    filters: { make: 'Toyota', model: 'RAV4 Hybrid', priceMax: 30000, yearMin: 2020, milesMax: 60000, xlePlusOnly: false },
  },
  {
    subscriber_id: sub.id, name: 'RAV4 Hybrid XLE+ — under $35k', active: true,
    filters: { make: 'Toyota', model: 'RAV4 Hybrid', priceMax: 35000, yearMin: 2022, milesMax: 60000, trims: ['XLE', 'XSE', 'XLE Premium', 'Limited', 'SE', 'Woodland Edition'] },
  },
];
const { error } = await supabase.from('watchlists').insert(watchlists);
if (error) { console.error('❌ insert watchlists:', error.message); process.exit(1); }
console.log(`✅ seeded ${watchlists.length} watchlists for ${EMAIL}`);
