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
import { ConfirmPage } from './components/ConfirmPage';
import { UnsubscribePage } from './components/UnsubscribePage';
// "Load a real car" (ListingModal) and the Deal Alerts signup (AlertsModal) are paused since
// 2026-11-12 (DECISIONS.md ADR-003): Auto.dev's terms do not allow showing its listings publicly.
// Their components and helpers stay in the repository, unused, so the pause can be reversed.

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

  const atMax = state.vehicles.length >= MAX_CARS;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="logo">🚗</span>
          <div>
            <h1>Car TCO Compare</h1>
            <p className="tagline">Know what a car <em>really</em> costs — not just the sticker price. Compare the 5-year total cost of ownership across up to 6 cars (new or used; gas, hybrid, or EV).</p>
            <a className="brand-by" href="https://ai.xuseak.com/" target="_blank" rel="noopener noreferrer">by XuSeak&nbsp;↗</a>
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
        <p className="foot-note">Your inputs auto-save in this browser and sync to the URL — use 🔗 Share to send a comparison. Cost assumptions are illustrative.</p>
        <p className="foot-brand"><span aria-hidden="true">🚗</span> Car TCO Compare — a project by <a href="https://ai.xuseak.com/" target="_blank" rel="noopener noreferrer">XuSeak&nbsp;↗</a></p>
      </footer>
    </>
  );
}
