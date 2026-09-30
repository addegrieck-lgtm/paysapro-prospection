// Contenu commercial PAR DÉFAUT de l'Assistant commercial (modifiable dans « Assistant commercial → Configurer »).
//
// Règle : chaque phrase décrit une fonctionnalité réellement présente dans l'application. Aucun prix, aucun lien,
// aucune statistique, aucun client n'est écrit ici : ces éléments se configurent (tarifs, liens, image) et les
// boutons correspondants restent masqués tant qu'ils sont vides.
import type { SalesConfig } from './sales';

export function defaultSalesConfig(): SalesConfig {
  return {
    version: 1,
    productName: 'Paysapro',
    presentation:
      "{{produit}} est un outil de prospection pour les entreprises de paysage : il aide à trouver des entreprises à contacter, à retrouver leurs coordonnées professionnelles lorsqu'elles sont publiques, puis à organiser le suivi et les relances.",
    pitch30: `Beaucoup d'entreprises de paysage cherchent leurs contacts à la main, puis les notent dans un carnet ou un tableur.
{{produit}} regroupe au même endroit la recherche d'entreprises par zone, leurs coordonnées professionnelles publiques et le suivi des relances.
Vous passez moins de temps à chercher et vous savez qui rappeler, et quand.
Est-ce que je peux vous montrer comment ça fonctionne, en une quinzaine de minutes ?`,
    pitch60: `{{produit}} est un outil de prospection pensé pour les entreprises de paysage.
Recherche : vous choisissez une activité et une zone — département, région, code postal ou commune — et l'outil liste les entreprises à partir des données publiques officielles.
Enrichissement : pour chaque entreprise, il recherche le téléphone, l'e-mail et le site lorsqu'ils sont publiquement disponibles, avec la source et un niveau de confiance. Tous les numéros et tous les e-mails ne sont pas trouvés : seuls ceux qui sont publiés et correctement identifiés sont retenus.
Suivi : chaque prospect a un statut, des notes et un historique des appels et des messages.
Relances : vous programmez un rappel daté, l'outil vous le présente le jour venu.
Organisation : segments, modèles de messages, score de priorité, import et export CSV.
L'objectif est simple : moins de recherche manuelle, une prospection plus régulière.
Le plus parlant est de le voir : est-ce qu'une courte démonstration vous conviendrait ?`,
    script: {
      intro:
        "Bonjour {{prenom|}}, {{commercial|}} de {{produit}}. Je me permets de vous appeler rapidement : {{produit}} est un outil destiné aux entreprises de paysage pour simplifier leur prospection. Je voulais simplement vous poser une question : aujourd'hui, comment trouvez-vous vos nouveaux prospects ?",
      introStructure:
        "Bonjour {{prenom|}}, {{commercial|}} de {{produit}}. Je fais court : {{produit}} aide les entreprises de paysage à organiser leur prospection. Une question simple : aujourd'hui, comment votre équipe trouve-t-elle et suit-elle ses nouveaux prospects ?",
      introHasCrm:
        "Bonjour {{prenom|}}, {{commercial|}} de {{produit}}. Je fais court : {{produit}} sert à trouver et qualifier de nouveaux contacts professionnels. Vous avez déjà un outil de suivi : comment l'alimentez-vous en nouveaux contacts aujourd'hui ?",
      introNeverProspected:
        "Bonjour {{prenom|}}, {{commercial|}} de {{produit}}. Je me permets de vous appeler rapidement : {{produit}} est un outil simple pour aider les entreprises de paysage à démarrer une prospection. Aujourd'hui, vos nouveaux clients viennent surtout du bouche-à-oreille ?",
      questions: [
        'Comment trouvez-vous vos nouveaux prospects aujourd’hui ?',
        'Sur quelle zone souhaitez-vous vous développer ?',
        'Quel type de clients recherchez-vous en priorité ?',
        'Qui s’occupe de la prospection chez vous ?',
        'Comment suivez-vous vos relances aujourd’hui ?',
        'Combien de temps y passez-vous par semaine, à peu près ?',
      ],
      nextSteps: [
        'Proposer une courte démonstration et fixer une date.',
        'Envoyer la présentation par e-mail si le prospect le demande.',
        'Programmer un rappel daté si ce n’est pas le bon moment.',
        'Noter le résultat de l’appel dans la fiche.',
      ],
      beginnerSteps: ['Présentez-vous.', 'Posez la question d’ouverture.', 'Écoutez la réponse.', 'Sélectionnez l’objection ou la réponse du prospect.', 'Utilisez la réponse proposée.', 'Proposez une démonstration.'],
    },
    tree: [
      {
        id: 't1',
        parent: null,
        prospectSays: 'On travaille surtout avec le bouche-à-oreille.',
        reply:
          "Justement, l'objectif de {{produit}} n'est pas de remplacer le bouche-à-oreille, mais de vous donner une méthode supplémentaire pour identifier des entreprises et contacts potentiels dans les zones que vous ciblez.",
        next: 'Est-ce que vous cherchez actuellement à développer votre clientèle ?',
      },
      {
        id: 't1a',
        parent: 't1',
        prospectSays: 'Oui, on aimerait se développer.',
        reply: 'Dans ce cas, le plus simple est de vous montrer le fonctionnement sur un exemple dans votre secteur.',
        next: 'Quelle zone voulez-vous développer en priorité ?',
      },
      {
        id: 't1b',
        parent: 't1',
        prospectSays: 'Non, on a assez de travail.',
        reply: "C'est une bonne nouvelle. Certaines entreprises utilisent simplement l'outil pour garder une liste de contacts prête pour les périodes plus calmes.",
        next: 'Est-ce que je peux vous envoyer une courte présentation pour plus tard ?',
      },
      {
        id: 't2',
        parent: null,
        prospectSays: 'On cherche nous-mêmes sur internet.',
        reply: "C'est ce que font la plupart des entreprises. {{produit}} fait cette recherche à partir des données publiques et garde les résultats, les notes et les relances au même endroit.",
        next: 'Combien de temps y passez-vous par semaine, à peu près ?',
      },
      {
        id: 't3',
        parent: null,
        prospectSays: 'On ne fait pas vraiment de prospection.',
        reply: "C'est fréquent, souvent par manque de temps ou de méthode. {{produit}} propose un cadre simple : une recherche par zone, une liste de contacts, des rappels datés.",
        next: 'Si vous deviez cibler une zone ou un type de client, ce serait lequel ?',
      },
      {
        id: 't4',
        parent: null,
        prospectSays: 'On a déjà un outil / un CRM.',
        reply: "Très bien. {{produit}} ne cherche pas à le remplacer : il sert surtout à trouver et qualifier de nouveaux contacts, que vous pouvez ensuite exporter en CSV.",
        next: 'Comment alimentez-vous votre outil en nouveaux contacts aujourd’hui ?',
      },
      {
        id: 't5',
        parent: null,
        prospectSays: "Je n'ai pas le temps.",
        reply: 'Je comprends, je fais très court : je peux vous rappeler à un meilleur moment ou vous envoyer une présentation à lire tranquillement.',
        next: 'Que préférez-vous : un rappel ou un e-mail ?',
      },
    ],
    closings: {
      interested: 'Parfait. Le plus simple est que je vous montre concrètement comment ça fonctionne. On peut prévoir une courte démonstration.',
      hesitant: 'Aucun problème. Je peux déjà vous envoyer une présentation pour que vous puissiez regarder tranquillement.',
      callback: 'Très bien, je vous rappelle. Quel jour et quelle heure vous conviennent le mieux ?',
    },
    links: { presentation: '', demo: '', signup: '', booking: '', video: '' },
    image: { dataUrl: null, url: '', clickable: true },
    contact: { name: '', phone: '', email: '' },
    signature: '',
    offers: [],
    entries: [
      // ── Produit (fiche « en 30 secondes ») ──
      {
        id: 'p-what',
        category: 'produit',
        sheet: true,
        faq: true,
        question: "Qu'est-ce que {{produit}} ?",
        short: '{{produit}} est un outil de prospection pour les entreprises de paysage : recherche d’entreprises, coordonnées professionnelles publiques, suivi et relances.',
        long: "L'outil réunit quatre étapes au même endroit : rechercher des entreprises par activité et par zone, compléter leurs coordonnées lorsqu'elles sont publiques, qualifier chaque prospect, puis suivre les échanges et les relances.",
        avoid: 'Ne pas le présenter comme un logiciel de devis ou de facturation : ce module parle de prospection.',
      },
      {
        id: 'p-who',
        category: 'produit',
        sheet: true,
        faq: true,
        question: "À qui s'adresse {{produit}} ?",
        short: 'Aux entreprises de paysage qui veulent prospecter de façon plus simple et plus régulière.',
        long: "Il convient aussi bien à un indépendant qui prospecte lui-même qu'à une entreprise où une personne est chargée du développement commercial.",
        avoid: '',
      },
      {
        id: 'p-problem',
        category: 'produit',
        sheet: true,
        question: 'Quel problème résout {{produit}} ?',
        short: 'La recherche et l’organisation des prospects : moins de recherche manuelle, plus de suivi.',
        long: "Chercher des contacts à la main prend du temps et les informations se dispersent (carnet, tableur, téléphone). {{produit}} centralise la recherche, les coordonnées, les notes et les relances.",
        avoid: 'Ne pas promettre un nombre de clients ou un chiffre d’affaires.',
      },
      {
        id: 'f-how',
        category: 'fonctionnalites',
        sheet: true,
        question: 'Comment fonctionne-t-il ?',
        short: 'Recherche → enrichissement → qualification → suivi → relance.',
        long: "1. Vous recherchez des entreprises par activité et par zone. 2. L'outil complète les fiches (données officielles, téléphone, e-mail, site lorsqu'ils sont publics). 3. Un score aide à prioriser. 4. Vous suivez chaque prospect : statut, notes, historique. 5. Vous programmez vos relances.",
        avoid: '',
      },
      {
        id: 'f-contacts',
        category: 'enrichissement',
        sheet: true,
        question: 'Quels contacts peut-il rechercher ?',
        short: 'Les téléphones, e-mails et sites professionnels, lorsqu’ils sont publiquement disponibles et correctement identifiés.',
        long: "Chaque coordonnée est affichée avec sa source et un niveau de confiance. Une coordonnée introuvable reste vide : rien n'est deviné.",
        avoid: 'Ne jamais dire que tous les numéros ou tous les e-mails seront trouvés.',
      },
      {
        id: 'f-auto',
        category: 'fonctionnalites',
        sheet: true,
        question: 'Est-ce automatique ?',
        short: 'La recherche, l’enrichissement, le score et la détection des doublons sont automatiques. Les appels et l’envoi des messages restent faits par vous.',
        long: "L'outil prépare les messages à partir de modèles et vous rappelle vos relances, mais il n'envoie rien tout seul : chaque e-mail est relu et envoyé depuis votre propre messagerie.",
        avoid: 'Ne pas parler d’envoi automatique d’e-mails en masse : cela n’existe pas dans l’outil.',
      },
      {
        id: 'f-zone',
        category: 'prospection',
        sheet: true,
        question: 'Peut-on rechercher par zone ?',
        short: 'Oui : par département, région, code postal ou commune.',
        long: 'On peut aussi filtrer sur les entreprises actives, les sièges, la taille et la date de création, puis enregistrer ses critères en segments.',
        avoid: '',
      },
      {
        id: 'f-crm',
        category: 'crm',
        sheet: true,
        question: 'Peut-on gérer les prospects ?',
        short: 'Oui : statut, notes, historique des appels et messages, score de priorité, liste « Ne plus contacter ».',
        long: 'Chaque fiche garde la trace des échanges. Les doublons sont détectés et peuvent être fusionnés.',
        avoid: '',
      },
      {
        id: 'f-followup',
        category: 'crm',
        sheet: true,
        question: 'Peut-on suivre les relances ?',
        short: 'Oui : chaque relance a une date, un type et une note, et apparaît dans la liste des relances à faire.',
        long: "Les relances du jour et en retard sont signalées à l'ouverture de l'outil.",
        avoid: '',
      },
      // ── Prospection / sources ──
      {
        id: 's-find',
        category: 'prospection',
        faq: true,
        question: 'Comment trouvez-vous les prospects ?',
        short: 'À partir des données publiques officielles des entreprises (base SIRENE), filtrées par activité et par zone.',
        long: 'La liste vient du répertoire officiel des entreprises françaises : nom, adresse, activité, date de création, tranche d’effectif. Vous pouvez aussi importer votre propre fichier.',
        avoid: '',
      },
      {
        id: 'e-phones',
        category: 'enrichissement',
        faq: true,
        question: 'Comment trouvez-vous les téléphones ?',
        short: '{{produit}} recherche les coordonnées professionnelles publiquement disponibles et les croise lorsque c’est possible.',
        long: "Les numéros viennent d'un annuaire cartographique ouvert et du site officiel de l'entreprise (page contact, mentions légales). Chaque numéro affiche sa source et un niveau de confiance ; l'utilisateur peut le confirmer ou le rejeter.",
        avoid: 'Ne pas promettre un numéro pour chaque entreprise, ni le portable du dirigeant.',
      },
      {
        id: 'e-emails',
        category: 'enrichissement',
        faq: true,
        question: 'Comment trouvez-vous les e-mails ?',
        short: 'L’e-mail est relevé sur le site officiel de l’entreprise lorsqu’elle le publie. Il n’est jamais deviné.',
        long: "L'outil lit les pages publiques du site (contact, mentions légales) et ne retient que les adresses rattachées à l'entreprise. Beaucoup de petites entreprises ne publient pas d'e-mail : dans ce cas le champ reste vide.",
        avoid: 'Ne pas dire « on trouve les e-mails de tout le monde ». Ne pas parler d’e-mails personnels.',
      },
      {
        id: 'e-allmails',
        category: 'limites',
        faq: true,
        question: 'Est-ce que vous trouvez tous les e-mails ?',
        short: 'Non. Seuls les e-mails publiés par l’entreprise sont trouvés ; les autres restent vides.',
        long: 'Le taux dépend du secteur et de la zone : une entreprise sans site ou sans adresse publiée n’aura pas d’e-mail. On peut toujours en ajouter un à la main.',
        avoid: 'Ne donner aucun pourcentage non mesuré.',
      },
      {
        id: 'e-allcompanies',
        category: 'limites',
        faq: true,
        question: 'Est-ce que vous trouvez toutes les entreprises ?',
        short: 'La recherche s’appuie sur le répertoire officiel : les entreprises enregistrées avec l’activité recherchée dans la zone choisie.',
        long: "Une entreprise mal classée dans le répertoire ou très récente peut manquer. Il est possible d'ajouter une entreprise à la main ou d'importer un fichier.",
        avoid: 'Ne pas dire « 100 % des entreprises ».',
      },
      {
        id: 'd-sources',
        category: 'sources',
        faq: true,
        question: 'D’où viennent les données ?',
        short: 'De sources publiques : répertoire officiel des entreprises, annuaire cartographique ouvert, site officiel de chaque entreprise.',
        long: "Chaque information affiche sa provenance et sa date. Les moteurs de recherche et les annuaires commerciaux ne sont pas aspirés. L'utilisateur peut aussi saisir ou importer ses propres données.",
        avoid: 'Ne pas citer de source qui n’est pas utilisée.',
      },
      {
        id: 'd-verified',
        category: 'donnees',
        faq: true,
        question: 'Est-ce que les données sont vérifiées ?',
        short: 'Elles sont croisées lorsque c’est possible et affichées avec un niveau de confiance. Une vérification humaine reste utile avant d’appeler.',
        long: "Un numéro retrouvé sur plusieurs sources, ou sur un site dont l'identité est confirmée, obtient une confiance élevée. L'utilisateur peut confirmer ou rejeter une coordonnée, ce qui améliore les recherches suivantes.",
        avoid: 'Ne pas dire « données garanties » ou « vérifiées à 100 % ».',
      },
      {
        id: 'd-storage',
        category: 'securite',
        question: 'Où sont stockées mes données ?',
        short: 'Sur votre appareil, dans votre navigateur. Elles ne sont pas envoyées sur un serveur de {{produit}}.',
        long: "Une sauvegarde complète peut être exportée en fichier et restaurée. Conséquence : changer d'appareil ou vider le navigateur sans sauvegarde fait perdre les données.",
        avoid: 'Ne pas promettre de synchronisation entre appareils : elle n’existe pas aujourd’hui.',
      },
      {
        id: 'r-legal',
        category: 'rgpd',
        faq: true,
        question: 'Est-ce légal ?',
        short: 'L’outil utilise des données d’entreprises publiques et des coordonnées professionnelles publiées. La prospection entre professionnels reste encadrée : chacun doit informer ses contacts et respecter leurs refus.',
        long: "{{produit}} aide à respecter ces règles : liste « Ne plus contacter », effacement des données d'un prospect, origine et date de chaque information, pas d'envoi en masse. L'utilisateur reste responsable de ses messages.",
        avoid: 'Ne pas donner d’avis juridique ni dire « c’est 100 % légal, vous ne risquez rien ».',
      },
      {
        id: 'r-optout',
        category: 'rgpd',
        question: 'Que se passe-t-il si un contact ne veut plus être sollicité ?',
        short: 'Il est placé dans la liste « Ne plus contacter » : plus aucun message ni relance ne peut être préparé pour lui.',
        long: 'Cette exclusion est conservée même si l’entreprise est réimportée plus tard. Ses données personnelles peuvent aussi être effacées.',
        avoid: '',
      },
      // ── Tarifs (réponses calculées à partir des formules configurées) ──
      { id: 'q-price', category: 'tarifs', faq: true, dynamic: 'price', question: 'Combien ça coûte ?', short: '', long: '', avoid: 'Ne jamais annoncer un prix qui n’est pas dans les formules configurées.' },
      { id: 'q-commitment', category: 'tarifs', faq: true, dynamic: 'commitment', question: 'Est-ce qu’il y a un engagement ?', short: '', long: '', avoid: 'Ne pas improviser de conditions.' },
      { id: 'q-trial', category: 'tarifs', faq: true, dynamic: 'trial', question: 'Est-ce que je peux essayer ?', short: '', long: '', avoid: 'Ne pas promettre d’essai gratuit s’il n’est pas prévu dans les formules.' },
      // ── Divers ──
      {
        id: 'q-import',
        category: 'fonctionnalites',
        faq: true,
        question: 'Est-ce que je peux importer mes propres prospects ?',
        short: 'Oui, depuis un fichier CSV. Les doublons sont repérés et vos données saisies ne sont jamais écrasées.',
        long: "À l'import, vous faites correspondre vos colonnes (nom, SIRET, téléphone, e-mail…). L'outil peut ensuite compléter les fiches. L'export CSV est également possible.",
        avoid: '',
      },
      {
        id: 'q-team',
        category: 'limites',
        faq: true,
        question: 'Est-ce que plusieurs commerciaux peuvent utiliser {{produit}} ?',
        short: 'Aujourd’hui, chaque poste a sa propre base, enregistrée sur l’appareil. Le partage en temps réel entre commerciaux n’est pas encore disponible.',
        long: 'On peut échanger des prospects par export et import de fichier. Le travail à plusieurs sur une base commune est une évolution prévue, pas une fonctionnalité actuelle.',
        avoid: 'Ne pas vendre un travail d’équipe en temps réel : ce n’est pas disponible.',
      },
      {
        id: 'a-benefits',
        category: 'avantages',
        question: 'Quels sont les avantages ?',
        short: 'Moins de recherche manuelle, des informations centralisées, des relances qui ne sont plus oubliées.',
        long: 'Recherche par zone, coordonnées publiques regroupées, score de priorité, suivi des échanges, rappels datés : la prospection devient une routine simple plutôt qu’une corvée.',
        avoid: 'Pas de promesse de résultat chiffré.',
      },
      {
        id: 'demo-how',
        category: 'demonstration',
        question: 'Comment se passe une démonstration ?',
        short: 'Une quinzaine de minutes, par téléphone ou en visio : on fait une recherche dans votre zone et on regarde une fiche prospect ensemble.',
        long: 'Le prospect voit la recherche, l’enrichissement d’une entreprise, puis le suivi et la programmation d’une relance.',
        avoid: '',
      },
    ],
    objections: [
      {
        id: 'o-mail',
        objection: 'Envoyez-moi un mail.',
        short: 'Avec plaisir. Pour vous envoyer quelque chose d’utile : vous prospectez plutôt par téléphone ou par e-mail aujourd’hui ?',
        long: "Je vous envoie une présentation courte avec un aperçu de l'outil. Je vous propose de vous rappeler ensuite pour répondre à vos questions : quel jour vous arrange ?",
        followUp: 'À quelle adresse puis-je vous l’envoyer, et quand puis-je vous rappeler ?',
      },
      {
        id: 'o-time',
        objection: "Je n'ai pas le temps.",
        short: 'Je comprends, je fais court : trente secondes, et vous me dites si ça vaut un rappel.',
        long: "{{produit}} sert justement à passer moins de temps à chercher des contacts. Si ce n'est pas le moment, je vous rappelle quand vous voulez.",
        followUp: 'Quel moment de la semaine est le plus calme pour vous ?',
      },
      {
        id: 'o-nointerest',
        objection: 'Ça ne m’intéresse pas.',
        short: 'Pas de souci, je ne veux pas vous déranger. Juste par curiosité : c’est parce que vous ne prospectez pas, ou parce que vous avez déjà votre méthode ?',
        long: 'Si vous avez déjà ce qu’il vous faut, je le note et je ne vous relance pas. Si le sujet revient un jour, vous saurez que l’outil existe.',
        followUp: 'Souhaitez-vous que je ne vous recontacte plus ?',
      },
      {
        id: 'o-clients',
        objection: 'Nous avons déjà des clients.',
        short: 'Tant mieux. L’outil sert surtout à préparer la suite : garder une liste de contacts prête quand l’activité ralentit.',
        long: "Beaucoup d'entreprises prospectent seulement quand le carnet se vide, ce qui arrive tard. Une liste qualifiée tenue à jour évite de repartir de zéro.",
        followUp: 'Y a-t-il une période de l’année où vous aimeriez avoir plus de demandes ?',
      },
      {
        id: 'o-already',
        objection: 'Nous faisons déjà notre prospection.',
        short: 'Très bien. Comment cherchez-vous vos contacts aujourd’hui ?',
        long: "{{produit}} ne change pas votre façon de prospecter : il réduit le temps de recherche et garde coordonnées, notes et relances au même endroit.",
        followUp: 'Qu’est-ce qui vous prend le plus de temps aujourd’hui : chercher les contacts ou les suivre ?',
      },
      {
        id: 'o-crm',
        objection: 'Nous avons déjà un CRM.',
        short: 'Parfait, gardez-le. {{produit}} sert surtout à trouver de nouveaux contacts, que vous pouvez exporter en CSV vers votre outil.',
        long: 'Un CRM classique gère les contacts que vous y entrez ; il ne les recherche pas forcément pour vous. Les deux se complètent.',
        followUp: 'Comment ajoutez-vous de nouveaux contacts dans votre CRM aujourd’hui ?',
      },
      { id: 'o-price', objection: 'Combien ça coûte ?', dynamic: 'price', short: '', long: '', followUp: 'Pour vous orienter vers la bonne formule : vous seriez combien à l’utiliser ?' },
      {
        id: 'o-really',
        objection: 'Ça trouve vraiment des prospects ?',
        short: 'Oui : il liste les entreprises du répertoire officiel dans la zone et l’activité que vous choisissez. Le plus simple est de le voir sur votre secteur.',
        long: "L'outil trouve des entreprises et leurs coordonnées publiques. Il ne promet pas de clients : c'est votre démarche commerciale qui fait la différence.",
        followUp: 'Sur quelle zone voulez-vous que je vous montre un exemple ?',
      },
      {
        id: 'o-origin',
        objection: 'D’où viennent les coordonnées ?',
        short: 'De sources publiques : répertoire officiel des entreprises, annuaire ouvert, site de l’entreprise. La source est affichée pour chaque coordonnée.',
        long: 'Rien n’est acheté ni deviné. Quand une coordonnée n’est pas publique, le champ reste vide.',
        followUp: 'Voulez-vous voir à quoi ressemble une fiche ?',
      },
      {
        id: 'o-legal',
        objection: 'Est-ce légal ?',
        short: 'L’outil s’appuie sur des données d’entreprises publiques et des coordonnées professionnelles publiées, et il gère les refus de contact.',
        long: 'La prospection entre professionnels est encadrée : informer ses contacts et respecter leur opposition. L’outil fournit la liste « Ne plus contacter » et l’effacement des données ; chacun reste responsable de ses messages.',
        followUp: 'Est-ce un sujet sur lequel vous avez déjà eu des questions ?',
      },
      {
        id: 'o-emails',
        objection: 'Est-ce que vous trouvez les emails ?',
        short: 'Oui, lorsqu’ils sont publiés par l’entreprise sur son site. Pas pour toutes : beaucoup de petites entreprises n’en publient pas.',
        long: 'L’e-mail n’est jamais deviné. Quand il n’est pas public, le téléphone reste souvent le meilleur moyen de contact.',
        followUp: 'Vous prospectez plutôt par e-mail ou par téléphone ?',
      },
      {
        id: 'o-phones',
        objection: 'Est-ce que vous trouvez les téléphones ?',
        short: 'Oui, {{produit}} recherche les coordonnées professionnelles publiquement disponibles et les croise lorsque c’est possible.',
        long: 'Chaque numéro est affiché avec sa source et un niveau de confiance. Tous les numéros ne sont pas trouvés.',
        followUp: 'Voulez-vous que l’on regarde ce que ça donne sur votre zone ?',
      },
      {
        id: 'o-myself',
        objection: 'Je préfère chercher moi-même.',
        short: 'C’est tout à fait possible, et vous gardez la main. L’outil fait la partie répétitive : la liste et les coordonnées.',
        long: 'Vous choisissez toujours qui contacter et ce que vous dites. L’outil évite surtout de refaire les mêmes recherches et d’oublier une relance.',
        followUp: 'Combien de temps vous prend une recherche aujourd’hui ?',
      },
      { id: 'o-subscribe', objection: 'Je ne veux pas m’abonner.', dynamic: 'commitment', short: '', long: '', followUp: 'Qu’est-ce qui vous gêne le plus : la durée ou le budget ?' },
      {
        id: 'o-think',
        objection: 'Je vais réfléchir.',
        short: 'Bien sûr. Pour vous aider à réfléchir : qu’est-ce qui vous manque pour vous faire un avis ?',
        long: 'Je peux vous envoyer une présentation ou vous montrer l’outil sur votre propre zone, sans engagement de votre part.',
        followUp: 'Je vous rappelle en fin de semaine pour en reparler ?',
      },
      {
        id: 'o-later',
        objection: 'Rappelez-moi plus tard.',
        short: 'Entendu. Quel jour et à quelle heure vous conviennent le mieux ?',
        long: 'Je note le rappel pour ne pas vous déranger au mauvais moment.',
        followUp: 'Préférez-vous le matin ou la fin de journée ?',
      },
    ],
    arguments: [
      { id: 'a-time', need: 'Gagner du temps', text: 'La recherche d’entreprises et de coordonnées publiques se fait en quelques clics au lieu d’une recherche une à une.' },
      { id: 'a-more', need: 'Trouver davantage de prospects', text: 'Le répertoire officiel liste les entreprises de l’activité et de la zone choisies, y compris celles que l’on ne connaît pas encore.' },
      { id: 'a-zone', need: 'Prospecter une nouvelle zone', text: 'Un département, un code postal ou une commune suffit pour obtenir la liste des entreprises du secteur.' },
      { id: 'a-org', need: 'Organiser ses prospects', text: 'Chaque prospect a un statut, un score de priorité et des segments enregistrés.' },
      { id: 'a-central', need: 'Centraliser les informations', text: 'Coordonnées, notes, appels et messages sont dans une seule fiche, avec leur origine.' },
      { id: 'a-follow', need: 'Améliorer les relances', text: 'Chaque relance est datée et rappelée le jour venu : plus de contact oublié.' },
      { id: 'a-manual', need: 'Réduire la recherche manuelle', text: 'Les fiches sont complétées automatiquement à partir des sources publiques ; vous ne saisissez que ce qui manque.' },
    ],
    comparison: [
      { id: 'c-manual', method: 'Recherche manuelle', strength: 'Gratuite, aucune prise en main.', limit: 'Demande du temps : chaque entreprise est cherchée une à une.' },
      { id: 'c-sheet', method: 'Tableur', strength: 'Souple et connu de tous.', limit: 'Organisation limitée : pas de rappel de relance ni d’historique.' },
      { id: 'c-crm', method: 'CRM classique', strength: 'Bon suivi des contacts et des affaires.', limit: 'Gère les contacts saisis, sans forcément les rechercher ni les compléter.' },
      { id: 'c-product', method: '{{produit}}', strength: 'Recherche, enrichissement, organisation et relance au même endroit.', limit: 'Données enregistrées sur l’appareil ; pas de partage en temps réel entre commerciaux aujourd’hui.' },
    ],
    emails: [
      {
        id: 'first',
        name: 'Modèle 1 — Premier contact',
        subject: 'Simplifier votre prospection',
        body: `Bonjour {{prenom|}},

Je me permets de vous contacter car nous avons développé {{produit}}, un outil conçu pour aider les entreprises de paysage à simplifier leur prospection.

- Rechercher des entreprises à contacter par activité et par zone
- Retrouver leurs coordonnées professionnelles lorsqu'elles sont publiques
- Suivre vos contacts et vos relances au même endroit

Seriez-vous disponible pour une courte démonstration ?

{{signature}}`,
      },
      {
        id: 'presentation',
        name: 'Modèle 2 — Présentation du SaaS',
        subject: '{{produit}} : recherche, coordonnées et suivi de vos prospects',
        body: `Bonjour {{prenom|}},

{{produit}} est un outil de prospection pensé pour les entreprises de paysage comme {{entreprise}}.

Voici ce qu'il permet de faire :

- Rechercher des entreprises par activité, département, code postal ou commune
- Compléter les fiches : téléphone, e-mail et site lorsqu'ils sont publiquement disponibles, avec leur source
- Prioriser grâce à un score et à des segments
- Suivre chaque échange : statut, notes, historique
- Programmer des relances datées

L'outil ne trouve pas toutes les coordonnées : seules celles qui sont publiques et correctement identifiées sont retenues.

Je peux vous le montrer sur votre propre secteur en une quinzaine de minutes. Quel moment vous conviendrait ?

{{signature}}`,
      },
      {
        id: 'followup',
        name: 'Modèle 3 — Relance après premier email',
        subject: 'Re : simplifier votre prospection',
        body: `Bonjour {{prenom|}},

Je reviens vers vous au sujet de {{produit}}. Est-ce que la prospection est un sujet pour {{entreprise|votre entreprise}} en ce moment ?

Une démonstration prend une quinzaine de minutes.

{{signature}}`,
      },
      {
        id: 'noreply',
        name: 'Modèle 4 — Relance sans réponse',
        subject: 'Toujours d’actualité ?',
        body: `Bonjour {{prenom|}},

Je me permets un dernier message au sujet de {{produit}}. Si ce n'est pas le bon moment, dites-le-moi simplement et je ne vous relancerai pas.

Si le sujet vous intéresse plus tard, vous pouvez me répondre à tout moment.

{{signature}}`,
      },
      {
        id: 'aftercall',
        name: 'Modèle 5 — Après appel',
        subject: 'Suite à notre échange',
        body: `Bonjour {{prenom|}},

Merci pour notre échange de tout à l'heure.

{{resume}}

Comme convenu, voici une présentation de {{produit}} : recherche d'entreprises par zone, coordonnées professionnelles publiques, suivi et relances au même endroit.

Je reste disponible pour une courte démonstration si vous souhaitez le voir en pratique.

{{signature}}`,
      },
      {
        id: 'demo',
        name: 'Modèle 6 — Demande de démonstration',
        subject: 'Une démonstration de {{produit}} ?',
        body: `Bonjour {{prenom|}},

Je vous propose une démonstration de {{produit}} d'une quinzaine de minutes, par téléphone ou en visio, avec un exemple de recherche à {{ville|dans votre secteur}}.

Quels jours vous conviendraient cette semaine ou la suivante ?

{{signature}}`,
      },
    ],
    messages: {
      sms: 'Bonjour {{prenom|}}, {{commercial|}} de {{produit}} : un outil pour simplifier la prospection des entreprises de paysage. Puis-je vous appeler quelques minutes cette semaine ?',
      whatsapp: 'Bonjour {{prenom|}}, {{commercial|}} de {{produit}}. Nous aidons les entreprises de paysage à trouver et suivre leurs prospects. Souhaitez-vous que je vous envoie une courte présentation ?',
      linkedin: 'Bonjour {{prenom|}}, je développe {{produit}}, un outil de prospection pensé pour les entreprises de paysage. Seriez-vous ouvert à un court échange ?',
    },
  };
}
