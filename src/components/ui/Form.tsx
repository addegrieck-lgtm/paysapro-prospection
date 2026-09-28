import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { parseDecimal, toInput } from '../../utils/number';

const inputClass =
  'w-full min-h-12 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-60';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  className?: string;
}

export function Field({ label, hint, error, children, className = '' }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children(id, describedBy)}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string | null;
};

export function TextField({ label, value, onChange, hint, error, className, ...rest }: TextProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
      )}
    </Field>
  );
}

type AreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
};

export function TextArea({ label, value, onChange, hint, className, rows = 4, ...rest }: AreaProps) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id, describedBy) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          rows={rows}
          className={`${inputClass} resize-y leading-relaxed`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
      )}
    </Field>
  );
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hint?: ReactNode;
};

export function SelectField({ label, value, onChange, options, hint, className, ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id, describedBy) => (
        <select id={id} aria-describedby={describedBy} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

interface NumberProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  suffix?: string;
  min?: number;
  max?: number;
  hint?: ReactNode;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Message si le champ est vide */
  requiredMessage?: string;
}

/**
 * Champ numérique tolérant (« 12,5 » ou « 12.5 »), clavier décimal sur mobile.
 * Ne transmet que des valeurs valides : jamais NaN, jamais de négatif, pourcentages bornés.
 */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  max,
  hint,
  placeholder,
  className,
  disabled,
  requiredMessage,
}: NumberProps) {
  const [text, setText] = useState(toInput(value));
  const [prev, setPrev] = useState(value);
  const [touched, setTouched] = useState(false);
  if (value !== prev) {
    setPrev(value);
    if (parseDecimal(text) !== value) setText(toInput(value));
  }

  const parsed = parseDecimal(text);
  let error: string | null = null;
  if (text.trim() !== '' && parsed === null) error = 'Veuillez saisir un nombre valide.';
  else if (parsed !== null && parsed < min) error = min === 0 ? 'La valeur ne peut pas être négative.' : `Minimum : ${min}.`;
  else if (parsed !== null && max !== undefined && parsed > max)
    error = max === 100 ? 'Le pourcentage doit être compris entre 0 et 100.' : `Maximum : ${max}.`;
  else if (touched && text.trim() === '' && requiredMessage) error = requiredMessage;

  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <div className="relative">
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            aria-describedby={describedBy}
            aria-invalid={!!error}
            disabled={disabled}
            placeholder={placeholder}
            className={`${inputClass} ${suffix ? 'pr-14' : ''} tabular-nums`}
            value={text}
            onBlur={() => setTouched(true)}
            onChange={(e) => {
              const raw = e.target.value;
              setText(raw);
              const v = parseDecimal(raw);
              if (raw.trim() === '') onChange(null);
              else if (v !== null && v >= min && (max === undefined || v <= max)) onChange(v);
            }}
          />
          {suffix && (
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted">{suffix}</span>
          )}
        </div>
      )}
    </Field>
  );
}

/** Pastille sélectionnable (catégories, étiquettes). */
export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
        selected ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-ink hover:border-brand/50'
      }`}
    >
      {selected && <Check className="h-4 w-4" aria-hidden />}
      {children}
    </button>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" />
      <span className="text-ink">{children}</span>
    </label>
  );
}

/** Choix exclusif compact (ex. Mode précis / rapide). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors ${
            value === o.value ? 'bg-surface text-brand shadow-card' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
