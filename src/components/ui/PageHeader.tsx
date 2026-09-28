import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start gap-2">
      {back && (
        <Link
          to={back}
          aria-label="Retour"
          className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      )}
      <div className="min-w-0 flex-1 pt-1.5">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink break-words">{title}</h1>
        {subtitle && <div className="mt-1 text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}

/** Barre d'action collée en bas de l'écran (pouce) : « Continuer », « Créer le devis »… */
export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-20" aria-hidden />
      <div className="no-print fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-60">
        <div className="mx-auto flex max-w-5xl gap-2">{children}</div>
      </div>
    </>
  );
}
