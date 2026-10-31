// Composants d'interface (approche shadcn/ui : composants locaux, variantes, Tailwind — sans dépendance externe).
import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2, X } from 'lucide-react';
import { cn } from '../../lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'brass';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-[#1b2f4d] shadow-sm',
  brass: 'bg-brass text-white hover:bg-[#a37f3d] shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-paper',
  ghost: 'text-ink-2 hover:bg-black/5',
  danger: 'bg-surface text-bad border border-bad/30 hover:bg-bad-soft',
};

export function Button({ variant = 'secondary', size = 'md', loading, className, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const sizes = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-9 px-4 text-sm gap-2', lg: 'h-12 px-6 text-[15px] gap-2.5 font-semibold tracking-wide' };
  return (
    <button {...rest} disabled={rest.disabled || loading}
      className={cn('inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seine', VARIANTS[variant], sizes[size], className)}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children, title, action, subtitle }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <section className={cn('bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(15,30,51,0.04)]', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="text-[13px] text-muted mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn(title || action ? 'px-5 pb-5' : 'p-5')}>{children}</div>
    </section>
  );
}

const TONES = {
  neutral: 'bg-slate-100 text-slate-700', seine: 'bg-seine-soft text-seine', brass: 'bg-brass-soft text-[#7a5a1c]',
  good: 'bg-good-soft text-good', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', ink: 'bg-ink text-white',
};
export type Tone = keyof typeof TONES;
export function Badge({ tone = 'neutral', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return <span title={title} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap', TONES[tone], className)}>{children}</span>;
}

export const DemoBadge = () => <Badge tone="warn" title="Donnée fictive de démonstration, ne provient d'aucune recherche">DÉMO</Badge>;

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return <label className="block text-[12.5px] font-medium text-ink-2 mb-1.5">{children}{hint && <span className="font-normal text-muted"> · {hint}</span>}</label>;
}
const field = 'rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-seine/25 focus:border-seine transition';
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn(field, 'h-9', className?.includes('w-') ? '' : 'w-full', className)} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cn(field, 'w-full py-2 leading-relaxed', className)} />;
export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn(field, 'h-9 pr-8', className?.includes('w-') ? '' : 'w-full', className)}>{children}</select>;

export function Chip({ active, onClick, children, icon }: { active: boolean; onClick: () => void; children: ReactNode; icon?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 h-8 text-[13px] transition',
        active ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-2 hover:border-ink-2')}>
      {icon}{children}
    </button>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none py-1">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn('mt-0.5 relative h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-seine' : 'bg-slate-300')}>
        <span className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      <span className="text-sm text-ink">{label}{hint && <span className="block text-[12px] text-muted">{hint}</span>}</span>
    </label>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 backdrop-blur-[2px] p-4 overflow-y-auto" onClick={onClose}>
      <div className={cn('fade-in mt-[6vh] w-full rounded-2xl bg-surface shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-black/5" aria-label="Fermer"><X className="size-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-black/[0.04] p-0.5">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={cn('px-3 h-8 rounded-md text-[13px] font-medium transition', value === t.key ? 'bg-surface shadow-sm text-ink' : 'text-muted hover:text-ink')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      {icon && <div className="mb-3 rounded-2xl bg-paper p-3 text-muted">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('size-5 animate-spin text-muted', className)} />;

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        {eyebrow && <p className="text-[11.5px] uppercase tracking-[0.14em] text-brass font-semibold mb-1">{eyebrow}</p>}
        <h1 className="font-display text-[28px] leading-tight text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// --- Notifications ---------------------------------------------------------------------------------------------
type Toast = { id: number; text: string; tone: 'good' | 'bad' | 'neutral' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'neutral') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn('fade-in rounded-xl px-4 py-3 text-sm shadow-lg border',
            t.tone === 'good' ? 'bg-ink text-white border-ink' : t.tone === 'bad' ? 'bg-bad text-white border-bad' : 'bg-surface text-ink border-line')}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
