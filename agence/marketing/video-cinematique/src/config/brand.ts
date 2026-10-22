// Charte et coordonnées : tout ce qu'il faut changer pour adapter la vidéo est ici et dans timeline.ts.
// Couleurs relevées sur le site (agence/public/assets/css/site.css) puis déclinées en version « nuit ».

export const BRAND = {
  name: 'Signe & Seine',
  url: 'signeetseine.fr', // adresse canonique vérifiée sur le site en ligne
  urlFull: 'https://signeetseine.fr',
  phone: '06 47 41 42 24',
  baseline: 'Création web • SEO • Identité visuelle',
  /** Affiche un petit QR code vers urlFull sur le plan final. */
  showQr: true,
};

export const COLORS = {
  // Charte du site
  seine: '#0E4A57',
  ink: '#0F2F38',
  accent: '#C2410C', // réservé à la vague du logo et à l'esperluette
  paper: '#F6F1E8',
  // Déclinaison cinéma
  night: '#020A0D',
  deep: '#061B22',
  glow: '#6FC3D3', // lumière bleutée issue du bleu Seine
  glowSoft: 'rgba(111, 195, 211, 0.35)',
  silver: '#C9D4D8',
  white: '#FFFFFF',
};

export const FONTS = {
  display: "'Josefin Sans', 'Futura', sans-serif",
  text: "'Inter Tight', 'Inter', system-ui, sans-serif",
};
