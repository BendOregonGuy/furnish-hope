/**
 * Reusable checkbox group for "pick one or more" fields backed by a lookup
 * table. Used by ClientForm + AgencyReferralForm for household type. New rows
 * added to the lookup table appear automatically — no code change needed.
 */

export interface CheckboxOption {
  value: number;
  label: string;
}

interface Props {
  label: string;
  required?: boolean;
  options: CheckboxOption[];
  value: number[];
  onChange: (next: number[]) => void;
  helpText?: string;
  error?: string | null;
}

export function CheckboxGroup({ label, required, options, value, onChange, helpText, error }: Props) {
  const selected = new Set(value);

  function toggle(v: number) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    // Preserve the original lookup order so the "primary" stays stable across
    // toggles. Sort by the options array's index.
    const ordered = options.filter(o => next.has(o.value)).map(o => o.value);
    onChange(ordered);
  }

  return (
    <div>
      <label className="field-label">
        {label} {required && <span className="text-terracotta">*</span>}
      </label>
      <div className="border border-paper-deep rounded-md p-3 bg-paper">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {options.map(o => (
            <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer hover:text-terracotta-deep">
              <input
                type="checkbox"
                checked={selected.has(o.value)}
                onChange={() => toggle(o.value)}
                className="h-3.5 w-3.5"
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </div>
      {helpText && !error && <div className="text-[11px] text-ink-faint mt-1">{helpText}</div>}
      {error && <div className="text-[11px] text-terracotta-deep mt-1">{error}</div>}
    </div>
  );
}
