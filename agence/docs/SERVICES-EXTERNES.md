# Services externes à configurer

Rien n’est payant par défaut. Les montants ci-dessous sont indicatifs (octobre 2026) : vérifiez les grilles tarifaires officielles
avant de vous engager.

| Service | Rôle | Obligatoire ? | Coût indicatif | Où le configurer |
|---|---|---|---|---|
| Nom de domaine (.fr) | Adresse du site et des e-mails | Oui, pour une agence crédible | ~10 à 15 € HT/an | Registrar (OVHcloud, Gandi, Cloudflare Registrar…) |
| Hébergement | Faire tourner le site | Oui | 0 € (Cloudflare, offre gratuite) ou ~4-7 € HT/mois (VPS) | [DEPLOIEMENT.md](DEPLOIEMENT.md) |
| E-mails transactionnels | Accusés de réception, devis, BAT, recette, notifications | Fortement recommandé (sinon mode simulation) | Brevo : gratuit jusqu’à 300 e-mails/jour ; Resend : gratuit jusqu’à 3 000/mois | Variables `MAIL_PROVIDER`, `BREVO_API_KEY` ou `RESEND_API_KEY`, `MAIL_FROM` |
| Boîte e-mail professionnelle | Recevoir les réponses (`contact@…`) | Recommandé | souvent incluse avec le domaine, sinon ~1-6 €/mois | Registrar ou fournisseur de messagerie |
| Mesure d’audience | Statistiques de visite | Facultatif | Plausible : payant (sans cookie, pas de bandeau) ; Google Analytics : gratuit (bandeau de consentement affiché automatiquement) | *Administration → Paramètres* |
| Google Search Console | Suivi de l’indexation | Recommandé | gratuit | Ajouter la propriété, coller le code de vérification dans *Paramètres*, déclarer `/sitemap.xml` |
| Fiche d’établissement Google | Visibilité locale | Recommandé si vous recevez des clients | gratuit | business.google.com (n’indiquez qu’une adresse réelle) |
| Plateforme de facturation électronique agréée | Réception (obligatoire depuis le 01/09/2026) et émission (TPE/PME : 01/09/2027) des factures électroniques | **Oui, selon le calendrier légal** | variable selon la plateforme | À choisir avec votre expert-comptable ; ce logiciel produit des factures PDF imprimables, pas de factures électroniques structurées |
| Imprimeur (HelloPrint) | Fabrication des supports | Oui pour l’impression | prix fournisseur | Compte professionnel HelloPrint ; **aucune API n’est utilisée** (non confirmée) : les prix sont saisis et vérifiés à la main, les commandes passées manuellement |
| Expert-comptable / juriste | Relecture CGV, mentions, régime de TVA | Recommandé | variable | — |

## E-mails : configuration Brevo (exemple)

1. Créez un compte sur brevo.com, puis *Expéditeurs et domaines* : ajoutez et **authentifiez votre domaine** (enregistrements DNS
   SPF/DKIM/DMARC fournis par Brevo). Sans authentification, vos e-mails risquent d’arriver en indésirables.
2. *SMTP & API → Clés API* : créez une clé, puis renseignez `MAIL_PROVIDER=brevo`, `BREVO_API_KEY=…`, `MAIL_FROM=contact@votre-domaine.fr`.
3. Redémarrez / redéployez, envoyez une demande de test depuis le formulaire de devis et vérifiez *Administration → E-mails envoyés*.

Seuls des e-mails **transactionnels** sont envoyés. Pour une newsletter, utilisez un outil dédié et uniquement avec les contacts
ayant coché le consentement (colonne « Consentement prospection » de l’export CSV).

## Ce qui n’est volontairement pas branché

- **Paiement en ligne** : aucun prélèvement n’est réalisé ; les factures sont réglées par virement. Un service de paiement
  (Stripe, SumUp, GoCardless…) ne doit être ajouté qu’avec un parcours de confirmation explicite.
- **Commande automatique chez l’imprimeur** : aucune API HelloPrint confirmée ; les commandes sont passées manuellement, puis leur
  référence réelle est saisie (le statut « Commande fournisseur passée » l’exige).
- **Signature électronique** : l’acceptation en ligne (nom + case « bon pour accord », horodatée) suffit pour la plupart des devis ;
  pour des montants importants, un service de signature qualifiée peut être utilisé en complément.
