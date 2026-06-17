import { useRef, useState } from 'react';
import type { CategoryKey } from '../types';
import type { ResultItem } from './ResultsSummary';
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_ORDER } from '../data/presets';
import { usd, usdK, pct } from '../lib/format';
import { ChartTooltip, type TipPos } from './ChartTooltip';

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

interface SegTip extends TipPos {
  car: string;
  category: CategoryKey;
  value: number;
  gross: number;
}

// Vertical stacked columns: one column per car (taller = costs more), segments =
// cost components in a fixed bottom-to-top order/color. Hovering a segment shows a
// tooltip with the exact dollar value and its share of that car's total spend.
export function CategoryBreakdown({ items, holdingYears }: Props) {
  const grossOf = (it: ResultItem) => CATEGORY_ORDER.reduce((s, c) => s + it.result.byCategory[c], 0);
  const maxGross = Math.max(1, ...items.map(grossOf));

  const areaRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<SegTip | null>(null);

  const onSeg = (e: React.PointerEvent, it: ResultItem, c: CategoryKey, value: number, gross: number) => {
    const area = areaRef.current;
    if (!area) return;
    const r = area.getBoundingClientRect();
    const left = e.clientX - r.left;
    const top = e.clientY - r.top;
    setTip({ left, top, flipX: left > r.width * 0.6, below: top < 78, car: it.vehicle.name, category: c, value, gross });
  };

  return (
    <div className="panel">
      <h3>
        Cost breakdown <small>({holdingYears}-yr totals)</small>
      </h3>
      <div className="chart-area" ref={areaRef}>
        <div className="vstack" onPointerLeave={() => setTip(null)}>
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
                          onPointerMove={(e) => onSeg(e, it, c, val, gross)}
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
        {tip && (
          <ChartTooltip pos={tip}>
            <div className="tip-title">{tip.car || 'Unnamed car'}</div>
            <div className="tip-row">
              <span className="dot" style={{ background: CATEGORY_COLORS[tip.category] }} />
              <span className="tip-name">{CATEGORY_LABELS[tip.category]}</span>
              <span className="tip-val">{usd(tip.value)}</span>
            </div>
            <div className="tip-sub">{pct(tip.value / tip.gross)} of {usdK(tip.gross)} gross spend</div>
          </ChartTooltip>
        )}
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
