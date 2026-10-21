import { type Answers, type Question, type Section, answerText, isShown } from '../domain/brief';

/** Étape du parcours client : « projet » (choix des prestations), une rubrique du questionnaire, ou « fin » (fichiers et envoi). */
export interface BriefStep {
  id: string;
  title: string;
  section?: Section;
}

const asList = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Attribut lu par le script du site pour masquer / afficher une question selon une réponse de la même étape (sans script : tout est affiché). */
const showIfAttr = (q: Question) => (q.showIf ? `${q.showIf.q}:${q.showIf.in.join('|')}` : undefined);

export function BriefQuestion({ q, a }: { q: Question; a: Answers }) {
  const id = `q-${q.id}`;
  const help = q.help ? <small class="field-help" id={`${id}-aide`}>{q.help}</small> : null;
  const describedBy = q.help ? `${id}-aide` : undefined;
  const hidden = !isShown(q.showIf, a);
  if (q.type === 'radio' || q.type === 'checkbox') {
    const values = asList(a[q.id]);
    return (
      <fieldset class="chips-field brief-q" data-show-if={showIfAttr(q)} data-off={hidden ? '' : undefined}>
        <legend>{q.label}</legend>
        {help}
        <div class="chips">
          {(q.options ?? []).map((o) => (
            <label class="chip">
              <input type={q.type} name={q.id} value={o} checked={values.includes(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
        {q.other && (
          <div class="field brief-other">
            <label for={`${id}-autre`}>Autre (précisez)</label>
            <input id={`${id}-autre`} name={`${q.id}__autre`} value={String(a[`${q.id}__autre`] ?? '')} maxlength={300} />
          </div>
        )}
      </fieldset>
    );
  }
  return (
    <div class="field brief-q" data-show-if={showIfAttr(q)} data-off={hidden ? '' : undefined}>
      <label for={id}>{q.label}</label>
      {help}
      {q.type === 'textarea' ? (
        <textarea id={id} name={q.id} rows={4} maxlength={4000} placeholder={q.placeholder} aria-describedby={describedBy}>
          {String(a[q.id] ?? '')}
        </textarea>
      ) : (
        <input id={id} name={q.id} value={String(a[q.id] ?? '')} maxlength={300} placeholder={q.placeholder} aria-describedby={describedBy} />
      )}
    </div>
  );
}

export function BriefProgressBar({ steps, current, percent }: { steps: BriefStep[]; current: number; percent: number }) {
  return (
    <div class="brief-progress">
      <div class="brief-progress-head">
        <span>
          Étape {current + 1} sur {steps.length}
        </span>
        <span>{percent} % complété</span>
      </div>
      <div class="brief-progress-bar" role="progressbar" aria-label="Avancement du cahier des charges" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span style={`width:${percent}%`}></span>
      </div>
    </div>
  );
}

/** Restitution du cahier des charges (administration et récapitulatif client). */
export function BriefDocument({ sections, a, modulesText, edit, showEmpty = true }: { sections: Section[]; a: Answers; modulesText: string; edit?: (sectionId: string) => string; showEmpty?: boolean }) {
  return (
    <div class="brief-doc">
      <p>
        <strong>Prestations :</strong> {modulesText || '—'}
      </p>
      {a.projet_resume && (
        <p>
          <strong>Le projet en quelques mots :</strong> {String(a.projet_resume)}
        </p>
      )}
      {sections.map((s) => {
        const rows = s.questions.filter((q) => isShown(q.showIf, a)).map((q) => ({ q, text: answerText(q, a) }));
        const shown = showEmpty ? rows : rows.filter((r) => r.text);
        return (
          <section class="brief-doc-section">
            <h2>
              {s.title}
              {edit && (
                <a class="brief-edit" href={edit(s.id)}>
                  Modifier
                </a>
              )}
            </h2>
            {shown.length === 0 ? (
              <p class="muted">Aucune réponse.</p>
            ) : (
              <dl>
                {shown.map((r) => (
                  <>
                    <dt>{r.q.label}</dt>
                    <dd class={r.text ? '' : 'muted'}>{r.text || 'Non renseigné'}</dd>
                  </>
                ))}
              </dl>
            )}
          </section>
        );
      })}
    </div>
  );
}

