import type { ResultItem } from './ResultsSummary';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../data/presets';
import { usd } from '../lib/format';

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

export function CategoryBreakdown({ items, holdingYears }: Props) {
  const maxCat = Math.max(1, ...CATEGORY_ORDER.flatMap((c) => items.map((it) => it.result.byCategory[c])));
  return (
    <div className="panel">
      <h3>
        Where the money goes <small>({holdingYears}-yr totals)</small>
      </h3>
      <Legend items={items} />
      <div className="cat-table">
        {CATEGORY_ORDER.map((c) => (
          <div className="cat-row" key={c}>
            <div className="cat-name">{CATEGORY_LABELS[c]}</div>
            <div className="cat-bars">
              {items.map((it) => {
                const val = it.result.byCategory[c];
                return (
                  <div className="bar" key={it.vehicle.id}>
                    <span className="track">
                      <span
                        className="fill"
                        style={{ width: `${(val / maxCat) * 100}%`, background: `linear-gradient(90deg, ${it.color.c}cc, ${it.color.c})` }}
                      />
                    </span>
                    <b>{usd(val)}</b>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
