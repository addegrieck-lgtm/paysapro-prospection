import type { Child } from 'hono/jsx';
import type { Ctx } from '../../app/context';
import { AdminLayout } from '../../web/admin/ui';
import { parseEuros } from '../../domain/money';

/** Rendu d'une page d'administration avec le gabarit commun. */
export function page(c: Ctx, title: string, children: Child, opts: { actions?: Child; error?: string; status?: 200 | 400 | 404 | 409 | 422; wide?: boolean } = {}) {
  return c.html(
    <AdminLayout
      s={c.get('settings')}
      user={c.get('user')!}
      csrf={c.get('csrf')}
      title={title}
      path={new URL(c.req.url).pathname}
      flash={c.req.query('ok')}
      error={opts.error ?? (c.req.query('erreur') === 'lignes' ? 'Une ou plusieurs lignes sont incomplètes ou invalides : rien n’a été enregistré.' : undefined)}
      actions={opts.actions}
      wide={opts.wide}
    >
      {children}
    </AdminLayout>,
    opts.status ?? 200,
  );
}

export type FormData = { get: (k: string) => string; all: (k: string) => string[]; has: (k: string) => boolean; money: (k: string) => number | null; int: (k: string) => number | null; bool: (k: string) => boolean };

/** Lecture typée d'un formulaire envoyé (urlencoded ou multipart). */
export async function readForm(c: Ctx): Promise<FormData & { raw: Record<string, string | File | (string | File)[]> }> {
  const raw = (await c.req.parseBody({ all: true })) as Record<string, string | File | (string | File)[]>;
  const all = (k: string) => {
    const v = raw[k];
    return (Array.isArray(v) ? v : v == null ? [] : [v]).filter((x): x is string => typeof x === 'string');
  };
  const get = (k: string) => (all(k).at(-1) ?? '').trim();
  return {
    raw,
    get,
    all,
    has: (k) => k in raw,
    money: (k) => parseEuros(get(k)),
    int: (k) => {
      const v = get(k);
      return /^-?\d+$/.test(v) ? Number(v) : null;
    },
    bool: (k) => get(k) === '1' || get(k) === 'on',
  };
}

export const idParam = (c: Ctx) => {
  const n = Number(c.req.param('id'));
  return Number.isInteger(n) && n > 0 ? n : 0;
};

export const PAGE_SIZE = 50;
export const pageNum = (c: Ctx) => Math.max(1, Number(c.req.query('page') ?? '1') || 1);
