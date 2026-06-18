// Instant double opt-in confirmation email.
//
// The static frontend calls this the moment it inserts a subscriber row (with the
// anon key) passing { id }. We use the service-role key (auto-injected by Supabase)
// to read the confirm_token, send the email via Resend, and stamp confirmation_sent_at
// so the twice-daily cron fallback (send-confirmations.mjs) never double-sends.
//
// Abuse guard: only emails a subscriber that already exists AND is unconfirmed AND
// has not been emailed yet — so it can't be used to spam arbitrary addresses.
//
// Deploy:  npx supabase functions deploy send-confirmation --project-ref <ref>
// Secret:  npx supabase secrets set RESEND_API_KEY=... --project-ref <ref>
//          (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Strip any stray BOM/whitespace a mis-set secret may carry (a leading U+FEFF would make
// Resend reject the Authorization header).
const RESEND_API_KEY = (Deno.env.get('RESEND_API_KEY') ?? '').replace(/[^\x21-\x7E]/g, '');
const APP_URL = Deno.env.get('APP_URL') ?? 'https://xzhou110.github.io/car-tco-compare/';
const SENDER = Deno.env.get('CONFIRM_SENDER') ?? 'Car Deal Alerts <alerts@send.xuspark.com>';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let id: string | undefined;
  let email: string | undefined;
  try {
    ({ id, email } = await req.json());
  } catch {
    /* fall through to validation below */
  }
  if (!id && !email) return json({ error: 'id or email required' }, 400);

  // Service-role REST helper (bypasses RLS).
  const rest = (path: string, init: RequestInit = {}) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

  const filter = id
    ? `id=eq.${encodeURIComponent(id)}`
    : `email=eq.${encodeURIComponent(email!)}`;
  const lookup = await rest(
    `subscribers?${filter}&select=id,email,confirm_token,confirmed,confirmation_sent_at&limit=1`,
  );
  if (!lookup.ok) return json({ error: 'lookup failed', detail: await lookup.text() }, 500);
  const sub = (await lookup.json())[0];
  if (!sub) return json({ error: 'subscriber not found' }, 404);
  if (sub.confirmed) return json({ status: 'already_confirmed' });
  if (sub.confirmation_sent_at) return json({ status: 'already_sent' });

  const link = `${APP_URL}#/confirm?token=${sub.confirm_token}`;
  const html = `<div style="max-width:520px;margin:0 auto;font:14px/1.5 system-ui;color:#222">
    <p>Thanks for signing up for car deal alerts! 🚗</p>
    <p>Confirm your email to start receiving your twice-daily, TCO-ranked digest:</p>
    <p style="margin:18px 0"><a href="${link}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Confirm my subscription</a></p>
    <p style="font:12px system-ui;color:#888">Or paste this link: ${link}<br>If you didn't sign up, you can ignore this email.</p>
  </div>`;

  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: SENDER, to: sub.email, subject: 'Confirm your car deal alerts', html }),
  });
  if (!send.ok) return json({ error: 'resend failed', detail: await send.text() }, 502);
  const sent = await send.json().catch(() => ({}));

  // Stamp confirmation_sent_at so the cron fallback skips this subscriber.
  await rest(`subscribers?id=eq.${sub.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ confirmation_sent_at: new Date().toISOString() }),
  });

  return json({ status: 'sent', to: sub.email, resendId: sent.id ?? null });
});
