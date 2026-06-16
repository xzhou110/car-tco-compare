import type { ResultItem } from './ResultsSummary';
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_ORDER } from '../data/presets';
import { usd, usdK } from '../lib/format';

// Car legend (slot colors) — reused by the cumulative chart.
export function Legend({ items }: { items: ResultItem[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span className="lg" key={it.vehicle.id}>
          <span className="dot" style={{ background: it.color.c }} />
          {it.vehicle.name}
        </span>
      ))}
    </div>
  );
}

interface Props {
  items: ResultItem[];
  holdingYears: number;
}

// Vertical stacked columns: one column per car (taller = costs more), segments =
// cost components in a fixed bottom-to-top order/color. Category legend at the bottom.
export function CategoryBreakdown({ items, holdingYears }: Props) {
  const grossOf = (it: ResultItem) => CATEGORY_ORDER.reduce((s, c) => s + it.result.byCategory[c], 0);
  const maxGross = Math.max(1, ...items.map(grossOf));

  return (
    <div className="panel">
      <h3>
        Cost breakdown <small>({holdingYears}-yr totals)</small>
      </h3>
      <div className="vstack">
        {items.map((it) => {
          const gross = grossOf(it);
          return (
            <div className="vcol" key={it.vehicle.id}>
              <div className="vcol-total">{usdK(it.result.total)}</div>
              <div className="vcol-plot">
                <div className="vcol-bar" style={{ height: `${(gross / maxGross) * 100}%` }}>
                  {CATEGORY_ORDER.map((c) => {
                    const val = it.result.byCategory[c];
                    if (val <= 0) return null;
                    return (
                      <span
                        key={c}
                        className="vseg"
                        style={{ height: `${(val / gross) * 100}%`, background: CATEGORY_COLORS[c] }}
                        title={`${CATEGORY_LABELS[c]}: ${usd(val)}`}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="vcol-label">
                <span className="dot" style={{ background: it.color.c }} />
                <span className="vcol-name" title={it.vehicle.name}>{it.vehicle.name || 'Unnamed car'}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="legend legend-bottom">
        {CATEGORY_ORDER.map((c) => (
          <span className="lg" key={c}>
            <span className="dot" style={{ background: CATEGORY_COLORS[c] }} />
            {CATEGORY_LABELS[c]}
          </span>
        ))}
      </div>
    </div>
  );
}
