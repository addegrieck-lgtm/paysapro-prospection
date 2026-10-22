import { continueRender, delayRender, staticFile } from 'remotion';

// Polices du site (SIL Open Font License), chargées avant le rendu de la première image.
const FACES: [string, string][] = [
  ['Josefin Sans', 'fonts/josefin-sans-latin-wght-normal.woff2'],
  ['Inter Tight', 'fonts/inter-tight-latin-wght-normal.woff2'],
];

let loaded = false;

export function loadFonts() {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  const handle = delayRender('Chargement des polices');
  Promise.all(
    FACES.map(([family, file]) => {
      const face = new FontFace(family, `url(${staticFile(file)}) format('woff2')`, { weight: '100 900' });
      (document.fonts as unknown as Set<FontFace>).add(face);
      return face.load();
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
}
