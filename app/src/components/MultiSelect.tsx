import { useEffect, useRef, useState } from 'react';

interface Props {
  label: string;
  /** Data-driven options (already scoped to what's available). */
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  /** Optional display formatter (e.g. gas -> Gas). */
  fmt?: (v: string) => string;
  placeholder?: string;
}

/**
 * A compact multi-select dropdown: a collapsed trigger showing the selection summary,
 * which expands an inline, scrollable checklist on click. Inline (not absolutely
 * positioned) so the modal's overflow never clips it. Click an option to toggle it;
 * click the trigger again or outside to close.
 */
export function MultiSelect({ label, options, selected, onToggle, fmt, placeholder = 'Any' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const show = (v: string) => (fmt ? fmt(v) : v);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const summary =
    selected.length === 0 ? placeholder : selected.length <= 2 ? selected.map(show).join(', ') : `${selected.length} selected`;

  return (
    <div className="alerts-field" style={{ gridColumn: '1 / -1' }} ref={ref}>
      <span className="alerts-label">{label}{selected.length ? ` · ${selected.length}` : ''}</span>
      <div className="ms">
        <button
          type="button"
          className="ms-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={options.length === 0}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={selected.length ? undefined : 'ms-placeholder'}>
            {options.length === 0 ? 'No options in data' : summary}
          </span>
          <span className="ms-caret" aria-hidden="true">▾</span>
        </button>
        {open && options.length > 0 ? (
          <div className="ms-menu" role="listbox" aria-multiselectable="true" aria-label={label}>
            {selected.length > 0 ? (
              <button type="button" className="ms-clear" onClick={() => selected.forEach(onToggle)}>
                Clear selection
              </button>
            ) : null}
            {options.map((o) => {
              const on = selected.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`ms-option${on ? ' on' : ''}`}
                  onClick={() => onToggle(o)}
                >
                  <span className="ms-check" aria-hidden="true">{on ? '✓' : ''}</span>
                  {show(o)}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
