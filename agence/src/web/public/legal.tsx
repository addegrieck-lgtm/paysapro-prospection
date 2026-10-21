import type { Settings } from '../../domain/settings';
import { Layout } from '../layout';

/** Valeur légale, ou mention explicite si non renseignée (jamais d'information inventée). */
function V({ v }: { v: string }) {
  return v ? <>{v}</> : <span class="todo">information en cours de complétion</span>;
}

function LegalShell({ s, title, path, description, children, updated }: { s: Settings; title: string; path: string; description: string; children: unknown; updated?: string }) {
  return (
    <Layout s={s} meta={{ title, description, path, breadcrumbs: [{ name: title, path }] }}>
      <section class="page-hero page-hero-sm">
        <div class="container narrow">
          <h1>{title}</h1>
          {updated && <p class="muted">Dernière mise à jour : {updated}</p>}
        </div>
      </section>
      <section class="section section-tight">
        <div class="container narrow prose legal">{children as never}</div>
      </section>
    </Layout>
  );
}

export function LegalNotice({ s }: { s: Settings }) {
  const l = s.legal;
  return (
    <LegalShell s={s} title="Mentions légales" path="/mentions-legales" description={`Mentions légales du site ${s.agencyName} : éditeur, directeur de la publication, hébergeur, propriété intellectuelle et données personnelles.`}>
      <h2>Éditeur du site</h2>
      <ul class="plain-list">
        <li>
          Nom commercial : {s.agencyName}
        </li>
        <li>
          Dénomination / nom de l’entrepreneur : <V v={l.companyName} />
        </li>
        <li>
          Forme juridique : <V v={l.legalForm} />
          {l.capital ? `, au capital de ${l.capital}` : ''}
        </li>
        <li>
          Adresse : <V v={l.address} />
        </li>
        <li>
          SIREN / SIRET : <V v={l.siret || l.siren} />
        </li>
        {l.registry && <li>Immatriculation : {l.registry}</li>}
        {s.vatMode === 'normal' ? (
          <li>
            N° de TVA intracommunautaire : <V v={l.vatNumber} />
          </li>
        ) : (
          <li>TVA non applicable, art. 293 B du CGI</li>
        )}
        <li>
          Contact : <V v={s.contactEmail} />
          {s.contactPhone ? ` — ${s.contactPhone}` : ''}
        </li>
        <li>
          Directeur de la publication : <V v={l.publicationDirector} />
        </li>
      </ul>
      <h2>Hébergement</h2>
      <ul class="plain-list">
        <li>
          Hébergeur : <V v={l.hostName} />
        </li>
        <li>
          Adresse : <V v={l.hostAddress} />
        </li>
        {l.hostContact && <li>Contact : {l.hostContact}</li>}
      </ul>
      <h2>Propriété intellectuelle</h2>
      <p>
        L’ensemble des contenus de ce site (textes, maquettes, illustrations, logo) est la propriété de l’éditeur, sauf mention contraire. Les polices
        de caractères utilisées (Fraunces, Inter Tight) sont distribuées sous licence SIL Open Font License. Toute reproduction sans autorisation est
        interdite.
      </p>
      <h2>Projets de démonstration</h2>
      <p>
        Les réalisations signalées « Concept de démonstration » présentent des entreprises fictives. Toute ressemblance avec une entreprise existante
        serait fortuite.
      </p>
      <h2>Données personnelles</h2>
      <p>
        Voir la <a href="/confidentialite">politique de confidentialité</a> et la page <a href="/cookies">gestion des cookies</a>.
      </p>
    </LegalShell>
  );
}

export function PrivacyPolicy({ s, mailProvider }: { s: Settings; mailProvider: string }) {
  const l = s.legal;
  const mailLabel =
    mailProvider === 'brevo' ? 'Brevo (Sendinblue SAS, France) pour l’envoi des e-mails transactionnels' : mailProvider === 'resend' ? 'Resend (Resend Inc., États-Unis) pour l’envoi des e-mails transactionnels' : null;
  return (
    <LegalShell s={s} title="Politique de confidentialité" path="/confidentialite" description="Comment nous collectons, utilisons et protégeons vos données personnelles.">
      <h2>Responsable du traitement</h2>
      <p>
        <V v={l.companyName} /> ({s.agencyName}), <V v={l.address} />. Contact : <V v={s.contactEmail} />.
      </p>
      <h2>Données collectées et finalités</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Traitement</th>
            <th>Données</th>
            <th>Base légale</th>
            <th>Durée de conservation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Réponse aux messages (formulaire de contact)</td>
            <td>Nom, entreprise, e-mail, téléphone, message</td>
            <td>Mesures précontractuelles prises à votre demande / intérêt légitime à répondre</td>
            <td>3 ans à compter du dernier contact</td>
          </tr>
          <tr>
            <td>Demandes de devis</td>
            <td>Coordonnées, description du projet, réponses au questionnaire, fichiers joints</td>
            <td>Mesures précontractuelles prises à votre demande</td>
            <td>3 ans à compter du dernier contact si aucun contrat n’est conclu</td>
          </tr>
          <tr>
            <td>Exécution des commandes (création, impression, livraison)</td>
            <td>Coordonnées, adresse de livraison, fichiers, validations (devis, BAT, recette)</td>
            <td>Exécution du contrat</td>
            <td>Durée de la relation contractuelle, puis 5 ans (prescription)</td>
          </tr>
          <tr>
            <td>Facturation et comptabilité</td>
            <td>Identité, adresse, SIREN, montants</td>
            <td>Obligation légale</td>
            <td>10 ans (article L123-22 du Code de commerce)</td>
          </tr>
          <tr>
            <td>Sécurité du site (lutte contre le spam et les abus)</td>
            <td>Empreinte non réversible de l’adresse IP</td>
            <td>Intérêt légitime</td>
            <td>24 heures maximum</td>
          </tr>
          {s.analyticsProvider !== 'none' && (
            <tr>
              <td>Mesure d’audience</td>
              <td>{s.analyticsProvider === 'plausible' ? 'Données de navigation agrégées, sans cookie' : 'Données de navigation (Google Analytics)'}</td>
              <td>{s.analyticsProvider === 'plausible' ? 'Intérêt légitime' : 'Consentement'}</td>
              <td>{s.analyticsProvider === 'plausible' ? 'Données agrégées' : '13 mois maximum pour les traceurs'}</td>
            </tr>
          )}
        </tbody>
      </table>
      <p>Nous n’envoyons aucune communication commerciale sans votre consentement préalable, et vous pouvez retirer ce consentement à tout moment.</p>
      <h2>Destinataires</h2>
      <ul>
        <li>Les personnes en charge de votre dossier au sein de l’agence.</li>
        <li>
          Notre hébergeur : <V v={l.hostName} />.
        </li>
        {mailLabel && <li>{mailLabel}.</li>}
        <li>
          Pour les commandes d’impression uniquement : l’imprimeur partenaire, qui reçoit les fichiers à imprimer et l’adresse de livraison nécessaires à
          la fabrication et à l’expédition.
        </li>
        {s.analyticsProvider === 'plausible' && <li>Plausible Analytics (Estonie, UE) pour la mesure d’audience sans cookie.</li>}
        <li>
          OpenStreetMap Foundation (Royaume-Uni), uniquement si vous cliquez sur « Afficher la carte » de la page contact : votre adresse IP est alors
          transmise à leurs serveurs pour afficher la carte. Rien n’est chargé sans votre action.
        </li>
        {s.analyticsProvider === 'ga4' && <li>Google Ireland Ltd. (Google Analytics), uniquement si vous y consentez.</li>}
      </ul>
      {(mailProvider === 'resend' || s.analyticsProvider === 'ga4') && (
        <p>
          Certains prestataires peuvent transférer des données hors de l’Union européenne. Ces transferts sont encadrés par les garanties prévues par le
          RGPD (décision d’adéquation ou clauses contractuelles types).
        </p>
      )}
      <h2>Vos droits</h2>
      <p>
        Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité de vos données. Pour les exercer,
        écrivez à <V v={s.contactEmail} />. Vous pouvez également introduire une réclamation auprès de la CNIL (
        <a href="https://www.cnil.fr" rel="noopener" target="_blank">
          www.cnil.fr
        </a>
        ).
      </p>
      <h2>Sécurité</h2>
      <p>
        Les échanges sont chiffrés (HTTPS). Les fichiers transmis ne sont pas accessibles publiquement. L’administration est protégée par
        authentification et ses accès sont journalisés.
      </p>
    </LegalShell>
  );
}

export function CookiesPage({ s }: { s: Settings }) {
  return (
    <LegalShell s={s} title="Gestion des cookies" path="/cookies" description="Les cookies et traceurs utilisés sur ce site, leur finalité, leur durée de conservation et comment les accepter, les refuser ou les supprimer.">
      <p>
        Ce site limite au strict nécessaire l’usage des cookies. <strong>Aucun cookie publicitaire</strong> n’est utilisé.
      </p>
      <table class="table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Finalité</th>
            <th>Durée</th>
            <th>Consentement</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Session d’administration</td>
            <td>Connexion à l’espace d’administration (personnel de l’agence uniquement)</td>
            <td>12 heures</td>
            <td>Non requis (strictement nécessaire)</td>
          </tr>
          {s.analyticsProvider === 'ga4' && (
            <>
              <tr>
                <td>consent</td>
                <td>Mémoriser votre choix concernant la mesure d’audience</td>
                <td>6 mois</td>
                <td>Non requis (strictement nécessaire)</td>
              </tr>
              <tr>
                <td>_ga, _ga_*</td>
                <td>Mesure d’audience Google Analytics</td>
                <td>13 mois maximum</td>
                <td>
                  <strong>Requis</strong> : déposés uniquement si vous acceptez
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
      {s.analyticsProvider === 'plausible' && (
        <p>La mesure d’audience est réalisée avec Plausible Analytics, qui ne dépose aucun cookie et ne collecte pas de données personnelles identifiantes.</p>
      )}
      {s.analyticsProvider === 'none' && <p>Aucun outil de mesure d’audience n’est actuellement utilisé sur ce site.</p>}
      {s.analyticsProvider === 'ga4' && (
        <p>
          <button type="button" class="btn btn-outline" data-consent="reset">
            Modifier mes choix
          </button>
        </p>
      )}
      <p>
        La carte de la page contact (OpenStreetMap) n’est chargée que si vous cliquez sur « Afficher la carte » ; aucun contenu tiers n’est chargé
        avant votre action.
      </p>
      <p>Vous pouvez aussi supprimer les cookies à tout moment depuis les réglages de votre navigateur.</p>
    </LegalShell>
  );
}

export function TermsPage({ s }: { s: Settings }) {
  const l = s.legal;
  return (
    <LegalShell s={s} title="Conditions générales de vente" path="/cgv" description={`Conditions générales de vente de ${s.agencyName} : devis, acompte, délais, BAT, livraison, paiement, rétractation et responsabilités.`}>
      <h2>1. Objet et champ d’application</h2>
      <p>
        Les présentes conditions s’appliquent aux prestations de <V v={l.companyName} /> ({s.agencyName}) : création de sites internet, création
        graphique, fourniture de supports imprimés, référencement, maintenance et accompagnement numérique, auprès de clients professionnels et
        particuliers. Les conditions particulières figurant au devis prévalent sur les présentes.
      </p>
      <h2>2. Devis et commande</h2>
      <p>
        Toute prestation fait l’objet d’un devis gratuit, valable {s.quoteValidityDays} jours. Les estimations affichées sur le site et dans le
        configurateur sont indicatives : seul le devis validé par l’agence et accepté par le client engage les parties. La commande est ferme à
        l’acceptation du devis (signature ou validation en ligne) et, le cas échéant, au versement de l’acompte prévu.
      </p>
      <h2>3. Prix</h2>
      <p>
        Les prix sont exprimés en euros hors taxes.
        {s.vatMode === 'franchise'
          ? ' TVA non applicable, art. 293 B du CGI.'
          : ` La TVA applicable (${String(s.vatRate).replace('.', ',')} % au taux normal) est ajoutée selon la réglementation en vigueur.`}{' '}
        La création graphique, l’impression, la livraison et les frais éventuels sont détaillés séparément. Sauf mention contraire, le nom de domaine,
        l’hébergement, les licences de logiciels, polices ou photographies payantes ne sont pas inclus.
      </p>
      <h2>4. Paiement</h2>
      <p>
        Sauf mention contraire au devis, un acompte de {s.depositPercent} % est demandé à la commande, le solde étant dû à la livraison. Les factures
        sont payables par virement dans un délai de {s.paymentTermsDays} jours à compter de leur date d’émission. Pour les clients professionnels, tout
        retard de paiement entraîne des pénalités au taux de {s.latePenaltyRate}, ainsi qu’une indemnité forfaitaire pour frais de recouvrement de 40 €
        (articles L441-10 et D441-5 du Code de commerce). Aucun paiement n’est prélevé sans l’accord exprès du client.
      </p>
      <h2>5. Réalisation, révisions et délais</h2>
      <p>
        Le nombre de séries de révisions inclus est indiqué au devis ; les révisions supplémentaires sont facturées selon le tarif en vigueur. Les délais
        courent à compter de la réception de l’acompte et de l’ensemble des éléments nécessaires (textes, photos, logo, accès). Ils sont donnés à titre
        indicatif ; un retard dû à la transmission tardive des éléments par le client ne peut être imputé à l’agence.
      </p>
      <h2>6. Bon à tirer (BAT) et impression</h2>
      <p>
        Aucun support n’est imprimé sans validation écrite ou en ligne du bon à tirer par le client. La validation du BAT vaut acceptation du contenu
        (textes, coordonnées, orthographe, mise en page). Les supports sont fabriqués par un imprimeur partenaire ; de légères variations de teinte entre
        l’écran et l’impression, ainsi que les tolérances de coupe et de façonnage usuelles de la profession, ne constituent pas un défaut. Toute
        réclamation concernant un défaut d’impression ou une avarie de transport doit être adressée, photos à l’appui, dans les 3 jours ouvrés suivant
        la réception.
      </p>
      <h2>7. Sites internet : recette et mise en ligne</h2>
      <p>
        Le site est présenté sur un environnement de préproduction. Le client dispose d’une période de recette pour signaler les anomalies. La mise en
        production intervient après validation de la recette par le client. Le nom de domaine est enregistré au nom du client, qui en reste
        propriétaire.
      </p>
      <h2>8. Propriété intellectuelle</h2>
      <p>
        Les droits d’exploitation des créations finales livrées (reproduction, représentation, adaptation, pour les supports et usages prévus au
        devis, pour la durée légale de protection et pour le monde entier, sauf stipulation contraire) sont cédés au client à compter du paiement
        intégral du prix. Les pistes non retenues, fichiers de travail et outils de l’agence restent sa propriété. Sauf refus écrit du client, l’agence
        peut mentionner la réalisation dans ses références après sa diffusion publique.
      </p>
      <h2>9. Obligations du client</h2>
      <p>
        Le client garantit disposer des droits sur les éléments qu’il fournit (textes, images, logos, marques) et l’exactitude des informations
        transmises. Il reste responsable des contenus publiés sur son site et de leur conformité légale.
      </p>
      <h2>10. Droit de rétractation (clients consommateurs)</h2>
      <p>
        Le client consommateur dispose d’un délai de 14 jours à compter de l’acceptation du devis pour se rétracter, sauf : biens confectionnés selon
        ses spécifications ou nettement personnalisés (article L221-28, 3° du Code de la consommation), et prestations pleinement exécutées avant la fin
        du délai avec son accord exprès et sa renonciation à ce droit. Lorsque le client demande le commencement de la prestation avant la fin du délai,
        il est redevable du montant correspondant au service fourni jusqu’à la rétractation.
      </p>
      <h2>11. Responsabilité</h2>
      <p>
        L’agence est tenue d’une obligation de moyens. Elle ne garantit aucun positionnement dans les moteurs de recherche ni aucun volume de ventes.
        Pour les clients professionnels, sa responsabilité est limitée au montant de la prestation concernée.
        {l.insurance ? ` Assurance responsabilité civile professionnelle : ${l.insurance}.` : ''}
      </p>
      <h2>12. Données personnelles</h2>
      <p>
        Voir la <a href="/confidentialite">politique de confidentialité</a>.
      </p>
      <h2>13. Médiation et litiges</h2>
      <p>
        Conformément aux articles L611-1 et suivants du Code de la consommation, le client consommateur peut recourir gratuitement au médiateur de la
        consommation : <V v={l.mediatorName} />
        {l.mediatorUrl ? (
          <>
            {' '}
            (
            <a href={l.mediatorUrl} rel="noopener" target="_blank">
              {l.mediatorUrl}
            </a>
            )
          </>
        ) : null}
        . Les présentes conditions sont soumises au droit français.
      </p>
    </LegalShell>
  );
}
