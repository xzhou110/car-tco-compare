import { useMemo, useState } from 'react';
import { useComparison } from './state/useComparison';
import { computeTco, seedResaleValue } from './lib/tco';
import { MAX_CARS, MIN_CARS, PRESETS, slotColor } from './data/presets';
import { AssumptionsBar } from './components/AssumptionsBar';
import { VehicleCard } from './components/VehicleCard';
import { ResultsSummary, type ResultItem } from './components/ResultsSummary';
import { CategoryBreakdown } from './components/CategoryBreakdown';
import { CumulativeChart } from './components/CumulativeChart';
import { HowItWorks } from './components/HowItWorks';
import { SavedCarsManager } from './components/SavedCarsManager';

export default function App() {
  const cmp = useComparison();
  const { state } = cmp;
  const [copied, setCopied] = useState(false);

  const items: ResultItem[] = useMemo(() => {
    const results = state.vehicles.map((v) => computeTco(v, state.assumptions));
    const order = results.map((r, i) => ({ total: r.total, i })).sort((a, b) => a.total - b.total);
    const rankByIndex = new Map<number, number>();
    order.forEach((o, idx) => rankByIndex.set(o.i, idx + 1));
    const bestIndex = order[0].i;
    return state.vehicles.map((v, i) => ({
      vehicle: v,
      result: results[i],
      color: slotColor(i),
      rank: rankByIndex.get(i)!,
      isBest: i === bestIndex,
    }));
  }, [state]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(cmp.shareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  const atMax = state.vehicles.length >= MAX_CARS;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="logo">🚗</span>
          <div>
            <h1>Car TCO Compare</h1>
            <p className="tagline">Total cost of ownership, side by side — compare up to 6 cars: new vs. used, EV vs. gas, any A vs. B vs. C.</p>
          </div>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={share} title="Copy a shareable link to this comparison">
            {copied ? 'Link copied ✓' : '🔗 Share'}
          </button>
          <button
            className="btn"
            onClick={() => {
              if (confirm('Reset all inputs to defaults? This clears your saved session.')) cmp.reset();
            }}
          >
            Reset
          </button>
        </div>
      </header>

      <AssumptionsBar a={state.assumptions} update={cmp.updateAssumptions} onSaveDefaults={cmp.saveAssumptionDefaults} />

      <section className="vehicles-section">
        <div className="vehicles">
          {state.vehicles.map((v, i) => (
            <VehicleCard
              key={v.id}
              index={i}
              vehicle={v}
              color={slotColor(i)}
              removable={state.vehicles.length > MIN_CARS}
              presets={PRESETS}
              profiles={cmp.profiles}
              resaleSeed={seedResaleValue(v, state.assumptions)}
              update={(fn) => cmp.updateVehicle(i, fn)}
              onLoad={(nv) => cmp.loadVehicle(i, nv)}
              onRemove={() => cmp.removeVehicle(i)}
              onSave={() => cmp.saveProfile(v)}
            />
          ))}
        </div>
        <button className="btn ghost add-btn" disabled={atMax} onClick={cmp.addVehicle}>
          {atMax ? `Max ${MAX_CARS} cars` : '+ Add car'}
        </button>
        <SavedCarsManager profiles={cmp.profiles} onDelete={cmp.deleteProfile} />
      </section>

      <section className="card results-card">
        <h2>Results</h2>
        <ResultsSummary items={items} holdingYears={state.assumptions.holdingYears} financingEnabled={state.assumptions.financing.enabled} />
        <div className="panels">
          <CategoryBreakdown items={items} holdingYears={state.assumptions.holdingYears} />
          <CumulativeChart items={items} />
        </div>
        <HowItWorks />
      </section>

      <footer className="foot">
        Your inputs auto-save in this browser and sync to the URL — use 🔗 Share to send a comparison. All numbers illustrative.
      </footer>
    </>
  );
}
