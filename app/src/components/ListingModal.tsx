import { useEffect, useMemo, useRef, useState } from 'react';
import type { Listing, ListingsSnapshot } from '../types';
import { SEGMENT_LIST, REGION_LIST } from '../data/reference';
import { filterListings } from '../lib/listings';

interface Props {
  open: boolean;
  snapshot: ListingsSnapshot | null;
  loading: boolean;
  region: string;
  addedCount: number;
  onRegionChange: (r: string) => void;
  onAdd: (l: Listing) => void;
  onClose: () => void;
}

const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

export function ListingModal({ open, snapshot, loading, region, addedCount, onRegionChange, onAdd, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [segment, setSegment] = useState('');
  const [condition, setCondition] = useState('');
  const [powertrain, setPowertrain] = useState('');
  const [minYear, setMinYear] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const listings = snapshot?.listings ?? [];
  const makes = useMemo(() => [...new Set(listings.map((l) => l.make).filter(Boolean))].sort(), [listings]);
  const models = useMemo(
    () => [...new Set(listings.filter((l) => !make || l.make === make).map((l) => l.model).filter(Boolean))].sort(),
    [listings, make],
  );
  const years = useMemo(
    () => [...new Set(listings.map((l) => l.year).filter((y): y is number => typeof y === 'number'))].sort((a, b) => b - a),
    [listings],
  );
  const filtered = useMemo(
    () => filterListings(listings, { make, model, segment, condition, powertrain, maxPrice: maxPrice ? +maxPrice : undefined, minYear: minYear ? +minYear : undefined }),
    [listings, make, model, segment, condition, powertrain, maxPrice, minYear],
  );
  const shown = filtered.slice(0, 60);

  const note = loading
    ? 'Loading listings…'
    : snapshot
      ? `${listings.length} real Auto.dev listings · snapshot ${new Date(snapshot.generatedAt).toLocaleDateString()} · RAV4 · Highlander · CR-V (2020+)`
      : 'Could not load listings — you can still add cars manually.';

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
          <button className="lm-x" onClick={onClose} aria-label="Close">×</button>
          <div className="lm-title">Load a real car</div>
          <p className="hint-line" style={{ margin: '4px 0 0' }}>{note}</p>
        </div>

        <div className="lm-body">
          <div className="lm-filters">
            <select value={make} onChange={(e) => { setMake(e.target.value); setModel(''); }}>
              <option value="">Any make</option>
              {makes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="">Any model</option>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select value={minYear} onChange={(e) => setMinYear(e.target.value)} title="Minimum year">
              <option value="">Any year</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}+</option>
              ))}
            </select>
            <select value={segment} onChange={(e) => setSegment(e.target.value)}>
              <option value="">Any segment</option>
              {SEGMENT_LIST.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <select value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="">Any condition</option>
              <option value="new">New</option>
              <option value="used">Used</option>
            </select>
            <select value={powertrain} onChange={(e) => setPowertrain(e.target.value)}>
              <option value="">Any fuel type</option>
              <option value="gas">Gas</option>
              <option value="hybrid">Hybrid</option>
              <option value="ev">EV</option>
            </select>
            <input type="number" placeholder="Max $" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={{ width: 110 }} />
            <select value={region} onChange={(e) => onRegionChange(e.target.value)} title="Region — sets the cost assumptions (fuel, tax, rates) applied to imported cars">
              {REGION_LIST.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>

          <p className="hint-line">{filtered.length} match{filtered.length === 1 ? '' : 'es'}{filtered.length > 60 ? ' (showing first 60)' : ''}</p>

          {loading ? (
            <div className="lm-grid" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="lcard lcard-skeleton" key={i}>
                  <span className="sk sk-title" />
                  <span className="sk sk-price" />
                  <span className="sk sk-meta" />
                  <span className="sk sk-badges" />
                  <span className="sk sk-btn" />
                </div>
              ))}
            </div>
          ) : null}

          <div className="lm-grid">
            {shown.map((L) => (
              <div className="lcard" key={L.vin || L.url}>
                <div className="lcard-title">
                  {L.year} {L.make} {L.model}{L.trim ? <small> {L.trim}</small> : null}
                </div>
                <div className="lcard-price">{L.price != null ? usd(L.price) : '—'}</div>
                <div className="lcard-meta">
                  {[L.mileage != null ? L.mileage.toLocaleString() + ' mi' : null, L.location, L.mpg ? L.mpg + ' mpg' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <div>
                  <span className="lbadge">{L.segment}</span>
                  <span className="lbadge">{L.powertrain}</span>
                  <span className="lbadge">{L.condition}</span>
                </div>
                <button className="btn tiny" onClick={() => onAdd(L)}>+ Add to compare</button>
              </div>
            ))}
            {!loading && shown.length === 0 ? (
              <div className="lm-empty">
                <div className="lm-empty-icon" aria-hidden="true">🔍</div>
                <p className="lm-empty-title">No listings match these filters</p>
                <p className="lm-empty-sub">Try widening your price range or clearing a filter.</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="lm-foot">
          <span className="lm-added">{addedCount > 0 ? `✓ added ${addedCount} ${addedCount === 1 ? 'car' : 'cars'} to your comparison` : ''}</span>
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </dialog>
  );
}
