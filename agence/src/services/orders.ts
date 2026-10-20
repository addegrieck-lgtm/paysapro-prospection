import type { Deps } from '../app/context';
import type { Settings } from '../domain/settings';
import type { ContactRow, OrderRow, ProofRow } from '../repo/types';
import { orderTransitionError, labelOf, ORDER_STATUSES } from '../domain/statuses';
import { PREPRESS_CHECKLIST, checklistProgress, parseChecklist } from '../domain/checklists';
import { addContactEvent, siteLink } from './requests';

export async function orderGuardInput(deps: Deps, o: OrderRow) {
  const proofs = await deps.db.all<{ status: string }>('SELECT status FROM proofs WHERE order_id = ?', [o.id]);
  return {
    bat_required: !!o.bat_required,
    hasAcceptedProof: proofs.some((p) => p.status === 'accepte'),
    hasSentProof: proofs.some((p) => p.status === 'envoye'),
    supplierOrderRef: o.supplier_order_ref,
    supplierOrderedAt: o.supplier_ordered_at,
  };
}

/** Change le statut d'une commande en respectant les règles (BAT, commande fournisseur réelle). */
export async function setOrderStatus(deps: Deps, orderId: number, to: string, note: string, author: string): Promise<string | null> {
  const o = await deps.db.get<OrderRow>('SELECT * FROM print_orders WHERE id = ?', [orderId]);
  if (!o) return 'Commande introuvable.';
  if (o.status === to) return null;
  const err = orderTransitionError(to, await orderGuardInput(deps, o));
  if (err) return err;
  const now = new Date().toISOString();
  await deps.db.batch([
    { sql: 'UPDATE print_orders SET status = ?, updated_at = ? WHERE id = ?', params: [to, now, orderId] },
    { sql: 'INSERT INTO order_events (order_id, from_status, to_status, note, author, created_at) VALUES (?, ?, ?, ?, ?, ?)', params: [orderId, o.status, to, note.slice(0, 2000), author, now] },
  ]);
  return null;
}

export async function orderEvent(deps: Deps, orderId: number, note: string, author: string): Promise<void> {
  await deps.db.run('INSERT INTO order_events (order_id, from_status, to_status, note, author, created_at) VALUES (?, NULL, NULL, ?, ?, ?)', [orderId, note.slice(0, 2000), author, new Date().toISOString()]);
}

/** Envoi du BAT : uniquement si la checklist de prépresse est entièrement validée. */
export async function sendProof(deps: Deps, s: Settings, proofId: number, origin: string, author: string): Promise<{ ok: boolean; error?: string }> {
  const { db } = deps;
  const p = await db.get<ProofRow>('SELECT * FROM proofs WHERE id = ?', [proofId]);
  if (!p || p.status !== 'brouillon') return { ok: false, error: 'Ce BAT a déjà été envoyé ou remplacé.' };
  if (!checklistProgress(PREPRESS_CHECKLIST, parseChecklist(p.checklist)).complete) {
    return { ok: false, error: 'La checklist de prépresse doit être entièrement validée avant d’envoyer le BAT.' };
  }
  const o = (await db.get<OrderRow>('SELECT * FROM print_orders WHERE id = ?', [p.order_id]))!;
  const ct = await db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [o.contact_id]);
  if (!ct?.email) return { ok: false, error: 'Le client n’a pas d’adresse e-mail.' };
  const res = await deps.mailer.send({
    to: ct.email,
    subject: `${s.agencyName} — bon à tirer à valider (commande ${o.number}, version ${p.version})`,
    kind: 'bat',
    replyTo: s.contactEmail || undefined,
    text: `Bonjour ${ct.name},

Le bon à tirer (BAT) de votre commande ${o.number} est prêt :
${o.description}

Merci de le vérifier attentivement (textes, coordonnées, orthographe, couleurs) puis de l’accepter ou de demander des corrections :
${siteLink(s, origin, `/client/bat/${p.token}`)}

Rien ne sera imprimé avant votre accord.

${s.agencyName}`,
  });
  if (!res.ok) return { ok: false, error: `E-mail non envoyé (${res.error}).` };
  const now = new Date().toISOString();
  await db.batch([
    { sql: "UPDATE proofs SET status = 'remplace' WHERE order_id = ? AND id <> ? AND status IN ('brouillon', 'envoye')", params: [o.id, p.id] },
    { sql: "UPDATE proofs SET status = 'envoye', sent_at = ? WHERE id = ?", params: [now, p.id] },
  ]);
  await orderEvent(deps, o.id, `BAT version ${p.version} envoyé au client.`, author);
  const order = ORDER_STATUSES.findIndex((x) => x[0] === o.status);
  if (order < ORDER_STATUSES.findIndex((x) => x[0] === 'bat_envoye')) await setOrderStatus(deps, o.id, 'bat_envoye', `BAT v${p.version}`, author);
  await addContactEvent(deps, ct.id, 'systeme', `BAT v${p.version} de la commande ${o.number} envoyé.`, author);
  return { ok: true };
}

/** Décision du client sur un BAT (lien sécurisé). */
export async function decideProof(deps: Deps, s: Settings, proof: ProofRow, decision: 'accepte' | 'refuse', name: string, comment: string): Promise<{ ok: boolean; error?: string }> {
  const { db } = deps;
  if (proof.status !== 'envoye') return { ok: false, error: 'Ce BAT n’est plus en attente de validation.' };
  const now = new Date().toISOString();
  const r = await db.run("UPDATE proofs SET status = ?, decided_at = ?, decided_name = ?, client_comment = ? WHERE id = ? AND status = 'envoye'", [decision, now, name.slice(0, 120), comment.slice(0, 3000), proof.id]);
  if (!r.changes) return { ok: false, error: 'Ce BAT n’est plus en attente de validation.' };
  const o = (await db.get<OrderRow>('SELECT * FROM print_orders WHERE id = ?', [proof.order_id]))!;
  if (decision === 'accepte') {
    await db.run('UPDATE print_orders SET validated_proof_id = ?, updated_at = ? WHERE id = ?', [proof.id, now, o.id]);
    await setOrderStatus(deps, o.id, 'bat_accepte', `BAT v${proof.version} accepté par ${name}`, 'Client');
  } else {
    await orderEvent(deps, o.id, `BAT v${proof.version} refusé par ${name} : ${comment}`, 'Client');
    await setOrderStatus(deps, o.id, 'visuel_en_preparation', `Corrections demandées sur le BAT v${proof.version}`, 'Client');
  }
  await addContactEvent(deps, o.contact_id, 'systeme', `BAT v${proof.version} (${o.number}) ${decision === 'accepte' ? 'ACCEPTÉ' : 'refusé'} par ${name}${comment ? ` — « ${comment.slice(0, 500)} »` : ''}.`, 'Client');
  if (s.notifyEmail) {
    await deps.mailer.send({
      to: s.notifyEmail,
      subject: `BAT ${o.number} v${proof.version} ${decision === 'accepte' ? 'accepté' : 'refusé'}`,
      kind: 'notification',
      text: `${name} a ${decision === 'accepte' ? 'accepté' : 'refusé'} le BAT v${proof.version} de la commande ${o.number} (${labelOf(ORDER_STATUSES, o.status)}).${comment ? `\nCommentaire : ${comment}` : ''}`,
    });
  }
  return { ok: true };
}
