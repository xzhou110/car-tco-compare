// One-stop place to delete cars you've saved with 💾, so the Load… list
// doesn't grow forever. Single instance (lives next to "+ Add car").
import type { Vehicle } from '../types';

interface Props {
  profiles: Record<string, Vehicle>;
  onDelete: (name: string) => void;
}

export function SavedCarsManager({ profiles, onDelete }: Props) {
  const names = Object.keys(profiles);
  if (names.length === 0) return null;

  return (
    <details className="saved-manager">
      <summary>
        <span>★ Saved cars ({names.length})</span>
        <span className="chev">›</span>
      </summary>
      <div className="saved-list">
        {names.map((n) => (
          <span className="saved-chip" key={n}>
            <span className="saved-chip-name" title={n}>{n}</span>
            <button
              className="saved-chip-del"
              aria-label={`Remove saved car ${n}`}
              title={`Remove “${n}”`}
              onClick={() => {
                if (confirm(`Remove saved car “${n}”? This only deletes the saved entry, not any car in the current comparison.`)) onDelete(n);
              }}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <p className="hint-line">Cars you saved with 💾 appear in each card's “Load…” menu. Remove ones you no longer need here.</p>
    </details>
  );
}
