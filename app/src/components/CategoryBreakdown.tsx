import type { ResultItem } from './ResultsSummary';
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_ORDER } from '../data/presets';
import { usd } from '../lib/format';

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

// Stacked horizontal bar per car: one bar each, segments = cost components in a
// fixed order/color, bar length ∝ total spend so cars are directly comparable.
export function CategoryBreakdown({ items, holdingYears }: Props) {
  const grossOf = (it: ResultItem) => CATEGORY_ORDER.reduce((s, c) => s + it.result.byCategory[c], 0);
  const maxGross = Math.max(1, ...items.map(grossOf));

  return (
    <div className="panel">
      <h3>
        Cost breakdown <small>({holdingYears}-yr totals)</small>
      </h3>
      <div className="legend">
        {CATEGORY_ORDER.map((c) => (
          <span className="lg" key={c}>
            <span className="dot" style={{ background: CATEGORY_COLORS[c] }} />
            {CATEGORY_LABELS[c]}
          </span>
        ))}
      </div>
      <div className="stack-table">
        {items.map((it) => {
          const gross = grossOf(it);
          const incentives = it.vehicle.incentives || 0;
          return (
            <div className="stack-row" key={it.vehicle.id}>
              <div className="stack-label">
                <span className="dot" style={{ background: it.color.c }} />
                <span className="stack-name" title={it.vehicle.name}>{it.vehicle.name || 'Unnamed car'}</span>
              </div>
              <div className="stack-bar">
                <div className="stack-track" style={{ width: `${(gross / maxGross) * 100}%` }}>
                  {CATEGORY_ORDER.map((c) => {
                    const val = it.result.byCategory[c];
                    if (val <= 0) return null;
                    return (
                      <span
                        key={c}
                        className="seg"
                        style={{ width: `${(val / gross) * 100}%`, background: CATEGORY_COLORS[c] }}
                        title={`${CATEGORY_LABELS[c]}: ${usd(val)}`}
                      />
                    );
                  })}
                </div>
                <b className="stack-total">
                  {usd(it.result.total)}
                  {incentives > 0 && <small className="stack-credit"> incl. −{usd(incentives)} credit</small>}
                </b>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
