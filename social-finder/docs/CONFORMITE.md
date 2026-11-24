# Conformité : plateformes Meta et RGPD

## Ce que le logiciel ne fait pas (par conception)

- Aucun téléchargement de page facebook.com ou instagram.com, aucun navigateur automatisé, aucune session ou faux
  compte, aucun contournement de connexion, CAPTCHA, limite de débit ou permission.
- Aucun « scraping » de pages de résultats Google / Bing : seules des **API officielles** de recherche sont appelées.
- Aucun envoi automatique de message : l'utilisateur copie le message, ouvre le profil et l'envoie lui-même.
  Les API de messagerie Meta n'autorisent pas les premiers messages à froid (fenêtre de 24 h) ; aucune automatisation
  de ce type n'est prévue.
- Aucun résultat simulé : sans source configurée, la recherche s'arrête avec le statut « aucune source ».
  Les données de démonstration sont fictives, marquées « DÉMO » et exclues des statistiques.
- Pas de collecte d'e-mail ni de téléphone (fonction de l'autre logiciel).

## RGPD (prospection B2B en France)

| Exigence | Mise en œuvre |
|---|---|
| Stockage local | base SQLite dans `social-finder/data/`, aucun serveur tiers (hors API que vous configurez) |
| Minimisation | profils publics professionnels : nom, identifiant, bio, statistiques publiques, site |
| Traçabilité | source (moteur, API, recherche assistée) et date de découverte conservées par profil ; historique des actions |
| Opposition | fiche → Supprimer + « liste de suppression », ou Paramètres → RGPD : données effacées, entreprise jamais redécouverte (seuls identifiant et nom normalisé sont gardés) |
| Statut « Ne plus contacter » | inscrit automatiquement en liste de suppression ; génération de messages bloquée |
| Durée de conservation | paramétrable (365 jours par défaut) ; purge des fiches jamais contactées |
| Effacement total | Paramètres → RGPD → Tout supprimer (sauvegarde préalable automatique) |
| Pertinence | messages liés à l'activité professionnelle, sans affirmation non vérifiée |

Rappel : une information publique n'est pas automatiquement libre de toute réutilisation commerciale. Mentionnez
dans votre premier message qui vous êtes et respectez immédiatement toute demande d'arrêt.
