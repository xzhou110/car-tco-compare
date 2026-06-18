// End-to-end lifecycle test: signup (with a preference) -> instant confirmation email
// -> confirm -> [digest] -> unsubscribe -> re-signup -> instant confirmation email.
//
// Exercises the real RPCs (start_subscription / confirm_subscriber / unsubscribe_all)
// and the deployed send-confirmation Edge Function over HTTP. Uses the service-role
// key (a valid JWT, so it passes the function's verify_jwt); the anon EXECUTE grant on
// the RPCs is verified separately via pg_proc ACL, and the anon->function path is
// verified in the live browser test. Sends REAL confirmation emails, so TEST_EMAIL
// must be Resend-deliverable (the account owner address in test mode).
//
// Run:  node lifecycle-test.mjs phase1   (clean slate, signup, instant email, confirm)
//       node lifecycle-test.mjs phase2   (unsubscribe, re-signup, instant email)

import { supabase } from './supabase/client.mjs';

const PHASE = process.argv[2] || 'phase1';
const EMAIL = process.env.TEST_EMAIL || 'pastnoefuture@gmail.com';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://grlkuouatrehmrutulhj.supabase.co';
const SERVICE = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Multi-select filters (makes/models/fuels arrays), matching the new AlertsModal output.
const PREF1 = { name: 'Hybrid SUVs — under $35k', active: true,
  filters: { makes: ['Toyota', 'Honda'], models: ['RAV4 Hybrid', 'CR-V Hybrid'], fuels: ['hybrid'], priceMax: 35000, yearMin: 2020, milesMax: 60000 } };
const PREF2 = { name: 'RAV4 Hybrid XLE — under $40k', active: true,
  filters: { makes: ['Toyota'], models: ['RAV4 Hybrid'], trims: ['XLE'], priceMax: 40000, yearMin: 2021, milesMax: 70000 } };

let pass = 0, fail = 0;
const ok = (cond, msg, extra) => { cond ? pass++ : fail++; console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}${extra !== undefined ? '  →  ' + extra : ''}`); };
const getSub = async () => (await supabase.from('subscribers').select('*').eq('email', EMAIL).maybeSingle()).data;
const getWls = async (id) => (await supabase.from('watchlists').select('name,filters,active').eq('subscriber_id', id)).data || [];

async function invokeConfirm(id) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-confirmation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  let body; const text = await res.text();
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { http: res.status, body };
}

console.log(`\n=== ${PHASE.toUpperCase()} — ${EMAIL} ===`);

if (PHASE === 'phase1') {
  // 0) Clean slate (removes the old seeded 2 lists too; cascade clears watchlists+sent_state).
  const before = await getSub();
  if (before) {
    const wls = await getWls(before.id);
    await supabase.from('subscribers').delete().eq('id', before.id);
    console.log(`  CLEAN  removed existing subscriber + ${wls.length} watchlist(s): ${wls.map((w) => w.name).join(' | ') || '(none)'}`);
  } else {
    console.log('  CLEAN  no existing subscriber.');
  }

  // 1) Signup with a preference.
  const { data: id1, error: e1 } = await supabase.rpc('start_subscription', { p_email: EMAIL, p_watchlists: [PREF1] });
  ok(!e1 && !!id1, 'start_subscription (signup) returns subscriber id', e1?.message || id1);
  let sub = await getSub();
  ok(sub && sub.confirmed === false && !sub.unsubscribed_at, 'subscriber is UNCONFIRMED, not unsubscribed', sub ? `confirmed=${sub.confirmed}` : 'no row');
  const wls = await getWls(id1);
  ok(wls.length === 1 && wls[0].filters.models?.includes('RAV4 Hybrid') && wls[0].active, 'preference saved as 1 active watchlist', JSON.stringify(wls.map((w) => w.name)));

  // instant confirmation email (REAL send via the deployed function)
  const r1 = await invokeConfirm(id1);
  ok(r1.http === 200 && r1.body.status === 'sent', 'send-confirmation → sent INSTANTLY', `http=${r1.http} ${JSON.stringify(r1.body)}`);
  sub = await getSub();
  ok(!!sub.confirmation_sent_at, 'confirmation_sent_at stamped (cron fallback will skip)', sub.confirmation_sent_at);

  // idempotency: a second call must NOT resend
  const r1b = await invokeConfirm(id1);
  ok(r1b.body.status === 'already_sent', 're-invoke is idempotent (already_sent, no double email)', JSON.stringify(r1b.body));

  // 2) Confirm via the emailed token.
  const { data: c1 } = await supabase.rpc('confirm_subscriber', { p_token: sub.confirm_token });
  ok(c1 === true, 'confirm_subscriber(token) → true', `=${c1}`);
  sub = await getSub();
  ok(sub.confirmed === true, 'subscriber now CONFIRMED (digest-eligible)', `confirmed=${sub.confirmed}`);

  console.log(`\n  RESEND id (signup confirmation): ${r1.body.resendId}`);
  console.log(`  Subscriber ${id1} is confirmed with preference "${PREF1.name}". Ready for the digest step.`);
} else {
  // PHASE 2 — unsubscribe then re-signup.
  let sub = await getSub();
  ok(!!sub, 'subscriber exists from phase 1', sub?.id);
  const idPrev = sub.id, tokenPrev = sub.confirm_token;

  // 3) Unsubscribe.
  const { data: u1 } = await supabase.rpc('unsubscribe_all', { p_token: sub.unsubscribe_token });
  ok(u1 === true, 'unsubscribe_all(token) → true', `=${u1}`);
  sub = await getSub();
  let wls = await getWls(idPrev);
  ok(!!sub.unsubscribed_at, 'unsubscribed_at stamped (cron will skip this subscriber)', sub.unsubscribed_at);
  ok(wls.length > 0 && wls.every((w) => w.active === false), 'all watchlists deactivated', JSON.stringify(wls.map((w) => w.active)));

  // 4) Re-signup with the SAME email (this is the part that was broken before phase3).
  const { data: id2, error: e2 } = await supabase.rpc('start_subscription', { p_email: EMAIL, p_watchlists: [PREF2] });
  ok(!e2 && id2 === idPrev, 're-signup succeeds, same subscriber id (no unique-violation)', e2?.message || id2);
  sub = await getSub();
  ok(sub.confirmed === false && !sub.unsubscribed_at && !sub.confirmation_sent_at, 'reset to fresh UNCONFIRMED state', `confirmed=${sub.confirmed} unsub=${!!sub.unsubscribed_at} sent=${!!sub.confirmation_sent_at}`);
  ok(sub.confirm_token !== tokenPrev, 'NEW confirm_token issued (old emailed link invalidated)', `changed=${sub.confirm_token !== tokenPrev}`);
  wls = await getWls(idPrev);
  ok(wls.length === 1 && wls[0].filters.priceMax === 40000 && wls[0].active, 'watchlists replaced with the new active preference', JSON.stringify(wls.map((w) => w.name)));

  // instant confirmation email again (REAL send)
  const r2 = await invokeConfirm(id2);
  ok(r2.http === 200 && r2.body.status === 'sent', 'send-confirmation → sent INSTANTLY (re-signup)', `http=${r2.http} ${JSON.stringify(r2.body)}`);
  sub = await getSub();
  ok(!!sub.confirmation_sent_at, 'confirmation_sent_at stamped again', sub.confirmation_sent_at);

  console.log(`\n  RESEND id (re-signup confirmation): ${r2.body.resendId}`);
  console.log(`  Final: subscriber awaiting confirmation of "${PREF2.name}" — click the latest email's link to finish.`);
}

console.log(`\n=== ${PHASE}: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
