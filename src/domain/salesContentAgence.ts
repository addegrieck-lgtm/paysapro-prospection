// Contenu commercial PAR DÉFAUT de l'Assistant commercial dans l'espace Signe & Seine (modifiable dans
// « Assistant commercial → Configurer »).
//
// Le produit vendu est l'agence web & communication Signe & Seine (Gruchet-le-Valasse, Seine-Maritime) :
// sites internet, refontes, fiche Google, identité visuelle, flyers, cartes de visite, supports imprimés,
// réseaux sociaux, maintenance et packs « Bien démarrer » par métier.
//
// Règle : chaque prestation et chaque tarif repris ici figure sur le site de l'agence (catalogue des prestations et
// pages packs, prix HT « à partir de »). Aucun client, aucun avis, aucun résultat de référencement n'est promis.
// Les liens se configurent ; leurs boutons restent masqués tant qu'ils sont vides.
import type { SalesConfig } from './sales';

const SITE = 'https://www.signeetseine.fr';

export function defaultAgencySalesConfig(): SalesConfig {
  return {
    version: 1,
    productName: 'Signe & Seine',
    presentation:
      '{{produit}} est une agence web et communication installée à Gruchet-le-Valasse. Nous créons les sites internet, les fiches Google, les logos et les supports imprimés (cartes, flyers, panneaux) des artisans, commerçants et restaurateurs de Seine-Maritime, avec des tarifs annoncés à l’avance.',
    pitch30: `Aujourd'hui, la plupart des clients cherchent un professionnel sur leur téléphone avant d'appeler.
{{produit}} est une agence installée à Gruchet-le-Valasse : nous créons le site, la fiche Google et les supports imprimés des entreprises du coin, à des prix annoncés à l'avance.
Le premier échange est gratuit et sans engagement : on regarde ensemble ce qui vous serait utile.
Est-ce que je peux vous proposer un rendez-vous d'une vingtaine de minutes ?`,
    pitch60: `{{produit}} est une agence web et communication de Gruchet-le-Valasse, en Seine-Maritime.
Site internet : un site vitrine clair, rapide et lisible sur téléphone, avec vos prestations, vos photos et un bouton d'appel. Le Site Essentiel démarre à 690 € HT.
Présence locale : création ou optimisation de la fiche Google, pour apparaître sur Maps avec vos horaires, vos photos et vos avis.
Image : logo, cartes de visite, flyers, panneaux, autocollants, imprimés en qualité professionnelle.
Packs « Bien démarrer » par métier, pour les entreprises qui s'installent : artisan du bâtiment, restaurant, coiffeur, paysagiste.
Après la mise en ligne, une maintenance mensuelle est possible, avec ou sans engagement.
Le plus simple est d'en parler de vive voix : un rendez-vous gratuit vous conviendrait ?`,
    script: {
      intro:
        "Bonjour {{prenom|}}, {{commercial|}} de {{produit}}, l'agence web et communication de Gruchet-le-Valasse. Je vous appelle rapidement : nous aidons les entreprises du coin à être trouvées en ligne. Je voulais simplement vous poser une question : aujourd'hui, comment vos nouveaux clients vous trouvent-ils ?",
      introStructure:
        "Bonjour {{prenom|}}, {{commercial|}} de {{produit}}, agence web et communication à Gruchet-le-Valasse. Je fais court : nous accompagnons les entreprises locales sur leur site, leur fiche Google et leurs supports. Qui s'occupe de la communication chez vous ?",
      introHasCrm:
        "Bonjour {{prenom|}}, {{commercial|}} de {{produit}}, agence web à Gruchet-le-Valasse. J'ai vu que vous aviez déjà un site internet. Est-ce que vous en êtes satisfait, ou est-ce qu'il y a des choses que vous aimeriez changer ?",
      introNeverProspected:
        "Bonjour {{prenom|}}, {{commercial|}} de {{produit}}, l'agence web et communication de Gruchet-le-Valasse. Je me permets de vous appeler car je n'ai pas trouvé de site à votre nom. Est-ce que c'est un choix, ou un sujet que vous n'avez pas encore eu le temps de traiter ?",
      questions: [
        'Comment vos nouveaux clients vous trouvent-ils aujourd’hui ?',
        'Avez-vous un site internet, ou une page sur les réseaux sociaux ?',
        'Votre fiche Google est-elle à jour (horaires, photos, avis) ?',
        'Avez-vous un logo, des cartes de visite, des flyers ?',
        'Qui s’occupe de votre communication aujourd’hui ?',
        'Avez-vous un projet en tête (ouverture, nouvelle activité, saison) ?',
      ],
      nextSteps: [
        'Proposer un rendez-vous gratuit (à l’établissement, par téléphone ou en visio) et fixer une date.',
        'Envoyer la présentation ou le lien du pack métier par e-mail si le prospect le demande.',
        'Envoyer le cahier des charges en ligne (créé depuis l’administration de l’agence) pour préparer le devis.',
        'Programmer un rappel daté si ce n’est pas le bon moment.',
        'Noter le résultat de l’appel dans la fiche.',
      ],
      beginnerSteps: ['Présentez-vous et dites d’où vous appelez (Gruchet-le-Valasse).', 'Posez la question d’ouverture.', 'Écoutez la réponse.', 'Sélectionnez l’objection ou la réponse du prospect.', 'Utilisez la réponse proposée.', 'Proposez un rendez-vous gratuit.'],
    },
    tree: [
      {
        id: 't1',
        parent: null,
        prospectSays: 'Par le bouche-à-oreille.',
        reply: 'C’est le meilleur canal. Mais quand quelqu’un vous recommande, la personne vous cherche presque toujours sur Google avant d’appeler : un site et une fiche à jour confirment la recommandation.',
        next: 'Si je tape votre nom et votre ville sur Google, qu’est-ce qu’on trouve aujourd’hui ?',
      },
      {
        id: 't1a',
        parent: 't1',
        prospectSays: 'Pas grand-chose, je crois.',
        reply: 'C’est très courant, et c’est rapide à corriger : une fiche Google complète et un site simple suffisent souvent. Je peux vous montrer ce que ça donnerait pour vous.',
        next: 'Un rendez-vous d’une vingtaine de minutes cette semaine, ça vous irait ?',
      },
      {
        id: 't2',
        parent: null,
        prospectSays: 'J’ai une page Facebook, ça me suffit.',
        reply: 'C’est un bon début. La page Facebook n’apparaît pas toujours dans les recherches Google, et elle ne vous appartient pas vraiment. Un site simple, relié à la page et à la fiche Google, complète l’ensemble.',
        next: 'Votre fiche Google est-elle reliée à votre page aujourd’hui ?',
      },
      {
        id: 't3',
        parent: null,
        prospectSays: 'J’ai déjà un site.',
        reply: 'Très bien. Est-ce qu’il est facile à lire sur téléphone, et est-ce que vous pouvez le mettre à jour ? Nous proposons aussi des refontes qui conservent le référencement existant.',
        next: 'Quand a-t-il été refait pour la dernière fois ?',
      },
      {
        id: 't4',
        parent: null,
        prospectSays: 'J’ai assez de travail.',
        reply: 'Tant mieux. Une bonne image sert aussi à choisir ses chantiers ou ses clients, et à préparer les périodes plus calmes. On peut commencer petit : des cartes de visite et une fiche Google soignées.',
        next: 'Est-ce que je peux vous envoyer notre présentation pour plus tard ?',
      },
      {
        id: 't5',
        parent: null,
        prospectSays: 'Je viens de m’installer.',
        reply: 'Félicitations ! C’est justement le bon moment : nous avons des packs « Bien démarrer » par métier, avec logo, cartes, flyers, site et fiche Google, à un prix annoncé à l’avance.',
        next: 'Qu’est-ce qui vous manque le plus aujourd’hui : le logo, les imprimés ou le site ?',
      },
    ],
    closings: {
      interested: 'Parfait. Le plus simple est de se voir une vingtaine de minutes, chez vous ou en visio, pour regarder ensemble ce qui vous serait utile. C’est gratuit et sans engagement.',
      hesitant: 'Aucun problème. Je vous envoie notre présentation et le lien vers le pack de votre métier, pour que vous puissiez regarder tranquillement.',
      callback: 'Très bien, je vous rappelle. Quel jour et quelle heure vous conviennent le mieux ?',
    },
    links: { presentation: `${SITE}/`, demo: `${SITE}/realisations`, signup: `${SITE}/devis`, booking: `${SITE}/contact`, video: '' },
    image: { dataUrl: null, url: '', clickable: true },
    contact: { name: '', phone: '', email: '' },
    signature: '',
    offers: [
      {
        id: 'site-essentiel',
        name: 'Site Essentiel',
        price: 'à partir de 690 € HT',
        period: '',
        features: 'Un site vitrine clair et rapide, jusqu’à 5 pages, adapté au téléphone.',
        limits: 'Nom de domaine et hébergement non inclus (facturés à part, coût annoncé avant de commencer). Rédaction, photos et maintenance en option.',
        trial: 'Premier rendez-vous et devis gratuits.',
        commitment: 'Prestation ponctuelle, sans abonnement.',
        cta: '',
      },
      {
        id: 'site-business',
        name: 'Site Business',
        price: 'à partir de 1 190 € HT',
        period: '',
        features: 'Un site plus complet pour développer l’activité et les demandes de devis.',
        limits: 'Nom de domaine et hébergement non inclus. Rédaction, photographie et maintenance en option.',
        trial: 'Premier rendez-vous et devis gratuits.',
        commitment: 'Prestation ponctuelle, sans abonnement.',
        cta: '',
      },
      {
        id: 'pack-visibilite',
        name: 'Pack Visibilité',
        price: 'à partir de 1 390 € HT',
        period: '',
        features: 'Site Essentiel, fiche Google créée ou optimisée, flyer et carte de visite assortis, conseils de démarrage pour les réseaux sociaux.',
        limits: 'Impression des supports chiffrée à part selon les quantités.',
        trial: 'Premier rendez-vous et devis gratuits.',
        commitment: 'Prestation ponctuelle, sans abonnement.',
        cta: '',
      },
      {
        id: 'packs-metier',
        name: 'Packs « Bien démarrer » par métier',
        price: 'à partir de 1 790 € HT (restaurant : 1 890 € HT)',
        period: '',
        features: 'Pour les entreprises qui s’installent : identité, site, imprimés et fiche Google pensés pour le métier (artisan du bâtiment, restaurant, coiffeur, paysagiste).',
        limits: 'Options métier chiffrées sur devis.',
        trial: 'Premier rendez-vous et devis gratuits.',
        commitment: 'Prestation ponctuelle, sans abonnement.',
        cta: '',
      },
      {
        id: 'maintenance',
        name: 'Maintenance',
        price: 'à partir de 39 € HT',
        period: 'par mois',
        features: 'Mises à jour, sauvegardes et surveillance du site. Formule avec petites modifications à partir de 69 € HT par mois.',
        limits: 'Les évolutions importantes du site sont chiffrées à part.',
        trial: '',
        commitment: 'Au choix : sans engagement (résiliable avec un mois de préavis) ou engagement d’un an à prix remisé. Contrat signé en ligne.',
        cta: '',
      },
    ],
    entries: [
      {
        id: 'p-what',
        category: 'produit',
        sheet: true,
        faq: true,
        question: "Qu'est-ce que {{produit}} ?",
        short: '{{produit}} est une agence web et communication de Gruchet-le-Valasse : sites internet, fiche Google, logos et supports imprimés pour les entreprises locales.',
        long: 'Nous travaillons surtout avec les artisans, commerçants, restaurateurs et indépendants de Seine-Maritime. Les prix sont annoncés à l’avance, le premier rendez-vous et le devis sont gratuits.',
        avoid: 'Ne pas promettre une première place sur Google ni un nombre de clients.',
      },
      {
        id: 'p-who',
        category: 'produit',
        sheet: true,
        faq: true,
        question: "À qui s'adresse {{produit}} ?",
        short: 'Aux artisans du bâtiment, restaurants, commerces, salons et services locaux qui veulent être trouvés et inspirer confiance.',
        long: 'Particulièrement aux entreprises qui démarrent (packs « Bien démarrer ») et à celles qui n’ont pas encore de site, ou un site ancien.',
        avoid: '',
      },
      {
        id: 'f-site',
        category: 'fonctionnalites',
        faq: true,
        question: 'Que contient un site ?',
        short: 'Un site vitrine clair, rapide et lisible sur téléphone : vos prestations, vos photos, vos coordonnées et un bouton d’appel ou de demande de devis.',
        long: 'Le Site Essentiel compte jusqu’à 5 pages. Des pages supplémentaires, la rédaction des textes ou un blog sont possibles en option.',
        avoid: 'Ne pas inclure le nom de domaine ni l’hébergement dans le prix annoncé : ils sont facturés à part.',
      },
      {
        id: 'f-google',
        category: 'fonctionnalites',
        sheet: true,
        question: 'Que faites-vous sur la fiche Google ?',
        short: 'Création ou optimisation de la fiche : catégorie précise, horaires, zone desservie, photos, et un moyen simple de demander des avis.',
        long: 'La fiche Google est souvent la première chose que voit un client sur Maps. Elle est incluse dans le Pack Visibilité et les packs métier.',
        avoid: 'Ne jamais proposer de faux avis ni d’acheter des avis.',
      },
      {
        id: 'f-print',
        category: 'fonctionnalites',
        question: 'Faites-vous l’impression ?',
        short: 'Oui : cartes de visite, flyers, dépliants, affiches, brochures, roll-up, étiquettes, autocollants et bâches, en qualité professionnelle.',
        long: 'La création et l’impression sont chiffrées séparément sur le devis. Un bon à tirer est validé avant toute impression.',
        avoid: '',
      },
      {
        id: 't-price',
        category: 'tarifs',
        sheet: true,
        faq: true,
        question: 'Combien ça coûte ?',
        short: 'Le Site Essentiel démarre à 690 € HT. Le prix final dépend du nombre de pages, des fonctionnalités et des contenus à produire.',
        long: '',
        avoid: 'Ne pas annoncer un prix ferme avant d’avoir vu le besoin : proposer le devis gratuit.',
        dynamic: 'price',
      },
      {
        id: 't-commitment',
        category: 'tarifs',
        faq: true,
        question: 'Y a-t-il un engagement ?',
        short: 'Non pour la création : c’est une prestation ponctuelle. La maintenance est proposée avec ou sans engagement.',
        long: '',
        avoid: '',
        dynamic: 'commitment',
      },
      {
        id: 'l-seo',
        category: 'limites',
        sheet: true,
        question: 'Pouvez-vous garantir la première place sur Google ?',
        short: 'Non, personne ne peut le garantir honnêtement. Nous construisons ce qui aide réellement : un site rapide, une fiche complète, des informations cohérentes partout.',
        long: 'L’accompagnement SEO local mesure les progrès chaque mois, sans promesse de classement.',
        avoid: 'Ne jamais promettre une position ni un délai de référencement.',
      },
      {
        id: 'd-owner',
        category: 'donnees',
        faq: true,
        question: 'Le site m’appartient-il ?',
        short: 'Oui : votre nom de domaine, vos comptes et vos fichiers vous appartiennent.',
        long: '',
        avoid: '',
      },
      {
        id: 'demo-how',
        category: 'demonstration',
        question: 'Comment se passe le premier rendez-vous ?',
        short: 'Une vingtaine de minutes, à votre établissement, par téléphone ou en visio : on regarde votre présence actuelle et vos besoins, puis vous recevez un devis gratuit.',
        long: 'Nous pouvons aussi vous envoyer un cahier des charges en ligne, à remplir à votre rythme, pour préparer le devis.',
        avoid: '',
      },
    ],
    objections: [
      {
        id: 'o-mail',
        objection: 'Envoyez-moi un mail.',
        short: 'Avec plaisir. Pour vous envoyer quelque chose d’utile : c’est plutôt le site, la fiche Google ou les imprimés qui vous intéressent ?',
        long: 'Je vous envoie notre présentation et le lien vers le pack de votre métier. Je vous propose de vous rappeler ensuite : quel jour vous arrange ?',
        followUp: 'À quelle adresse puis-je vous l’envoyer, et quand puis-je vous rappeler ?',
      },
      {
        id: 'o-time',
        objection: "Je n'ai pas le temps.",
        short: 'Je comprends, je fais court : trente secondes, et vous me dites si ça vaut un rappel.',
        long: 'Nous nous occupons de tout : textes, mise en page, mise en ligne. De votre côté, il faut surtout quelques photos et une relecture.',
        followUp: 'Quel moment de la semaine est le plus calme pour vous ?',
      },
      {
        id: 'o-price',
        objection: "C'est trop cher.",
        short: 'Je comprends. On peut commencer petit : une fiche Google bien faite et des cartes de visite, puis le site plus tard.',
        long: 'Le Site Essentiel démarre à 690 € HT, prix annoncé à l’avance. Le devis est gratuit : vous décidez ensuite, sans engagement.',
        followUp: 'Quel budget aviez-vous en tête pour votre communication cette année ?',
        dynamic: 'price',
      },
      {
        id: 'o-nephew',
        objection: 'Mon neveu / un ami peut me le faire.',
        short: 'C’est une bonne solution pour démarrer. La question est surtout de savoir qui le mettra à jour et le maintiendra dans deux ans.',
        long: 'Nous pouvons aussi intervenir ponctuellement : fiche Google, logo propre, imprimés, ou reprise d’un site existant.',
        followUp: 'Le site est-il déjà en ligne, ou encore en projet ?',
      },
      {
        id: 'o-facebook',
        objection: 'Facebook / Instagram me suffit.',
        short: 'Les réseaux sont utiles pour fidéliser. Pour être trouvé par un nouveau client sur Google, la fiche Google et un site simple restent plus efficaces.',
        long: 'Un site relié à vos réseaux et à votre fiche Google vous appartient, contrairement à une page sur une plateforme.',
        followUp: 'Combien de vos nouveaux clients viennent des réseaux, selon vous ?',
      },
      {
        id: 'o-nointerest',
        objection: 'Ça ne m’intéresse pas.',
        short: 'Pas de souci, merci de m’avoir répondu. Puis-je vous laisser mes coordonnées pour plus tard ?',
        long: 'Si vous préférez que je ne vous recontacte pas, je le note tout de suite.',
        followUp: 'Je note de ne plus vous déranger ?',
      },
      {
        id: 'o-already',
        objection: 'J’ai déjà une agence.',
        short: 'Très bien, gardez ce qui fonctionne. Si un jour vous avez besoin d’imprimés, d’une refonte ou d’un second avis, nous sommes à Gruchet-le-Valasse.',
        long: '',
        followUp: 'Puis-je vous envoyer notre présentation pour avoir nos coordonnées ?',
      },
    ],
    arguments: [
      { id: 'a-found', need: 'Être trouvé', text: 'Site rapide et fiche Google complète : les clients du secteur vous trouvent sur leur téléphone.' },
      { id: 'a-trust', need: 'Inspirer confiance', text: 'Logo, devis à en-tête, cartes et site cohérents donnent l’image d’une entreprise établie, même au démarrage.' },
      { id: 'a-local', need: 'Un interlocuteur proche', text: 'Une agence de Gruchet-le-Valasse : rendez-vous à votre établissement possible, en Seine-Maritime.' },
      { id: 'a-price', need: 'Maîtriser son budget', text: 'Tarifs « à partir de » publiés, devis gratuit détaillé, création et impression chiffrées séparément.' },
      { id: 'a-time', need: 'Ne pas y passer de temps', text: 'Nous nous occupons de la mise en page, de la mise en ligne et de la fiche Google ; vous relisez et validez.' },
      { id: 'a-start', need: 'Bien démarrer', text: 'Des packs par métier pour s’installer : tout ce qu’il faut, en une fois, à un prix annoncé.' },
    ],
    comparison: [
      { id: 'c-none', method: 'Rien / bouche-à-oreille seul', strength: 'Gratuit, des clients de confiance.', limit: 'Les personnes recommandées vous cherchent en ligne et ne trouvent rien à confirmer.' },
      { id: 'c-social', method: 'Page Facebook / Instagram', strength: 'Gratuit, utile pour fidéliser.', limit: 'Peu visible dans les recherches Google, la page ne vous appartient pas.' },
      { id: 'c-diy', method: 'Site fait soi-même', strength: 'Peu coûteux au départ.', limit: 'Du temps à y passer, un résultat souvent peu lisible sur téléphone et rarement mis à jour.' },
      { id: 'c-product', method: '{{produit}}', strength: 'Site, fiche Google et imprimés cohérents, faits par une agence locale, prix annoncés.', limit: 'Un budget à prévoir ; le référencement progresse avec le temps, sans garantie de classement.' },
    ],
    emails: [
      {
        id: 'first',
        name: 'Modèle 1 — Premier contact',
        subject: '{{entreprise}} : être trouvé facilement en ligne',
        body: `Bonjour {{prenom|}},

Je m'occupe de {{produit}}, une agence web et communication installée à Gruchet-le-Valasse. Nous accompagnons les entreprises de Seine-Maritime :

- Site internet clair et lisible sur téléphone
- Fiche Google complète (horaires, photos, avis)
- Logo, cartes de visite, flyers et supports imprimés

Le premier rendez-vous et le devis sont gratuits. Seriez-vous disponible pour en parler ?

{{signature}}`,
      },
      {
        id: 'presentation',
        name: 'Modèle 2 — Présentation de l’agence',
        subject: '{{produit}} : site, fiche Google et imprimés',
        body: `Bonjour {{prenom|}},

{{produit}} est une agence web et communication de Gruchet-le-Valasse, pensée pour les entreprises comme {{entreprise}}.

Ce que nous faisons :

- Sites vitrines (Site Essentiel à partir de 690 € HT)
- Création ou optimisation de la fiche Google
- Identité visuelle : logo, cartes de visite, flyers, panneaux
- Packs « Bien démarrer » par métier pour les entreprises qui s'installent
- Maintenance mensuelle, avec ou sans engagement

Tous nos prix sont annoncés à l'avance, et le devis est gratuit. Quel moment vous conviendrait pour un premier échange ?

{{signature}}`,
      },
      {
        id: 'followup',
        name: 'Modèle 3 — Relance après premier email',
        subject: 'Re : la communication de {{entreprise}}',
        body: `Bonjour {{prenom|}},

Je reviens vers vous au sujet de mon précédent message. Est-ce que votre site, votre fiche Google ou vos imprimés sont un sujet pour {{entreprise|votre entreprise}} en ce moment ?

Un premier rendez-vous prend une vingtaine de minutes.

{{signature}}`,
      },
      {
        id: 'noreply',
        name: 'Modèle 4 — Relance sans réponse',
        subject: 'Toujours d’actualité ?',
        body: `Bonjour {{prenom|}},

Je me permets un dernier message. Si ce n'est pas le bon moment, dites-le-moi simplement et je ne vous relancerai pas.

Si un projet de site ou d'impression se présente plus tard, vous pouvez me répondre à tout moment.

{{signature}}`,
      },
      {
        id: 'aftercall',
        name: 'Modèle 5 — Après appel',
        subject: 'Suite à notre échange',
        body: `Bonjour {{prenom|}},

Merci pour notre échange de tout à l'heure.

{{resume}}

Comme convenu, voici notre présentation : {{lien_presentation}}
Pour préparer le devis, vous pouvez décrire votre projet ici : {{lien_inscription}}

Je reste disponible pour un rendez-vous, à votre établissement ou en visio.

{{signature}}`,
      },
      {
        id: 'demo',
        name: 'Modèle 6 — Proposition de rendez-vous',
        subject: 'Un rendez-vous pour {{entreprise}} ?',
        body: `Bonjour {{prenom|}},

Je vous propose un rendez-vous d'une vingtaine de minutes, à votre établissement, par téléphone ou en visio : nous regardons ensemble votre présence actuelle et ce qui vous serait utile. C'est gratuit et sans engagement.

Quels jours vous conviendraient cette semaine ou la suivante ?

{{signature}}`,
      },
    ],
    messages: {
      sms: 'Bonjour {{prenom|}}, {{commercial|}} de {{produit}}, agence web et communication à Gruchet-le-Valasse : sites, fiche Google, logos et flyers. Puis-je vous appeler quelques minutes cette semaine ?',
      whatsapp: 'Bonjour {{prenom|}}, {{commercial|}} de {{produit}}. Nous aidons les entreprises de Seine-Maritime à être trouvées en ligne (site, fiche Google, imprimés). Souhaitez-vous que je vous envoie notre présentation ?',
      linkedin: 'Bonjour {{prenom|}}, je m’occupe de {{produit}}, agence web et communication à Gruchet-le-Valasse. Seriez-vous ouvert à un court échange ?',
    },
  };
}
