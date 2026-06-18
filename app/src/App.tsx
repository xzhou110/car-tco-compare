import { useEffect, useMemo, useState } from 'react';
import { useComparison } from './state/useComparison';
import { computeTco, seedResaleValue } from './lib/tco';
import { MAX_CARS, MIN_CARS, PRESETS, slotColor } from './data/presets';
import { AssumptionsBar } from './components/AssumptionsBar';
import { VehicleCard } from './components/VehicleCard';
import { ResultsSummary, type ResultItem } from './components/ResultsSummary';
import { CategoryBreakdown } from './components/CategoryBreakdown';
import { CumulativeChart } from './components/CumulativeChart';
import { HowItWorks } from './components/HowItWorks';
import { ListingModal } from './components/ListingModal';
import { AlertsModal } from './components/AlertsModal';
import { ConfirmPage } from './components/ConfirmPage';
import { UnsubscribePage } from './components/UnsubscribePage';
import { loadListingsSnapshot } from './lib/listings';
import { resolveVehicle } from './lib/resolveVehicle';
import { REFERENCE } from './data/reference';
import type { Listing, ListingsSnapshot } from './types';

/**
 * Hash-based routing (no router lib). Splits the hash into a path and a query
 * string so the token survives regardless of leading "#", "#/", or order of
 * "?token=…". Returns the matched route plus the parsed token.
 */
type Route = { page: 'confirm' | 'unsubscribe' | 'app'; token: string };

function parseHashRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, ''); // drop leading "#" and optional "/"
  const qIndex = raw.indexOf('?');
  const path = (qIndex >= 0 ? raw.slice(0, qIndex) : raw).replace(/\/+$/, '');
  const query = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
  const token = new URLSearchParams(query).get('token') ?? '';
  if (path === 'confirm') return { page: 'confirm', token };
  if (path === 'unsubscribe') return { page: 'unsubscribe', token };
  return { page: 'app', token: '' };
}

export default function App() {
  const [route, setRoute] = useState<Route>(() =>
    parseHashRoute(typeof window !== 'undefined' ? window.location.hash : ''),
  );

  useEffect(() => {
    const onHashChange = () => setRoute(parseHashRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (route.page === 'confirm') return <ConfirmPage token={route.token} />;
  if (route.page === 'unsubscribe') return <UnsubscribePage token={route.token} />;
  return <MainApp />;
}

function MainApp() {
  const cmp = useComparison();
  const { state } = cmp;
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('carTcoTheme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

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

  const [modalOpen, setModalOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ListingsSnapshot | null>(null);
  const [snapLoading, setSnapLoading] = useState(false);
  const [region, setRegion] = useState('national');
  const [addedCount, setAddedCount] = useState(0);

  const openModal = async () => {
    setAddedCount(0);
    setModalOpen(true);
    if (!snapshot && !snapLoading) {
      setSnapLoading(true);
      setSnapshot(await loadListingsSnapshot());
      setSnapLoading(false);
    }
  };

  const onRegionChange = (r: string) => {
    setRegion(r);
    const reg = REFERENCE.regions[r] ?? REFERENCE.regions.national;
    cmp.updateAssumptions((a) => {
      a.fuelPricePerGallon = reg.fuelPricePerGallon;
      a.electricityPricePerKWh = reg.electricityPricePerKWh;
      a.salesTaxRate = reg.salesTaxRate;
      a.registrationAnnual = reg.registrationAnnual;
    });
  };

  const onAddListing = (l: Listing) => {
    const name = [l.year, l.make, l.model, l.trim].filter(Boolean).join(' ');
    const v = resolveVehicle(
      { name, segment: l.segment, powertrain: l.powertrain, condition: l.condition, purchasePrice: l.price ?? 0, year: l.year, mileage: l.mileage ?? 0, mpg: l.mpg },
      region,
    );
    cmp.importVehicle(v);
    setAddedCount((n) => n + 1);
  };

  const atMax = state.vehicles.length >= MAX_CARS;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="logo">🚗</span>
          <div>
            <h1>Car TCO Compare</h1>
            <p className="tagline">Compare total cost of ownership, side by side — up to 6 cars: new vs. used, EV vs. gas.</p>
          </div>
        </div>
        <div className="actions">
          {/* Utility buttons grouped first, then the blue primary actions together. */}
          <button
            className="btn ghost theme-toggle"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="btn ghost" onClick={share} title="Copy a shareable link to this comparison">
            {copied ? 'Link copied ✓' : '🔗 Share'}
          </button>
          <button className="btn hdr-cta" onClick={openModal} title="Load a real car for sale from Auto.dev">
            🔎 Load a real car
          </button>
          <button className="btn hdr-cta" onClick={() => setAlertsOpen(true)} title="Get an email when matching cars hit the market">
            🔔 Get deal alerts
          </button>
          <button
            className="btn hdr-cta"
            onClick={() => {
              if (confirm('Reset all inputs to defaults? This clears your saved session.')) cmp.reset();
            }}
          >
            Reset
          </button>
        </div>
      </header>

      <section className="card results-card">
        <h2>Results</h2>
        <ResultsSummary items={items} holdingYears={state.assumptions.holdingYears} financingEnabled={state.assumptions.financing.enabled} />
        <div className="panels">
          <CategoryBreakdown items={items} holdingYears={state.assumptions.holdingYears} />
          <CumulativeChart items={items} />
        </div>
      </section>

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
              onDeleteProfile={cmp.deleteProfile}
            />
          ))}
        </div>
        <button className="btn ghost add-btn" disabled={atMax} onClick={cmp.addVehicle}>
          {atMax ? `Max ${MAX_CARS} cars` : '+ Add car'}
        </button>
      </section>

      <section className="card">
        <HowItWorks />
      </section>

      <footer className="foot">
        Your inputs auto-save in this browser and sync to the URL — use 🔗 Share to send a comparison. Listings are an Auto.dev snapshot (best-effort — verify before buying); cost assumptions are illustrative.
      </footer>

      <ListingModal
        open={modalOpen}
        snapshot={snapshot}
        loading={snapLoading}
        region={region}
        addedCount={addedCount}
        onRegionChange={onRegionChange}
        onAdd={onAddListing}
        onClose={() => setModalOpen(false)}
      />

      <AlertsModal open={alertsOpen} onClose={() => setAlertsOpen(false)} />
    </>
  );
}
