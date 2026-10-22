import voixOff from './voix-off.json';

// Timeline centralisée : durées des scènes, textes à l'écran, voix off et sous-titres.
// Toutes les valeurs sont en secondes ; la conversion en images se fait avec FPS.

export const FPS = 25;

export type SceneId = 'manifeste' | 'transformation' | 'referencement' | 'identite' | 'signature';

export type Scene = {
  id: SceneId;
  start: number;
  duration: number;
  /** Textes affichés à l'écran (le premier est le titre principal de la scène). */
  titles: string[];
};

export type Cut = {
  id: 'longue' | 'courte';
  duration: number;
  scenes: Scene[];
  /** Instants des impacts sonores et des temps forts visuels. */
  hits: number[];
};

export const LONGUE: Cut = {
  id: 'longue',
  duration: 50,
  scenes: [
    { id: 'manifeste', start: 0, duration: 7, titles: ['Votre entreprise mérite d’être vue autrement.'] },
    { id: 'transformation', start: 7, duration: 11, titles: ['Des sites qui inspirent confiance.'] },
    { id: 'referencement', start: 18, duration: 11, titles: ['Une visibilité pensée pour vous démarquer.'] },
    { id: 'identite', start: 29, duration: 10, titles: ['Une image professionnelle.', 'Une stratégie cohérente.'] },
    {
      id: 'signature',
      start: 39,
      duration: 11,
      titles: ['Donnons une nouvelle dimension à votre entreprise.', 'Parlons de votre projet.'],
    },
  ],
  hits: [2.6, 7, 18, 29, 33, 39.6, 46],
};

export const COURTE: Cut = {
  id: 'courte',
  duration: 15,
  scenes: [
    { id: 'manifeste', start: 0, duration: 3, titles: ['Votre entreprise mérite d’être vue autrement.'] },
    { id: 'transformation', start: 3, duration: 3.6, titles: ['Des sites qui inspirent confiance.'] },
    { id: 'referencement', start: 6.6, duration: 3, titles: ['Une visibilité pensée pour vous démarquer.'] },
    { id: 'identite', start: 9.6, duration: 2.4, titles: ['Une image professionnelle.'] },
    { id: 'signature', start: 12, duration: 3, titles: ['', 'Parlons de votre projet.'] },
  ],
  hits: [1.1, 3, 6.6, 9.6, 12.3],
};

/** Voix off de la version longue : texte à enregistrer et calage prévu (début, fin), dans voix-off.json. */
export const VOIX_OFF: { start: number; end: number; text: string }[] = voixOff;

export const sec = (s: number) => Math.round(s * FPS);
