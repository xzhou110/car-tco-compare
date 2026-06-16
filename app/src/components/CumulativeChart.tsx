import type { ResultItem } from './ResultsSummary';
import { Legend } from './CategoryBreakdown';
import { usdK } from '../lib/format';

const W = 640;
const H = 300;
const padL = 56;
const padR = 18;
const padT = 18;
const padB = 36;
const STEPS = 4;

export function CumulativeChart({ items }: { items: ResultItem[] }) {
  const Y = items[0].result.cumulative.length - 1;
  const all = items.flatMap((it) => it.result.cumulative);
  const maxV = Math.max(1, ...all);
  const minV = Math.min(0, ...all);

  const x = (k: number) => padL + (k / Y) * (W - padL - padR);
  const y = (v: number) => H - padB - ((v - minV) / (maxV - minV)) * (H - padT - padB);
  const baseY = H - padB;
  const linePath = (arr: number[]) => arr.map((v, k) => `${k === 0 ? 'M' : 'L'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const areaPath = (arr: number[]) => `${linePath(arr)} L${x(Y).toFixed(1)},${baseY} L${x(0).toFixed(1)},${baseY} Z`;

  return (
    <div className="panel">
      <h3>
        Cumulative cost over time <small>(starts at purchase price; dips at sale when you recover resale)</small>
      </h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="linechart" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Cumulative cost over time">
        <defs>
          {items.map((it, i) => (
            <linearGradient id={`grad${i}`} key={i} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={it.color.c} stopOpacity={0.22} />
              <stop offset="100%" stopColor={it.color.c} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {Array.from({ length: STEPS + 1 }).map((_, s) => {
          const v = minV + ((maxV - minV) / STEPS) * s;
          const yy = y(v);
          return (
            <g key={s}>
              <line className="grid" x1={padL} y1={yy} x2={W - padR} y2={yy} />
              <text className="ax" x={padL - 8} y={yy + 3} textAnchor="end">
                {usdK(v)}
              </text>
            </g>
          );
        })}
        {Array.from({ length: Y + 1 }).map((_, k) => (
          <text className="ax" key={k} x={x(k)} y={H - padB + 17} textAnchor="middle">
            {k}
          </text>
        ))}
        {items.map((it, i) => (
          <g key={it.vehicle.id}>
            <path d={areaPath(it.result.cumulative)} fill={`url(#grad${i})`} stroke="none" />
            <path d={linePath(it.result.cumulative)} fill="none" stroke={it.color.c} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {it.result.cumulative.map((v, k) => (
              <circle key={k} cx={x(k)} cy={y(v)} r={3.2} fill="#fff" stroke={it.color.c} strokeWidth={2} />
            ))}
          </g>
        ))}
        <text className="ax" x={padL} y={H - 5} textAnchor="start">
          year of ownership →
        </text>
      </svg>
      <Legend items={items} />
    </div>
  );
}
