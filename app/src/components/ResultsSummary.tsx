import type { TcoResult, Vehicle } from '../types';
import type { SlotColor } from '../data/presets';
import { cpm, usd } from '../lib/format';

// Translucent tint of a slot color — blends over whatever theme surface is behind it,
// so the winner banner reads well in both light and dark mode.
const tint = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export interface ResultItem {
  vehicle: Vehicle;
  result: TcoResult;
  color: SlotColor;
  rank: number;
  isBest: boolean;
}

interface Props {
  items: ResultItem[];
  holdingYears: number;
  financingEnabled: boolean;
}

export function ResultsSummary({ items, holdingYears, financingEnabled }: Props) {
  const best = items.find((it) => it.isBest) ?? items[0];
  const single = items.length === 1;

  return (
    <>
      <div className="winner" style={{ borderColor: tint(best.color.c, 0.4), background: tint(best.color.c, 0.1) }}>
        <div className="trophy">{single ? '💰' : '🏆'}</div>
        <div className="win-head">
          {single
            ? `${best.vehicle.name || 'This car'} — ${usd(best.result.total)} to own over ${holdingYears} yrs`
            : `${best.vehicle.name || 'This car'} is the cheapest to own — ${usd(best.result.total)} over ${holdingYears} yrs`}
        </div>
      </div>
      <div className="summary">
        {items.map((it) => (
          <div className={`result-card${it.isBest && !single ? ' best' : ''}`} key={it.vehicle.id} style={{ borderTopColor: it.color.c }}>
            {it.isBest && !single && <span className="best-flag">🏆 cheapest</span>}
            <div className="rc-head">
              {!single && <span className="rank" style={{ background: it.color.c }}>#{it.rank}</span>}
              <span className="rc-name">{it.vehicle.name}</span>
            </div>
            <div className="rc-total">{usd(it.result.total)}</div>
            <div className="rc-subs">
              <span>
                {usd(it.result.perYear)}
                <small>/yr</small>
              </span>
              <span>{cpm(it.result.perMile)}</span>
            </div>
            <div className="rc-resale">
              est. resale {usd(it.result.resaleUsed)}
              {financingEnabled ? ` · ${usd(it.result.downPayment)} down` : ''}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
