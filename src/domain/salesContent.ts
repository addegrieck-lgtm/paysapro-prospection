// Contenu commercial PAR DÉFAUT de l'Assistant commercial (modifiable dans « Assistant commercial → Configurer »).
//
// Le produit vendu est PAYSAPRO AI : l'application de devis pour paysagistes (cette application-ci, Paysapro
// Prospection, n'est que l'outil interne qui sert à la commercialiser).
//
// Règle : chaque phrase décrit une fonctionnalité réellement présente dans Paysapro AI (version bêta), telle que
// décrite dans sa documentation et son aide. Les limites de la bêta sont dites clairement. Aucun lien, aucune
// statistique, aucun client n'est écrit ici ; la seule formule pré-remplie est la bêta gratuite, annoncée par le
// produit lui-même. Liens et image se configurent, et leurs boutons restent masqués tant qu'ils sont vides.
import type { SalesConfig } from './sales';

export function defaultSalesConfig(): SalesConfig {
  return {
    version: 1,
    productName: 'Paysapro AI',
    presentation:
      "{{produit}} est une application pour les paysagistes qui permet de préparer le devis directement chez le client : photos, mesures, prix, puis un devis en PDF que le client peut accepter et signer sur place.",
    pitch30: `Beaucoup de paysagistes prennent leurs mesures chez le client, puis refont le devis le soir à l'ordinateur.
{{produit}} permet de le faire sur place, depuis le téléphone : photos, mesures, prestations, et le devis en PDF est prêt.
Le client peut l'accepter et le signer tout de suite, et vous ne ressaisissez rien.
Est-ce que je peux vous montrer comment ça fonctionne, en une quinzaine de minutes ?`,
    pitch60: `{{produit}} est une application pensée pour les paysagistes, utilisable sur téléphone comme sur ordinateur.
Sur le chantier : vous prenez vos photos et vos mesures — surfaces, longueurs, zones à déduire — et les quantités sont calculées pour vous.
Prix : vous choisissez vos prestations dans votre catalogue. Chaque ligne a un prix de vente et un coût interne : vous voyez votre marge, le client ne la voit jamais.
Devis : un PDF à vos couleurs, avec logo, photos, TVA, acompte et conditions.
Signature : le client consulte le devis sur votre appareil, l'accepte et signe avec le doigt. Il s'agit d'une validation simple du devis, pas d'une signature électronique qualifiée.
Suivi : le devis signé devient un chantier, avec planning, notes, checklist et paiements reçus.
L'application fonctionne sans réseau et vos données restent sur votre appareil.
Elle est en version bêta, gratuite pour le moment. Le plus parlant est de la voir : une courte démonstration vous conviendrait ?`,
    script: {
      intro:
        "Bonjour {{prenom|}}, {{commercial|}} de {{produit}}. Je me permets de vous appeler rapidement : {{produit}} est une application pour les paysagistes, qui permet de faire le devis directement chez le client. Je voulais simplement vous poser une question : aujourd'hui, comment faites-vous vos devis ?",
      introStructure:
        "Bonjour {{prenom|}}, {{commercial|}} de {{produit}}. Je fais court : {{produit}} est une application de devis pensée pour les entreprises de paysage. Une question simple : chez vous, qui prépare les devis, et avec quel outil ?",
      introHasCrm:
        "Bonjour {{prenom|}}, {{commercial|}} de {{produit}}. Je fais court : {{produit}} permet de préparer le devis sur le chantier, photos et mesures comprises. Vous avez déjà un logiciel de devis : est-ce que vous pouvez l'utiliser directement chez le client ?",
      introNeverProspected:
        "Bonjour {{prenom|}}, {{commercial|}} de {{produit}}. Je me permets de vous appeler rapidement : {{produit}} est une application simple pour faire ses devis de paysage depuis le téléphone. Aujourd'hui, vous les préparez plutôt à la main ou sur un tableur ?",
      questions: [
        'Comment faites-vous vos devis aujourd’hui ?',
        'Combien de temps s’écoule entre la visite chez le client et l’envoi du devis ?',
        'À peu près combien de devis faites-vous par mois ?',
        'Savez-vous facilement quelle marge vous laisse chaque devis ?',
        'Comment le client valide-t-il votre devis aujourd’hui ?',
        'Qui s’occupe des devis chez vous ?',
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
        prospectSays: 'Je les fais le soir, à l’ordinateur.',
        reply: "C'est le cas de beaucoup de paysagistes. L'idée de {{produit}} est justement de préparer le devis pendant la visite, pour ne plus avoir à le refaire le soir.",
        next: 'Combien de temps vous prend un devis, une fois rentré ?',
      },
      {
        id: 't1a',
        parent: 't1',
        prospectSays: 'Ça me prend beaucoup de temps.',
        reply: 'Dans ce cas, le plus simple est de vous montrer un devis fait de A à Z sur un exemple de chantier.',
        next: 'Quel type de chantier faites-vous le plus souvent ?',
      },
      {
        id: 't1b',
        parent: 't1',
        prospectSays: 'Ça va, je suis organisé.',
        reply: "Tant mieux. Certains utilisent surtout l'application pour faire signer le client sur place, tant qu'il est décidé.",
        next: 'Est-ce que je peux vous envoyer une courte présentation pour regarder tranquillement ?',
      },
      {
        id: 't2',
        parent: null,
        prospectSays: 'Je les fais sur Excel / Word.',
        reply: "Ça fonctionne, mais il faut ressaisir les mesures et refaire les calculs. {{produit}} calcule les quantités à partir de vos mesures et garde vos prix dans un catalogue.",
        next: 'Vous arrive-t-il de reprendre un ancien devis pour en faire un nouveau ?',
      },
      {
        id: 't3',
        parent: null,
        prospectSays: 'J’ai déjà un logiciel de devis.',
        reply: "Très bien, gardez ce qui fonctionne. {{produit}} est pensé pour le terrain et pour le paysage : photos, mesures de surfaces, signature du client sur place.",
        next: 'Pouvez-vous faire le devis directement chez le client avec votre logiciel actuel ?',
      },
      {
        id: 't4',
        parent: null,
        prospectSays: 'Je les fais à la main, sur papier.',
        reply: "C'est rapide à écrire, mais difficile à retrouver et à suivre. {{produit}} garde tous vos devis, avec leur statut : envoyé, accepté, signé.",
        next: 'Comment retrouvez-vous un devis fait il y a quelques mois ?',
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
    offers: [
      {
        id: 'beta',
        name: 'Bêta',
        price: '0 €',
        period: 'pendant la bêta',
        features: 'Toutes les fonctionnalités sont ouvertes.',
        limits: 'Le prix définitif sera annoncé avant la fin de la bêta.',
        trial: 'L’accès est gratuit pendant toute la bêta, sans carte bancaire.',
        commitment: 'Aucun engagement ni abonnement pendant la bêta.',
        cta: '',
      },
    ],
    entries: [
      // ── Produit (fiche « en 30 secondes ») ──
      {
        id: 'p-what',
        category: 'produit',
        sheet: true,
        faq: true,
        question: "Qu'est-ce que {{produit}} ?",
        short: '{{produit}} est une application de devis pour les paysagistes : photos, mesures, prix, devis en PDF et signature du client, directement depuis le chantier.',
        long: "C'est une application web qui s'installe sur le téléphone. Elle suit tout le parcours : visite chez le client, chiffrage, devis, présentation, signature, puis suivi du chantier.",
        avoid: 'Ne pas la présenter comme un logiciel de comptabilité ou de facturation.',
      },
      {
        id: 'p-who',
        category: 'produit',
        sheet: true,
        faq: true,
        question: "À qui s'adresse {{produit}} ?",
        short: 'Aux paysagistes, jardiniers et entreprises d’aménagement extérieur qui font eux-mêmes leurs devis.',
        long: "Elle convient surtout à l'artisan ou au dirigeant qui se déplace chez le client et chiffre lui-même. Pendant la bêta, l'application s'utilise sur un seul appareil.",
        avoid: 'Ne pas la vendre comme un outil pour une équipe de plusieurs utilisateurs : ce n’est pas encore possible.',
      },
      {
        id: 'p-problem',
        category: 'produit',
        sheet: true,
        question: 'Quel problème résout {{produit}} ?',
        short: 'Le devis refait le soir : avec {{produit}}, il est préparé pendant la visite et prêt à être présenté.',
        long: 'Mesures notées sur un carnet, calculs refaits à la main, devis envoyé plusieurs jours après : l’application réunit photos, mesures, prix et devis au même endroit.',
        avoid: 'Ne pas promettre un nombre de devis signés ni un chiffre d’affaires.',
      },
      {
        id: 'f-how',
        category: 'fonctionnalites',
        sheet: true,
        faq: true,
        question: 'Comment fonctionne-t-il ?',
        short: 'Client → chantier → photos et mesures → prix → devis en PDF → présentation au client → signature → suivi du chantier.',
        long: "On touche « Nouveau devis » et un parcours guidé enchaîne les étapes. Les quantités, la TVA et le total sont calculés automatiquement. Le brouillon est enregistré en continu : on peut s'interrompre et reprendre.",
        avoid: '',
      },
      {
        id: 'f-measures',
        category: 'devis',
        sheet: true,
        question: 'Comment se font les mesures et les prix ?',
        short: 'Vous saisissez vos zones (rectangle, triangle, cercle, surface connue) et vos longueurs ; les quantités du devis en découlent.',
        long: 'Chaque prestation a un prix de vente et un coût interne, tenus dans votre catalogue. Vous voyez le coût et la marge de chaque devis ; le client ne voit que le prix de vente. Cinq modèles de devis sont fournis (pelouse, terrasse, clôture, plantation, entretien) et vous pouvez créer les vôtres.',
        avoid: 'Ne pas dire que l’application mesure le terrain toute seule : les mesures sont saisies par le professionnel.',
      },
      {
        id: 'f-pdf',
        category: 'devis',
        sheet: true,
        question: 'À quoi ressemble le devis ?',
        short: 'Un PDF à vos couleurs : logo, client, chantier, photos, prestations, TVA, total, acompte, conditions et signature.',
        long: 'Le devis est numéroté et daté, avec une durée de validité. Vous choisissez les photos qui y figurent. La TVA est gérée, y compris la mention de franchise en base.',
        avoid: 'Ne pas garantir la conformité juridique du devis : les mentions obligatoires restent à vérifier par l’entreprise.',
      },
      {
        id: 'f-sign',
        category: 'devis',
        sheet: true,
        faq: true,
        question: 'Comment le client signe-t-il ?',
        short: 'Le client consulte le devis sur votre téléphone ou votre tablette, touche « Accepter le devis » et signe avec le doigt.',
        long: "Le nom, la date et l'heure sont enregistrés. C'est une validation simple du devis, pas une signature électronique qualifiée. Vous pouvez aussi partager le PDF par e-mail, WhatsApp ou SMS.",
        avoid: 'Ne jamais dire « signature électronique certifiée » ou « valeur légale garantie ». Ne pas promettre un lien de signature à distance : il n’existe pas encore.',
      },
      {
        id: 'f-auto',
        category: 'ia',
        sheet: true,
        faq: true,
        question: 'Est-ce que c’est une IA qui fait le devis ?',
        short: 'Non : l’assistant propose, vous décidez. Chaque suggestion est expliquée et c’est vous qui l’ajoutez ou l’ignorez.',
        long: "L'assistant suggère des prestations à partir de ce que vous avez décrit et peut rédiger une description, que vous pouvez modifier. Il n'invente aucune mesure et n'analyse pas automatiquement les photos.",
        avoid: 'Ne pas dire que l’IA analyse les photos ou chiffre le chantier toute seule : ce n’est pas le cas.',
      },
      {
        id: 'f-offline',
        category: 'fonctionnalites',
        sheet: true,
        faq: true,
        question: 'Est-ce que ça fonctionne sans réseau ?',
        short: 'Oui. Après une première ouverture, l’application fonctionne sans connexion : utile dans un jardin mal couvert.',
        long: "Elle s'installe sur l'écran d'accueil du téléphone, sur iPhone comme sur Android, et fonctionne aussi sur ordinateur.",
        avoid: '',
      },
      {
        id: 'f-projects',
        category: 'chantiers',
        sheet: true,
        question: 'Peut-on suivre les chantiers et les clients ?',
        short: 'Oui : chaque devis signé devient un chantier, avec planning, notes internes, checklist, paiements reçus et photos avant / après.',
        long: 'Chaque client a sa fiche avec ses chantiers, ses devis et son historique. Les statuts avancent d’eux-mêmes : brouillon, envoyé, vu, accepté, signé, puis planifié, en cours, terminé.',
        avoid: 'Ne pas parler de paiement en ligne : les paiements reçus sont simplement notés.',
      },
      {
        id: 'f-stats',
        category: 'chantiers',
        question: 'Y a-t-il des statistiques ?',
        short: 'Oui : devis émis et signés, taux de transformation, devis moyen, montant signé par mois et marge des devis signés.',
        long: 'Des notifications préviennent aussi quand un devis est signé, bientôt expiré, ou quand un chantier commence.',
        avoid: '',
      },
      // ── Données, sécurité, limites ──
      {
        id: 'd-storage',
        category: 'donnees',
        faq: true,
        question: 'Mes données sont-elles sauvegardées ?',
        short: 'Pendant la bêta, vos données sont enregistrées sur votre appareil. Elles ne sont pas synchronisées en ligne : il faut télécharger une sauvegarde régulièrement.',
        long: 'La sauvegarde se fait dans Paramètres → Données. Le fichier contient clients, chantiers, devis, catalogue et photos, et peut être réimporté sur un autre appareil.',
        avoid: 'Ne pas promettre de sauvegarde automatique en ligne : elle n’existe pas encore.',
      },
      {
        id: 'd-privacy',
        category: 'securite',
        question: 'Qui peut voir mes prix et mes marges ?',
        short: 'Vous seul. Le client ne voit ni vos coûts, ni votre marge, ni vos notes internes : seulement le devis.',
        long: 'Les données restent sur votre appareil et ne sont pas envoyées sur un serveur pendant la bêta.',
        avoid: '',
      },
      {
        id: 'r-rgpd',
        category: 'rgpd',
        question: 'Et pour les données de mes clients ?',
        short: 'Elles restent sur votre appareil. Vous pouvez les exporter ou tout supprimer depuis les paramètres.',
        long: 'Vous restez responsable des données de vos clients, comme avec n’importe quel fichier client.',
        avoid: 'Ne pas donner d’avis juridique.',
      },
      {
        id: 'l-devices',
        category: 'limites',
        faq: true,
        question: 'Peut-on l’utiliser à plusieurs ou sur plusieurs appareils ?',
        short: 'Pas encore : pendant la bêta, les données sont sur un seul appareil, sans synchronisation.',
        long: 'On peut transférer ses données d’un appareil à un autre avec une sauvegarde. Les comptes et la synchronisation sont prévus pour la suite, pas disponibles aujourd’hui.',
        avoid: 'Ne pas vendre un travail en équipe ou une synchronisation téléphone / ordinateur.',
      },
      {
        id: 'l-invoice',
        category: 'limites',
        faq: true,
        question: 'Est-ce que ça fait aussi les factures ?',
        short: 'Non, pas aujourd’hui : {{produit}} fait les devis et le suivi de chantier. La facturation est prévue pour plus tard.',
        long: 'Il n’y a pas non plus d’export comptable ni de paiement en ligne pour le moment.',
        avoid: 'Ne pas annoncer de date pour la facturation.',
      },
      {
        id: 'l-remote',
        category: 'limites',
        faq: true,
        question: 'Le client peut-il signer à distance ?',
        short: 'Pas encore. Aujourd’hui, le client signe sur votre appareil, ou reçoit le devis en PDF.',
        long: 'Le lien de signature à distance fait partie des évolutions prévues.',
        avoid: 'Ne pas promettre cette fonction ni une date.',
      },
      {
        id: 'l-beta',
        category: 'limites',
        question: 'Que veut dire « version bêta » ?',
        short: 'L’application est utilisable, mais encore en cours d’amélioration : vos retours servent à la faire évoluer.',
        long: 'Certaines fonctions ne sont pas encore là : synchronisation, signature à distance, facturation, paiement en ligne.',
        avoid: 'Ne pas cacher que c’est une bêta.',
      },
      // ── Tarifs (réponses calculées à partir des formules configurées) ──
      { id: 'q-price', category: 'tarifs', faq: true, dynamic: 'price', question: 'Combien ça coûte ?', short: '', long: '', avoid: 'Ne jamais annoncer un prix qui n’est pas dans les formules configurées, ni le prix après la bêta.' },
      { id: 'q-commitment', category: 'tarifs', faq: true, dynamic: 'commitment', question: 'Est-ce qu’il y a un engagement ?', short: '', long: '', avoid: 'Ne pas improviser de conditions.' },
      { id: 'q-trial', category: 'tarifs', faq: true, dynamic: 'trial', question: 'Est-ce que je peux essayer ?', short: '', long: '', avoid: 'Ne pas promettre que l’outil restera gratuit.' },
      // ── Divers ──
      {
        id: 'q-phone',
        category: 'fonctionnalites',
        faq: true,
        question: 'Puis-je l’utiliser sur mon téléphone ?',
        short: 'Oui, l’application est conçue d’abord pour le téléphone et s’installe sur l’écran d’accueil. Elle fonctionne aussi sur ordinateur.',
        long: 'Sur iPhone : Partager → « Sur l’écran d’accueil ». Sur Android : menu → « Installer l’application ».',
        avoid: '',
      },
      {
        id: 'q-catalog',
        category: 'devis',
        faq: true,
        question: 'Puis-je utiliser mes propres prix ?',
        short: 'Oui : votre catalogue contient vos prestations, avec votre prix d’achat, votre prix de vente et votre marge.',
        long: 'Vous pouvez créer, modifier et dupliquer vos prestations, et enregistrer vos devis types comme modèles.',
        avoid: 'Ne pas parler d’import de catalogue depuis un autre logiciel : cela n’existe pas.',
      },
      {
        id: 'a-benefits',
        category: 'avantages',
        question: 'Quels sont les avantages ?',
        short: 'Un devis prêt pendant la visite, une présentation soignée, une marge connue, et un client qui peut signer sur place.',
        long: 'Moins de ressaisie le soir, moins d’oublis au métrage, et tous les devis et chantiers au même endroit.',
        avoid: 'Pas de promesse de résultat chiffré.',
      },
      {
        id: 'demo-how',
        category: 'demonstration',
        faq: true,
        question: 'Comment se passe une démonstration ?',
        short: 'Une quinzaine de minutes, par téléphone ou en visio : on crée un devis ensemble sur un exemple de chantier.',
        long: 'L’application contient aussi un espace de démonstration avec des données fictives, que le prospect peut explorer seul.',
        avoid: '',
      },
    ],
    objections: [
      {
        id: 'o-mail',
        objection: 'Envoyez-moi un mail.',
        short: 'Avec plaisir. Pour vous envoyer quelque chose d’utile : vous faites vos devis plutôt sur ordinateur ou à la main aujourd’hui ?',
        long: "Je vous envoie une présentation courte avec un aperçu de l'application. Je vous propose de vous rappeler ensuite pour répondre à vos questions : quel jour vous arrange ?",
        followUp: 'À quelle adresse puis-je vous l’envoyer, et quand puis-je vous rappeler ?',
      },
      {
        id: 'o-time',
        objection: "Je n'ai pas le temps.",
        short: 'Je comprends, je fais court : trente secondes, et vous me dites si ça vaut un rappel.',
        long: "{{produit}} sert justement à passer moins de temps sur les devis. Si ce n'est pas le moment, je vous rappelle quand vous voulez.",
        followUp: 'Quel moment de la semaine est le plus calme pour vous ?',
      },
      {
        id: 'o-nointerest',
        objection: 'Ça ne m’intéresse pas.',
        short: 'Pas de souci, je ne veux pas vous déranger. Juste par curiosité : c’est parce que votre façon de faire vos devis vous convient ?',
        long: 'Si vous avez déjà ce qu’il vous faut, je le note et je ne vous relance pas. Si le sujet revient un jour, vous saurez que l’application existe.',
        followUp: 'Souhaitez-vous que je ne vous recontacte plus ?',
      },
      {
        id: 'o-software',
        objection: 'J’ai déjà un logiciel de devis.',
        short: 'Très bien, gardez ce qui fonctionne. La différence, c’est le terrain : photos, mesures et signature chez le client, depuis le téléphone.',
        long: '{{produit}} est pensé pour le paysage et pour la visite chez le client. En revanche il ne fait pas la facturation : si votre logiciel la gère, les deux peuvent se compléter.',
        followUp: 'Pouvez-vous faire un devis directement chez le client avec votre logiciel actuel ?',
      },
      {
        id: 'o-excel',
        objection: 'Je fais mes devis sur Excel / Word, ça me va.',
        short: 'Ça fonctionne, oui. Ce que l’application ajoute : les quantités calculées depuis vos mesures, vos prix en catalogue et la signature sur place.',
        long: 'Vous gardez vos prix et vos habitudes ; vous évitez surtout la ressaisie et les calculs refaits le soir.',
        followUp: 'Combien de temps vous prend un devis aujourd’hui, du métrage à l’envoi ?',
      },
      {
        id: 'o-evening',
        objection: 'Je préfère faire mes devis au calme, le soir.',
        short: 'C’est tout à fait possible : vous pouvez prendre photos et mesures sur place, puis finir le devis plus tard. Le brouillon est enregistré.',
        long: 'L’application ne vous oblige pas à chiffrer devant le client. Elle évite surtout de recopier vos notes.',
        followUp: 'Qu’est-ce qui vous prend le plus de temps : le métrage ou la mise au propre ?',
      },
      {
        id: 'o-computer',
        objection: 'Je ne suis pas à l’aise avec l’informatique.',
        short: 'L’application est faite pour le téléphone, avec un parcours guidé étape par étape. Je peux vous montrer un devis complet en quelques minutes.',
        long: 'Un espace de démonstration permet aussi d’essayer avec des données fictives, sans rien casser.',
        followUp: 'Vous utilisez plutôt un iPhone ou un Android ?',
      },
      { id: 'o-price', objection: 'Combien ça coûte ?', dynamic: 'price', short: '', long: '', followUp: 'Voulez-vous que je vous montre l’application pour vous faire un avis ?' },
      {
        id: 'o-network',
        objection: 'Ça marche sans réseau ?',
        short: 'Oui : après une première ouverture, l’application fonctionne sans connexion.',
        long: 'Les données sont enregistrées sur l’appareil, donc un jardin mal couvert ne pose pas de problème.',
        followUp: 'Vous travaillez souvent dans des zones mal couvertes ?',
      },
      {
        id: 'o-data',
        objection: 'Et mes données, elles vont où ?',
        short: 'Elles restent sur votre appareil pendant la bêta. Vos coûts et vos marges ne sont jamais montrés au client.',
        long: 'Il n’y a pas encore de synchronisation en ligne : il faut donc télécharger une sauvegarde de temps en temps.',
        followUp: 'Est-ce un point important pour vous ?',
      },
      {
        id: 'o-invoice',
        objection: 'Est-ce que ça fait les factures ?',
        short: 'Non, pas aujourd’hui : l’application fait les devis et le suivi de chantier. La facturation est prévue pour plus tard.',
        long: 'Je préfère vous le dire clairement. Beaucoup gardent leur outil de facturation et utilisent {{produit}} pour la partie terrain et devis.',
        followUp: 'Comment faites-vous vos factures aujourd’hui ?',
      },
      {
        id: 'o-signature',
        objection: 'La signature a-t-elle une valeur ?',
        short: 'Le client accepte et signe le devis avec le doigt ; son nom, la date et l’heure sont enregistrés. C’est une validation simple, pas une signature électronique qualifiée.',
        long: 'Cela correspond à un « bon pour accord » signé sur place. Pour une signature électronique certifiée, il faut un prestataire spécialisé : ce n’est pas inclus.',
        followUp: 'Aujourd’hui, comment vos clients valident-ils vos devis ?',
      },
      {
        id: 'o-ai',
        objection: 'C’est une IA qui fait le devis ? Je n’ai pas confiance.',
        short: 'Non : c’est vous qui faites le devis. L’assistant propose des prestations, et vous choisissez d’ajouter ou d’ignorer.',
        long: 'Il n’invente aucune mesure et n’analyse pas les photos tout seul. Vous gardez la main sur chaque ligne et chaque prix.',
        followUp: 'Voulez-vous voir à quoi ressemblent ces suggestions ?',
      },
      { id: 'o-subscribe', objection: 'Je ne veux pas m’abonner.', dynamic: 'commitment', short: '', long: '', followUp: 'Qu’est-ce qui vous gêne le plus : la durée ou le budget ?' },
      {
        id: 'o-think',
        objection: 'Je vais réfléchir.',
        short: 'Bien sûr. Pour vous aider à réfléchir : qu’est-ce qui vous manque pour vous faire un avis ?',
        long: 'Je peux vous envoyer une présentation ou vous montrer l’application sur un exemple de chantier, sans engagement de votre part.',
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
      { id: 'a-time', need: 'Gagner du temps', text: 'Le devis est préparé pendant la visite : plus besoin de recopier ses notes le soir.' },
      { id: 'a-fast', need: 'Répondre plus vite au client', text: 'Le devis peut être présenté sur place, tant que le client a son projet en tête.' },
      { id: 'a-pro', need: 'Présenter un devis soigné', text: 'Un PDF à vos couleurs, avec votre logo et les photos du chantier.' },
      { id: 'a-margin', need: 'Connaître sa marge', text: 'Chaque ligne a un prix de vente et un coût : la marge du devis s’affiche, pour vous seul.' },
      { id: 'a-measure', need: 'Éviter les oublis au métrage', text: 'Les quantités du devis sont calculées à partir des mesures saisies, zones à déduire comprises.' },
      { id: 'a-sign', need: 'Faire valider sur place', text: 'Le client accepte et signe le devis avec le doigt, directement sur votre appareil.' },
      { id: 'a-follow', need: 'Suivre ses chantiers', text: 'Devis, chantiers, clients et planning sont au même endroit, avec leur statut.' },
    ],
    comparison: [
      { id: 'c-paper', method: 'Papier / carnet', strength: 'Immédiat, aucune prise en main.', limit: 'Tout est à recopier, et les anciens devis sont difficiles à retrouver.' },
      { id: 'c-sheet', method: 'Word / Excel', strength: 'Souple et connu de tous.', limit: 'Mesures et calculs ressaisis à la main, peu pratique sur un chantier.' },
      { id: 'c-generic', method: 'Logiciel de devis généraliste', strength: 'Souvent complet, avec la facturation.', limit: 'Pas toujours pensé pour le terrain ni pour les métiers du paysage.' },
      { id: 'c-product', method: '{{produit}}', strength: 'Photos, mesures, prix, devis et signature depuis le chantier.', limit: 'Version bêta : un seul appareil, pas de facturation ni de signature à distance pour le moment.' },
    ],
    emails: [
      {
        id: 'first',
        name: 'Modèle 1 — Premier contact',
        subject: 'Vos devis, directement depuis le chantier',
        body: `Bonjour {{prenom|}},

Je me permets de vous contacter car nous avons développé {{produit}}, une application conçue pour aider les paysagistes à préparer leurs devis directement chez le client.

- Photos et mesures prises sur place
- Quantités et total calculés automatiquement
- Devis en PDF à vos couleurs, que le client peut signer sur place

Seriez-vous disponible pour une courte démonstration ?

{{signature}}`,
      },
      {
        id: 'presentation',
        name: 'Modèle 2 — Présentation du SaaS',
        subject: '{{produit}} : le devis paysagiste depuis le chantier',
        body: `Bonjour {{prenom|}},

{{produit}} est une application pensée pour les entreprises de paysage comme {{entreprise}}.

Voici ce qu'elle permet de faire :

- Prendre les photos et les mesures pendant la visite
- Chiffrer avec votre propre catalogue de prestations
- Voir votre marge sur chaque devis (le client ne la voit jamais)
- Générer un devis en PDF avec votre logo
- Faire accepter et signer le devis sur votre téléphone ou votre tablette
- Suivre ensuite le chantier : planning, notes, paiements reçus

L'application fonctionne sans réseau. Elle est en version bêta, gratuite pour le moment : les données restent sur votre appareil et la facturation n'est pas encore incluse.

Je peux vous la montrer sur un exemple de chantier en une quinzaine de minutes. Quel moment vous conviendrait ?

{{signature}}`,
      },
      {
        id: 'followup',
        name: 'Modèle 3 — Relance après premier email',
        subject: 'Re : vos devis depuis le chantier',
        body: `Bonjour {{prenom|}},

Je reviens vers vous au sujet de {{produit}}. Est-ce que gagner du temps sur les devis est un sujet pour {{entreprise|votre entreprise}} en ce moment ?

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

Comme convenu, voici une présentation de {{produit}} : photos, mesures, prix et devis en PDF depuis le chantier, avec la signature du client sur place.

Je reste disponible pour une courte démonstration si vous souhaitez le voir en pratique.

{{signature}}`,
      },
      {
        id: 'demo',
        name: 'Modèle 6 — Demande de démonstration',
        subject: 'Une démonstration de {{produit}} ?',
        body: `Bonjour {{prenom|}},

Je vous propose une démonstration de {{produit}} d'une quinzaine de minutes, par téléphone ou en visio : nous créons un devis ensemble sur un exemple de chantier.

Quels jours vous conviendraient cette semaine ou la suivante ?

{{signature}}`,
      },
    ],
    messages: {
      sms: 'Bonjour {{prenom|}}, {{commercial|}} de {{produit}} : une application pour faire ses devis de paysage directement chez le client. Puis-je vous appeler quelques minutes cette semaine ?',
      whatsapp: 'Bonjour {{prenom|}}, {{commercial|}} de {{produit}}. Nous aidons les paysagistes à préparer leurs devis depuis le chantier. Souhaitez-vous que je vous envoie une courte présentation ?',
      linkedin: 'Bonjour {{prenom|}}, je développe {{produit}}, une application de devis pensée pour les paysagistes. Seriez-vous ouvert à un court échange ?',
    },
  };
}
