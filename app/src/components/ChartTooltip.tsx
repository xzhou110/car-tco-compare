import type { ReactNode } from 'react';

// Where to anchor the floating tooltip, in pixels relative to the chart's
// position:relative wrapper (`.chart-area`). `flipX`/`below` flip the anchor
// away from the cursor near the right/top edges so the tip never clips out.
export interface TipPos {
  left: number;
  top: number;
  flipX?: boolean;
  below?: boolean;
}

// A cursor-following tooltip rendered as an absolutely-positioned overlay inside
// `.chart-area`. Purely presentational + non-interactive (pointer-events: none),
// so it never steals the hover from the chart underneath. Content is supplied by
// each chart via children.
export function ChartTooltip({ pos, children }: { pos: TipPos; children: ReactNode }) {
  const tx = pos.flipX ? '-100%' : '-50%';
  const ty = pos.below ? '14px' : 'calc(-100% - 14px)';
  return (
    <div className="chart-tip" role="tooltip" style={{ left: pos.left, top: pos.top, transform: `translate(${tx}, ${ty})` }}>
      {children}
    </div>
  );
}
