// Custom "Load…" dropdown: load a preset or saved car, and delete saved cars
// inline (✕ right in the list). Built on <details> with outside-click / Esc close.
import { useEffect, useRef } from 'react';
import type { Vehicle } from '../types';

interface Props {
  presets: Vehicle[];
  profiles: Record<string, Vehicle>;
  onLoad: (v: Vehicle) => void;
  onDeleteProfile: (name: string) => void;
}

export function LoadMenu({ presets, profiles, onLoad, onDeleteProfile }: Props) {
  const ref = useRef<HTMLDetailsElement>(null);
  const savedNames = Object.keys(profiles);

  useEffect(() => {
    const close = () => ref.current && (ref.current.open = false);
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const close = () => ref.current && (ref.current.open = false);

  return (
    <details className="load-menu" ref={ref}>
      <summary className="load-trigger" aria-label="Load a preset or saved car">Load…</summary>
      <div className="load-pop" role="menu">
        <div className="load-group-label">Presets</div>
        {presets.map((p) => (
          <button className="load-item" role="menuitem" key={p.id} onClick={() => { onLoad(p); close(); }}>
            {p.name}
          </button>
        ))}
        {savedNames.length > 0 && <div className="load-group-label">Saved</div>}
        {savedNames.map((n) => (
          <div className="load-item-row" key={n}>
            <button className="load-item" role="menuitem" onClick={() => { onLoad(profiles[n]); close(); }}>
              {n}
            </button>
            <button
              className="load-del"
              aria-label={`Remove saved car ${n}`}
              title={`Remove “${n}”`}
              onClick={() => {
                if (confirm(`Remove saved car “${n}”? This only deletes the saved entry, not any car in the comparison.`)) onDeleteProfile(n);
              }}
            >
              ✕
            </button>
          </div>
        ))}
        {savedNames.length === 0 && <div className="load-empty">Save a car with 💾 to reuse it here.</div>}
      </div>
    </details>
  );
}
