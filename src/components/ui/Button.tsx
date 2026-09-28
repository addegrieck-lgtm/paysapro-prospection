import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type Size = 'md' | 'lg' | 'sm';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed text-center';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong active:bg-brand-strong shadow-card',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  soft: 'bg-brand-soft text-brand hover:brightness-95',
  ghost: 'text-brand hover:bg-brand-soft',
  danger: 'bg-danger-soft text-danger hover:brightness-95',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-10 px-3 text-sm',
  md: 'min-h-12 px-4',
  lg: 'min-h-14 px-5 text-lg',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', block = false, extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${block ? 'w-full' : ''} ${extra}`;
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', block, icon, className = '', children, type = 'button', ...rest }: Props) {
  return (
    <button type={type} className={buttonClass(variant, size, block, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

interface LinkProps {
  to: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
}

export function ButtonLink({ to, variant = 'primary', size = 'md', block, icon, className = '', children, ...rest }: LinkProps) {
  return (
    <Link to={to} className={buttonClass(variant, size, block, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
