// Double opt-in: email a confirmation link to subscribers who signed up but haven't
// confirmed yet (and haven't already been emailed). Run by the cron / GitHub Actions.
// Requires phase2b.sql applied (confirmation_sent_at column + confirm_subscriber RPC).
//
// Run:  node send-confirmations.mjs   (needs SUPABASE_SECRET_KEY + RESEND_API_KEY)
// NOTE: Resend test mode only delivers to the account owner until a domain is verified.

import { Resend } from 'resend';
import { supabase } from './supabase/client.mjs';
import { SETTINGS, APP_URL } from './config.mjs';

if (!process.env.RESEND_API_KEY) { console.error('❌ RESEND_API_KEY not set.'); process.exit(1); }
const resend = new Resend(process.env.RESEND_API_KEY);

const { data: subs, error } = await supabase.from('subscribers')
  .select('id,email,confirm_token')
  .eq('confirmed', false).is('confirmation_sent_at', null);
if (error) { console.error('❌ query:', error.message); process.exit(1); }
console.log(`${subs.length} subscriber(s) need a confirmation email.`);

for (const s of subs) {
  const link = `${APP_URL}#/confirm?token=${s.confirm_token}`;
  const html = `<div style="max-width:520px;margin:0 auto;font:14px/1.5 system-ui;color:#222">
    <p>Thanks for signing up for car deal alerts! 🚗</p>
    <p>Confirm your email to start receiving your twice-daily, TCO-ranked digest:</p>
    <p style="margin:18px 0"><a href="${link}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Confirm my subscription</a></p>
    <p style="font:12px system-ui;color:#888">Or paste this link: ${link}<br>If you didn't sign up, you can ignore this email.</p>
  </div>`;
  const { error: sendErr } = await resend.emails.send({
    from: SETTINGS.sender, to: s.email, subject: 'Confirm your car deal alerts', html,
  });
  if (sendErr) { console.error(`  ❌ ${s.email}:`, sendErr.message ?? sendErr); continue; }
  await supabase.from('subscribers').update({ confirmation_sent_at: new Date().toISOString() }).eq('id', s.id);
  console.log(`  ✅ confirmation sent to ${s.email}`);
}
console.log('Done.');
