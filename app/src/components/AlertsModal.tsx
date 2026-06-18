import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { loadListingsSnapshot } from '../lib/listings';
import { MultiSelect } from './MultiSelect';
import type { Listing } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Pref {
  name: string;
  // Multi-select: each is a set of chosen values (empty = "any").
  makes: string[];
  models: string[];
  fuels: string[];
  trims: string[];
  zip: string;
  radius: string;
  priceMin: string;
  priceMax: string;
  yearMin: string;
  milesMax: string;
}

const MAX_PREFS = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyPref = (): Pref => ({
  name: '',
  makes: [],
  models: [],
  fuels: [],
  trims: [],
  zip: '',
  radius: '',
  priceMin: '',
  priceMax: '',
  yearMin: '',
  milesMax: '',
});

/** Parse a numeric field; blank/invalid -> undefined so it is omitted from the filters jsonb. */
const num = (s: string): number | undefined => {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

const hasContent = (p: Pref): boolean =>
  !!(p.makes.length || p.models.length || p.fuels.length || p.trims.length || p.zip.trim() || p.radius.trim() || p.priceMin.trim() || p.priceMax.trim() || p.yearMin.trim() || p.milesMax.trim());

/** Build the exact filters jsonb the cron reads: multi-select arrays, numbers as numbers, blanks omitted. */
function buildFilters(p: Pref) {
  const f: Record<string, unknown> = {};
  // Multi-select arrays — omit a key entirely when nothing is chosen ("any").
  if (p.makes.length) f.makes = p.makes;
  if (p.models.length) f.models = p.models;
  if (p.fuels.length) f.fuels = p.fuels;
  if (p.trims.length) f.trims = p.trims;
  if (p.zip.trim()) f.zip = p.zip.trim();
  const radius = num(p.radius);
  if (radius !== undefined) f.radius = radius;
  const priceMin = num(p.priceMin);
  if (priceMin !== undefined) f.priceMin = priceMin;
  const priceMax = num(p.priceMax);
  if (priceMax !== undefined) f.priceMax = priceMax;
  const yearMin = num(p.yearMin);
  if (yearMin !== undefined) f.yearMin = yearMin;
  const milesMax = num(p.milesMax);
  if (milesMax !== undefined) f.milesMax = milesMax;
  return f;
}

/** Resolve the alert's display name: explicit name, else makes+models, else "Preference N". */
const nameFor = (p: Pref, index: number): string => {
  const explicit = p.name.trim();
  if (explicit) return explicit;
  const makeModel = `${p.makes.join('/')} ${p.models.join('/')}`.trim();
  return makeModel || `Preference ${index + 1}`;
};

export function AlertsModal({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState('');
  const [prefs, setPrefs] = useState<Pref[]>([emptyPref()]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  // Cache the listings snapshot once (same source ListingModal uses) to derive trim options.
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Load the listings snapshot once, the first time the modal is opened.
  useEffect(() => {
    if (!open || listings.length > 0) return;
    let cancelled = false;
    void loadListingsSnapshot().then((snap) => {
      if (!cancelled && snap) setListings(snap.listings);
    });
    return () => {
      cancelled = true;
    };
  }, [open, listings.length]);

  // Multi-select option derivation. Each field is "any" until chips are picked; options
  // scope to the makes/models chosen so far but ALWAYS render (usable before a model is picked).
  const matchingListings = (p: Pref): Listing[] =>
    listings.filter(
      (L) =>
        (p.makes.length === 0 || p.makes.includes(L.make)) &&
        (p.models.length === 0 || p.models.includes(L.model)),
    );

  const makeOptions = [...new Set(listings.map((l) => l.make).filter(Boolean))].sort();
  const modelOptionsFor = (p: Pref): string[] =>
    [...new Set(listings.filter((l) => p.makes.length === 0 || p.makes.includes(l.make)).map((l) => l.model).filter(Boolean))].sort();
  const fuelOptionsFor = (p: Pref): string[] =>
    [...new Set<string>(matchingListings(p).map((l) => l.powertrain).filter(Boolean))].sort();
  const trimOptionsFor = (p: Pref): string[] =>
    [...new Set(matchingListings(p).map((l) => l.trim).filter((v): v is string => !!v))].sort();
  const FUEL_LABEL: Record<string, string> = { gas: 'Gas', hybrid: 'Hybrid', ev: 'EV' };

  // Toggle a value in a multi-select array.
  const toggle = (arr: string[], v: string): string[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  // After makes/models change, drop model/fuel/trim picks that no longer have any data.
  const cleanPref = (p: Pref): Pref => {
    const models = modelOptionsFor(p);
    const p2: Pref = { ...p, models: p.models.filter((m) => models.includes(m)) };
    const fuels = fuelOptionsFor(p2);
    const trims = trimOptionsFor(p2);
    return { ...p2, fuels: p.fuels.filter((f) => fuels.includes(f)), trims: p.trims.filter((t) => trims.includes(t)) };
  };

  // Reset to a clean form each time the modal is freshly opened.
  useEffect(() => {
    if (open) {
      setEmail('');
      setPrefs([emptyPref()]);
      setSending(false);
      setError('');
      setDone(false);
    }
  }, [open]);

  // Accepts a plain patch or an updater (r => patch). The updater form reads the LATEST
  // pref, so toggling several chips quickly never clobbers earlier selections.
  const updatePref = (i: number, patch: Partial<Pref> | ((r: Pref) => Partial<Pref>)) =>
    setPrefs((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r)));

  const addPref = () => setPrefs((rows) => (rows.length >= MAX_PREFS ? rows : [...rows, emptyPref()]));

  const removePref = (i: number) => setPrefs((rows) => rows.filter((_, idx) => idx !== i));

  const submit = async () => {
    setError('');
    const trimmedEmail = email.trim();
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    const activePrefs = prefs
      .map((p, index) => ({ p, index }))
      .filter(({ p }) => hasContent(p));
    if (activePrefs.length === 0) {
      setError('Add at least one preference (make, model, or other filter).');
      return;
    }

    setSending(true);
    try {
      const watchlists = activePrefs.map(({ p, index }) => ({
        name: nameFor(p, index),
        filters: buildFilters(p),
        active: true,
      }));
      // start_subscription (SECURITY DEFINER RPC) upserts the subscriber and replaces
      // their watchlists in one call — so re-signup after unsubscribe works instead of
      // hitting the unique-email constraint. Returns the subscriber id.
      const { data: subId, error: rpcErr } = await supabase.rpc('start_subscription', {
        p_email: trimmedEmail,
        p_watchlists: watchlists,
      });
      if (rpcErr || !subId) {
        setError('Something went wrong. Please try again in a moment.');
        setSending(false);
        return;
      }

      // Send the confirmation email instantly. Non-fatal: the twice-daily cron
      // (send-confirmations.mjs) re-sends to anyone this misses.
      try {
        await supabase.functions.invoke('send-confirmation', { body: { id: subId } });
      } catch {
        /* cron fallback covers a failed instant send */
      }

      setDone(true);
    } catch {
      setError('Something went wrong. Please try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  return (
    <dialog
      ref={ref}
      className="listing-modal"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="lm-wrap">
        <div className="lm-head">
          <button className="lm-x" onClick={onClose} aria-label="Close" type="button">×</button>
          <div className="lm-title alerts-title">Get deal alerts</div>
          <p className="hint-line" style={{ margin: '4px 0 0' }}>
            Get an email twice a day when matching cars hit the market. Add up to {MAX_PREFS} preferences.
          </p>
        </div>

        {done ? (
          <div className="lm-body">
            <div className="alerts-success">
              <div className="alerts-success-icon" aria-hidden="true">✓</div>
              <p className="alerts-success-title">Check your email to confirm your subscription.</p>
              <p className="hint-line" style={{ marginBottom: 0 }}>
                We sent a confirmation link to <strong>{email.trim()}</strong>. Click it to start receiving alerts.
              </p>
            </div>
          </div>
        ) : (
          <form
            className="lm-body alerts-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="alerts-field alerts-email">
              <span className="alerts-label">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            {prefs.map((p, i) => (
              <fieldset className="alerts-pref" key={i}>
                <legend className="alerts-pref-legend">
                  Preference {i + 1}
                  {i > 0 ? (
                    <button
                      type="button"
                      className="alerts-remove"
                      aria-label={`Remove preference ${i + 1}`}
                      onClick={() => removePref(i)}
                    >
                      ✕
                    </button>
                  ) : null}
                </legend>
                <div className="alerts-grid">
                  <label className="alerts-field" style={{ gridColumn: '1 / -1' }}>
                    <span className="alerts-label">Name this alert</span>
                    <input type="text" placeholder="e.g. My RAV4 hunt" value={p.name} onChange={(e) => updatePref(i, { name: e.target.value })} />
                  </label>
                  <MultiSelect label="Make" options={makeOptions} selected={p.makes} onToggle={(v) => updatePref(i, (r) => cleanPref({ ...r, makes: toggle(r.makes, v) }))} />
                  <MultiSelect label="Model" options={modelOptionsFor(p)} selected={p.models} onToggle={(v) => updatePref(i, (r) => cleanPref({ ...r, models: toggle(r.models, v) }))} />
                  <MultiSelect label="Trim" options={trimOptionsFor(p)} selected={p.trims} onToggle={(v) => updatePref(i, (r) => ({ trims: toggle(r.trims, v) }))} />
                  <MultiSelect label="Fuel type" options={fuelOptionsFor(p)} selected={p.fuels} onToggle={(v) => updatePref(i, (r) => ({ fuels: toggle(r.fuels, v) }))} fmt={(v) => FUEL_LABEL[v] ?? v} />
                  <label className="alerts-field">
                    <span className="alerts-label">Zip</span>
                    <input type="text" inputMode="numeric" placeholder="94016" value={p.zip} onChange={(e) => updatePref(i, { zip: e.target.value })} />
                  </label>
                  <label className="alerts-field">
                    <span className="alerts-label">Radius (mi)</span>
                    <input type="number" min={0} placeholder="50" value={p.radius} onChange={(e) => updatePref(i, { radius: e.target.value })} />
                  </label>
                  <label className="alerts-field">
                    <span className="alerts-label">Min price</span>
                    <input type="number" min={0} placeholder="15000" value={p.priceMin} onChange={(e) => updatePref(i, { priceMin: e.target.value })} />
                  </label>
                  <label className="alerts-field">
                    <span className="alerts-label">Max price</span>
                    <input type="number" min={0} placeholder="35000" value={p.priceMax} onChange={(e) => updatePref(i, { priceMax: e.target.value })} />
                  </label>
                  <label className="alerts-field">
                    <span className="alerts-label">Min year</span>
                    <input type="number" min={0} placeholder="2021" value={p.yearMin} onChange={(e) => updatePref(i, { yearMin: e.target.value })} />
                  </label>
                  <label className="alerts-field">
                    <span className="alerts-label">Max miles</span>
                    <input type="number" min={0} placeholder="60000" value={p.milesMax} onChange={(e) => updatePref(i, { milesMax: e.target.value })} />
                  </label>
                </div>
              </fieldset>
            ))}

            <button
              type="button"
              className="btn ghost alerts-add"
              disabled={prefs.length >= MAX_PREFS}
              onClick={addPref}
            >
              {prefs.length >= MAX_PREFS ? `Max ${MAX_PREFS} preferences` : '+ Add preference'}
            </button>

            {error ? <p className="alerts-error" role="alert">{error}</p> : null}

            <div className="lm-foot alerts-foot">
              <span className="hint-line" style={{ margin: 0 }}>Free. Unsubscribe any time.</span>
              <button className="btn" type="submit" disabled={sending}>
                {sending ? 'Subscribing…' : 'Subscribe'}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
