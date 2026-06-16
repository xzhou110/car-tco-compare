import type { Vehicle } from '../types';
import type { SlotColor } from '../data/presets';
import { NumField, SelectField, TextField } from './Field';

interface Props {
  index: number;
  vehicle: Vehicle;
  color: SlotColor;
  removable: boolean;
  presets: Vehicle[];
  profiles: Record<string, Vehicle>;
  resaleSeed: number;
  update: (fn: (v: Vehicle) => void) => void;
  onLoad: (v: Vehicle) => void;
  onRemove: () => void;
  onSave: () => void;
}

export function VehicleCard({ index, vehicle: v, color, removable, presets, profiles, resaleSeed, update, onLoad, onRemove, onSave }: Props) {
  const isEv = v.powertrain === 'ev';
  const savedNames = Object.keys(profiles);

  const handleLoad = (val: string) => {
    if (val.startsWith('preset:')) {
      const p = presets.find((x) => x.id === val.slice(7));
      if (p) onLoad(p);
    } else if (val.startsWith('saved:')) {
      const p = profiles[val.slice(6)];
      if (p) onLoad(p);
    }
  };

  return (
    <div className="card vcard" style={{ borderTop: `3px solid ${color.c}` }}>
      <div className="veh-head">
        <span className="veh-tag" style={{ background: color.soft, color: color.ink }}>Car {index + 1}</span>
        <div className="veh-head-actions">
          <select className="load-select" value="" onChange={(e) => handleLoad(e.target.value)} title="Load a preset or saved car">
            <option value="">Load…</option>
            <optgroup label="Presets">
              {presets.map((p) => (
                <option key={p.id} value={`preset:${p.id}`}>{p.name}</option>
              ))}
            </optgroup>
            {savedNames.length > 0 && (
              <optgroup label="Saved">
                {savedNames.map((n) => (
                  <option key={n} value={`saved:${n}`}>{n}</option>
                ))}
              </optgroup>
            )}
          </select>
          <button className="btn tiny" title="Save this car to your browser" onClick={onSave}>💾</button>
          {removable && (
            <button className="btn tiny ghost" title="Remove" onClick={onRemove}>✕</button>
          )}
        </div>
      </div>

      <fieldset>
        <legend>Car</legend>
        <div className="grid">
          <TextField label="Nickname" value={v.name} onChange={(s) => update((d) => { d.name = s; })} />
          <SelectField label="Condition" value={v.condition} options={['new', 'used'] as const} onChange={(c) => update((d) => { d.condition = c; })} />
          <NumField label="Price" pre="$" step={500} value={v.purchasePrice} onChange={(n) => update((d) => { d.purchasePrice = n ?? 0; })} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Energy</legend>
        <div className="grid">
          <SelectField label="Powertrain" value={v.powertrain} options={['gas', 'hybrid', 'ev'] as const} onChange={(p) => update((d) => { d.powertrain = p; })} />
          {isEv ? (
            <NumField label="Efficiency" suf="mi/kWh" step={0.1} value={v.miPerKWh} onChange={(n) => update((d) => { d.miPerKWh = n ?? 0; })} />
          ) : (
            <NumField label="Efficiency" suf="mpg" step={1} value={v.mpg} onChange={(n) => update((d) => { d.mpg = n ?? 0; })} />
          )}
        </div>
      </fieldset>

      <details className="fgroup">
        <summary><span>Depreciation</span><span className="chev">›</span></summary>
        <div className="grid">
          <NumField label="Resale at sale" hint="blank = auto" pre="$" step={500} value={v.resaleValue} placeholder={String(resaleSeed)} onChange={(n) => update((d) => { d.resaleValue = n; })} />
          <NumField label="Age now" suf="yr" step={1} value={v.ageAtPurchase} onChange={(n) => update((d) => { d.ageAtPurchase = n ?? 0; })} />
          <NumField label="Odometer" suf="mi" step={1000} value={v.odometerAtPurchase} onChange={(n) => update((d) => { d.odometerAtPurchase = n ?? 0; })} />
          <NumField label="Incentives" hint="credit" pre="$" step={250} value={v.incentives} onChange={(n) => update((d) => { d.incentives = n ?? 0; })} />
        </div>
      </details>

      <details className="fgroup">
        <summary><span>Running costs</span><span className="chev">›</span></summary>
        <div className="grid">
          <NumField label="Insurance" pre="$" suf="/yr" step={50} value={v.insuranceAnnual} onChange={(n) => update((d) => { d.insuranceAnnual = n ?? 0; })} />
          <NumField label="Maintenance" hint="incl. tires" pre="$" suf="/yr" step={50} value={v.maintenanceAnnual} onChange={(n) => update((d) => { d.maintenanceAnnual = n ?? 0; })} />
          <NumField label="Repairs" hint="post-warranty" pre="$" suf="/yr" step={50} value={v.repairAnnual} onChange={(n) => update((d) => { d.repairAnnual = n ?? 0; })} />
          <NumField label="Warranty" hint="from new" suf="yr" step={1} value={v.warrantyYears} onChange={(n) => update((d) => { d.warrantyYears = n ?? 0; })} />
          <NumField label="Warranty" hint="from new" suf="mi" step={5000} value={v.warrantyMiles} onChange={(n) => update((d) => { d.warrantyMiles = n ?? 0; })} />
        </div>
      </details>
    </div>
  );
}
