import { useRef, useState } from 'react';
import type { ResultItem } from './ResultsSummary';
import { Legend } from './CategoryBreakdown';
import { usd, usdK } from '../lib/format';
import { ChartTooltip } from './ChartTooltip';

const W = 640;
const H = 380;
const padL = 64;
const padR = 18;
const padT = 22;
const padB = 46;
const STEPS = 5;

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

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ k: number; left: number; top: number } | null>(null);

  // Map the cursor to the nearest year index, and remember where to anchor the tip.
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const k = Math.max(0, Math.min(Y, Math.round(((svgX - padL) / (W - padL - padR)) * Y)));
    const wr = wrap.getBoundingClientRect();
    setHover({ k, left: e.clientX - wr.left, top: e.clientY - wr.top });
  };

  // Tooltip rows: every car's running total at the hovered year, costliest first.
  const rows = hover
    ? items
        .map((it) => ({ it, v: it.result.cumulative[hover.k] }))
        .sort((a, b) => b.v - a.v)
    : [];
  const yearNote = hover ? (hover.k === 0 ? ' · purchase' : hover.k === Y ? ' · sale' : '') : '';

  return (
    <div className="panel">
      <h3>
        Cumulative cost over time <small>(starts at purchase price; dips at sale when you recover resale)</small>
      </h3>
      <div className="chart-area" ref={wrapRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="linechart"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Cumulative cost over time"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
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
              <path d={linePath(it.result.cumulative)} fill="none" stroke={it.color.c} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              {it.result.cumulative.map((v, k) => (
                <circle key={k} cx={x(k)} cy={y(v)} r={4} fill="#fff" stroke={it.color.c} strokeWidth={2.25} />
              ))}
            </g>
          ))}
          {hover && (
            <g className="crosshair-g" pointerEvents="none">
              <line className="crosshair" x1={x(hover.k)} y1={padT} x2={x(hover.k)} y2={baseY} />
              {items.map((it) => (
                <circle key={it.vehicle.id} cx={x(hover.k)} cy={y(it.result.cumulative[hover.k])} r={5.5} fill={it.color.c} stroke="#fff" strokeWidth={2} />
              ))}
            </g>
          )}
          <text className="ax" x={padL} y={H - 5} textAnchor="start">
            year of ownership →
          </text>
        </svg>
        {hover && (
          <ChartTooltip pos={{ left: hover.left, top: hover.top, flipX: hover.k > Y * 0.6, below: hover.top < 96 }}>
            <div className="tip-title">Year {hover.k}{yearNote}</div>
            {rows.map(({ it, v }) => (
              <div className="tip-row" key={it.vehicle.id}>
                <span className="dot" style={{ background: it.color.c }} />
                <span className="tip-name">{it.vehicle.name || 'Unnamed car'}</span>
                <span className="tip-val">{usd(v)}</span>
              </div>
            ))}
          </ChartTooltip>
        )}
      </div>
      <Legend items={items} />
    </div>
  );
}
