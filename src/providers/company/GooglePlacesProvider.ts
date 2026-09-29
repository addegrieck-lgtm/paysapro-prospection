// Préparé mais désactivé : Google Places est payant au-delà du quota gratuit et nécessite un proxy serveur.
export class GooglePlacesProvider {
  readonly id = 'google_places' as const;
  readonly label = 'Google Places API';
  readonly description = 'Optionnel, payant, désactivé. Nécessiterait une clé détenue par un proxy serveur. Utilisez « Rechercher sur le web » depuis chaque fiche.';
  readonly enabled = false;
  readonly free = false;
  async search(): Promise<never> {
    throw new Error('Google Places n’est pas activé (service payant optionnel).');
  }
}

export const googlePlacesProvider = new GooglePlacesProvider();
