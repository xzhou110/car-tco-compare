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
// Strip any stray BOM/whitespace a mis-set secret may carry (a leading U+FEFF crashes the
// Resend client when it builds the Authorization header).
const resend = new Resend((process.env.RESEND_API_KEY || '').replace(/[^\x21-\x7E]/g, ''));

// The repository is public, so its Actions logs are too: a subscriber is named by the first
// 8 characters of their id, never their address, and provider error text is scrubbed of the
// address (Resend or Supabase may echo it) and of any other address, and logged as message
// text only.
const label = (s) => String(s.id).slice(0, 8);
const errText = (e) => (typeof e === 'string' ? e : e?.message || e?.name || 'unknown error');
const ANY_EMAIL = /[^\s@<>()"']+@[^\s@<>()"']+\.[A-Za-z]{2,}/g;
const scrub = (text, email) => (email
  ? String(text).replace(new RegExp(String(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '<subscriber>')
  : String(text)).replace(ANY_EMAIL, '<email>');

const { data: subs, error } = await supabase.from('subscribers')
  .select('id,email,confirm_token')
  .eq('confirmed', false).is('confirmation_sent_at', null);
if (error) { console.error('❌ query:', error.message); process.exit(1); }
console.log(`${subs.length} subscriber(s) need a confirmation email.`);

// One confirmation. Throws on a send error, or when the sent mark is not saved (tomorrow's
// run would mail the same person again), so the loop counts it and moves on.
async function sendConfirmation(s) {
  const link = `${APP_URL}#/confirm?token=${s.confirm_token}`;
  const html = `<div style="max-width:520px;margin:0 auto;font:14px/1.5 system-ui;color:#222">
    <p>Thanks for signing up for car deal alerts! 🚗</p>
    <p>Confirm your email to start receiving your daily, TCO-ranked digest:</p>
    <p style="margin:18px 0"><a href="${link}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Confirm my subscription</a></p>
    <p style="font:12px system-ui;color:#888">Or paste this link: ${link}<br>If you didn't sign up, you can ignore this email.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:18px 0 12px">
    <p style="font:11px system-ui;color:#aaa;margin:0">🚗 Car Deal Alerts — a project by <a href="https://ai.xuseak.com/" style="color:#2563eb;font-weight:600;text-decoration:none">XuSeak ↗</a></p>
  </div>`;
  const { error: sendErr } = await resend.emails.send({
    from: SETTINGS.sender, to: s.email, subject: 'Confirm your car deal alerts', html,
  });
  if (sendErr) throw new Error(`Resend: ${errText(sendErr)}`);
  const { error: markErr } = await supabase.from('subscribers').update({ confirmation_sent_at: new Date().toISOString() }).eq('id', s.id);
  if (markErr) throw new Error(`sent, but confirmation_sent_at was not saved: ${markErr.message}`);
  console.log(`  ✅ confirmation sent to ${label(s)}`);
}

let failed = 0;
for (const s of subs) {
  try {
    await sendConfirmation(s);
  } catch (e) {
    failed++;
    console.error(`  ❌ ${label(s)}:`, scrub(errText(e), s.email));
  }
}
if (failed) { console.error(`${failed} of ${subs.length} subscriber(s) failed`); process.exitCode = 1; }
console.log('Done.');
