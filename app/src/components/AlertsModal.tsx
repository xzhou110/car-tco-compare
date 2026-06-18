import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { loadListingsSnapshot } from '../lib/listings';
import type { Listing } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Pref {
  name: string;
  make: string;
  model: string;
  powertrain: string;
  zip: string;
  radius: string;
  priceMin: string;
  priceMax: string;
  yearMin: string;
  milesMax: string;
  trims: string[];
}

const MAX_PREFS = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyPref = (): Pref => ({
  name: '',
  make: '',
  model: '',
  powertrain: '',
  zip: '',
  radius: '',
  priceMin: '',
  priceMax: '',
  yearMin: '',
  milesMax: '',
  trims: [],
});

/** Parse a numeric field; blank/invalid -> undefined so it is omitted from the filters jsonb. */
const num = (s: string): number | undefined => {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

const hasContent = (p: Pref): boolean =>
  !!(p.make.trim() || p.model.trim() || p.powertrain.trim() || p.zip.trim() || p.radius.trim() || p.priceMin.trim() || p.priceMax.trim() || p.yearMin.trim() || p.milesMax.trim());

/** Build the exact filters jsonb the cron reads: numbers as numbers, blanks omitted. */
function buildFilters(p: Pref) {
  const f: Record<string, unknown> = {};
  if (p.make.trim()) f.make = p.make.trim();
  if (p.model.trim()) f.model = p.model.trim();
  if (p.powertrain.trim()) f.powertrain = p.powertrain.trim();
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
  // Selected trims (data-driven, model-aware); omit the key entirely when none chosen.
  if (p.trims.length > 0) f.trims = p.trims;
  return f;
}

/** Resolve the alert's display name: explicit name, else "make model", else "Preference N". */
const nameFor = (p: Pref, index: number): string => {
  const explicit = p.name.trim();
  if (explicit) return explicit;
  const makeModel = `${p.make} ${p.model}`.trim();
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

  // Trim works as a standalone filter too: scope options to make/model when chosen,
  // otherwise offer every trim in the snapshot so it's usable before a model is picked.
  const trimOptionsFor = (p: Pref): string[] => {
    const make = p.make.trim().toLowerCase();
    const model = p.model.trim().toLowerCase();
    const set = new Set<string>();
    for (const L of listings) {
      if (make && L.make.toLowerCase() !== make) continue;
      if (model && L.model.toLowerCase() !== model) continue;
      if (L.trim) set.add(L.trim);
    }
    return [...set].sort();
  };

  // Distinct makes / models / fuel types in the snapshot — drive the dropdowns so the
  // selected values always match the data (and trim/fuel options can populate).
  const makeOptions = [...new Set(listings.map((l) => l.make).filter(Boolean))].sort();
  const modelOptionsFor = (p: Pref): string[] => {
    const make = p.make.trim().toLowerCase();
    return [...new Set(listings.filter((l) => !make || l.make.toLowerCase() === make).map((l) => l.model).filter(Boolean))].sort();
  };
  // Fuel type works as a standalone filter: scope options to make/model when chosen,
  // otherwise offer every powertrain in the snapshot so it's usable before a model is picked.
  const fuelOptionsFor = (p: Pref): string[] => {
    const make = p.make.trim().toLowerCase();
    const model = p.model.trim().toLowerCase();
    const set = new Set<string>();
    for (const L of listings) {
      if (make && L.make.toLowerCase() !== make) continue;
      if (model && L.model.toLowerCase() !== model) continue;
      if (L.powertrain) set.add(L.powertrain);
    }
    return [...set].sort();
  };
  const FUEL_LABEL: Record<string, string> = { gas: 'Gas', hybrid: 'Hybrid', ev: 'EV' };

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

  const updatePref = (i: number, patch: Partial<Pref>) =>
    setPrefs((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

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
      const id = crypto.randomUUID();
      // RLS allows INSERT only — do NOT chain .select() or it will be blocked.
      const { error: subErr } = await supabase
        .from('subscribers')
        .insert({ id, email: trimmedEmail, confirmed: false });
      if (subErr) {
        if (subErr.code === '23505') {
          setError("You're already subscribed with that email.");
        } else {
          setError('Something went wrong. Please try again in a moment.');
        }
        setSending(false);
        return;
      }

      const rows = activePrefs.map(({ p, index }) => ({
        subscriber_id: id,
        name: nameFor(p, index),
        filters: buildFilters(p),
        active: true,
      }));
      const { error: wlErr } = await supabase.from('watchlists').insert(rows);
      if (wlErr) {
        setError('We saved your email but could not save your alerts. Please try again.');
        setSending(false);
        return;
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
                  <label className="alerts-field">
                    <span className="alerts-label">Make</span>
                    <select value={p.make} onChange={(e) => updatePref(i, { make: e.target.value, model: '', powertrain: '', trims: [] })}>
                      <option value="">Any make</option>
                      {makeOptions.map((m) => (<option key={m} value={m}>{m}</option>))}
                    </select>
                  </label>
                  <label className="alerts-field">
                    <span className="alerts-label">Model</span>
                    <select value={p.model} onChange={(e) => updatePref(i, { model: e.target.value, powertrain: '', trims: [] })}>
                      <option value="">Any model</option>
                      {modelOptionsFor(p).map((m) => (<option key={m} value={m}>{m}</option>))}
                    </select>
                  </label>
                  <label className="alerts-field">
                    <span className="alerts-label">Trim</span>
                    <select value={p.trims[0] ?? ''} onChange={(e) => updatePref(i, { trims: e.target.value ? [e.target.value] : [] })}>
                      <option value="">Any trim</option>
                      {trimOptionsFor(p).map((t) => (<option key={t} value={t}>{t}</option>))}
                    </select>
                  </label>
                  <label className="alerts-field">
                    <span className="alerts-label">Fuel type</span>
                    <select value={p.powertrain} onChange={(e) => updatePref(i, { powertrain: e.target.value })}>
                      <option value="">Any fuel</option>
                      {fuelOptionsFor(p).map((f) => (<option key={f} value={f}>{FUEL_LABEL[f] ?? f}</option>))}
                    </select>
                  </label>
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
