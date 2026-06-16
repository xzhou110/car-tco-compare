// Small reusable form controls matching the design's field markup.

interface NumFieldProps {
  label: string;
  hint?: string;
  pre?: string;
  suf?: string;
  value: number | null;
  placeholder?: string;
  step?: number;
  onChange: (n: number | null) => void;
}

export function NumField({ label, hint, pre, suf, value, placeholder, step, onChange }: NumFieldProps) {
  return (
    <label className="field">
      <span className="field-label">
        {label} {hint && <em className="hint">{hint}</em>}
      </span>
      <span className="input-wrap">
        {pre && <span className="adorn">{pre}</span>}
        <input
          type="number"
          step={step ?? 'any'}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
        {suf && <span className="adorn suf">{suf}</span>}
      </span>
    </label>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}

export function SelectField<T extends string>({ label, value, options, onChange }: SelectFieldProps<T>) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export function TextField({ label, value, onChange }: TextFieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
