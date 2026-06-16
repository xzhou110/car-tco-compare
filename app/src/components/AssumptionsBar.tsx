import { useState, type ChangeEvent } from 'react';
import type { Assumptions } from '../types';
import { NumField } from './Field';

const round2 = (x: number) => Math.round(x * 100) / 100;
const num = (e: ChangeEvent<HTMLInputElement>) => parseFloat(e.target.value) || 0;

interface Props {
  a: Assumptions;
  update: (fn: (a: Assumptions) => void) => void;
  onSaveDefaults: () => void;
}

export function AssumptionsBar({ a, update, onSaveDefaults }: Props) {
  const f = a.financing;
  const [saved, setSaved] = useState(false);
  const handleSaveDefaults = () => {
    onSaveDefaults();
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };
  return (
    <section className="card assume">
      <div className="assume-head">
        <div>
          <h2>Shared assumptions</h2>
          <p className="hint-line">
            These apply to <strong>every</strong> car, so the comparison is apples-to-apples.
          </p>
        </div>
        <button
          className="btn ghost tiny"
          onClick={handleSaveDefaults}
          title="Remember these settings as your defaults for new sessions and Reset"
        >
          {saved ? 'Saved as defaults ✓' : '☆ Save as my defaults'}
        </button>
      </div>
      <div className="assume-grid">
        <NumField label="Holding period" suf="yr" step={1} value={a.holdingYears} onChange={(n) => update((d) => { d.holdingYears = Math.max(1, Math.round(n ?? 1) || 1); })} />
        <NumField label="Annual miles" suf="mi" step={1000} value={a.annualMiles} onChange={(n) => update((d) => { d.annualMiles = Math.max(0, n ?? 0); })} />
        <NumField label="Sales tax" suf="%" step={0.5} value={round2(a.salesTaxRate * 100)} onChange={(n) => update((d) => { d.salesTaxRate = (n ?? 0) / 100; })} />
        <NumField label="Registration (est)" pre="$" suf="/yr" step={25} value={a.registrationAnnual} onChange={(n) => update((d) => { d.registrationAnnual = n ?? 0; })} />
        <NumField label="Fuel price" pre="$" suf="/gal" step={0.05} value={a.fuelPricePerGallon} onChange={(n) => update((d) => { d.fuelPricePerGallon = n ?? 0; })} />
        <NumField label="Electricity" pre="$" suf="/kWh" step={0.01} value={a.electricityPricePerKWh} onChange={(n) => update((d) => { d.electricityPricePerKWh = n ?? 0; })} />
      </div>
      <div className="fin-block">
        <label className="switch">
          <input type="checkbox" checked={f.enabled} onChange={(e) => update((d) => { d.financing.enabled = e.target.checked; })} />
          <span>Finance (interest counts toward TCO)</span>
        </label>
        {f.enabled && (
          <div className="fin-brackets">
            <p className="hint-line">
              New and used get different terms — each car uses the bracket matching its condition. Down payment is a % of price.
            </p>
            {(['new', 'used'] as const).map((cond) => (
              <div className="fin-row" key={cond}>
                <span className="fin-cond">{cond}</span>
                <label className="mini">
                  <span>Down</span>
                  <span className="input-wrap">
                    <input type="number" step={1} value={round2(f[cond].downPct * 100)} onChange={(e) => update((d) => { d.financing[cond].downPct = num(e) / 100; })} />
                    <span className="adorn suf">%</span>
                  </span>
                </label>
                <label className="mini">
                  <span>APR</span>
                  <span className="input-wrap">
                    <input type="number" step={0.1} value={round2(f[cond].apr * 100)} onChange={(e) => update((d) => { d.financing[cond].apr = num(e) / 100; })} />
                    <span className="adorn suf">%</span>
                  </span>
                </label>
                <label className="mini">
                  <span>Term</span>
                  <span className="input-wrap">
                    <input type="number" step={1} value={f[cond].termYears} onChange={(e) => update((d) => { d.financing[cond].termYears = Math.max(1, Math.round(num(e)) || 1); })} />
                    <span className="adorn suf">yr</span>
                  </span>
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
