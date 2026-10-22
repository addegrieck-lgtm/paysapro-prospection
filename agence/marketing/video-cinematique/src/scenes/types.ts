export type SceneProps = {
  /** Durée de la scène en secondes (les animations s'y adaptent). */
  duration: number;
  /** Textes à l'écran, définis dans config/timeline.ts. */
  titles: string[];
};
