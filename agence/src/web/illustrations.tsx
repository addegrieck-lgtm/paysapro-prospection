/**
 * Maquettes vectorielles originales (créées pour ce projet : aucune licence tierce).
 * Les noms qui y figurent sont ceux de concepts FICTIFS de démonstration.
 */

const SERIF = 'Fraunces, Georgia, serif';
const SANS = 'Inter Tight, system-ui, sans-serif';

type P = { accent?: string; title?: string; class?: string };

function Bars({ x, y, w, n = 3, gap = 9, h = 4, fill = '#D9D3C7', last = 0.6 }: { x: number; y: number; w: number; n?: number; gap?: number; h?: number; fill?: string; last?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <rect x={x} y={y + i * gap} width={i === n - 1 ? w * last : w} height={h} rx={h / 2} fill={fill} />
      ))}
    </g>
  );
}

/** Fenêtre de navigateur contenant une page de site. */
export function BrowserMock({ accent = '#8A5A3B', title = 'Atelier Chêne & Fil', variant = 'artisan', class: cls }: P & { variant?: 'artisan' | 'sante' | 'agence' }) {
  const dark = variant === 'sante' ? '#1E3A33' : variant === 'agence' ? '#16161A' : '#2A211C';
  return (
    <svg class={`mock ${cls ?? ''}`} viewBox="0 0 560 380" role="img" aria-label={`Maquette de site internet — ${title}`}>
      <g class="paper">
        <rect x="0" y="0" width="560" height="380" rx="14" fill="#fff" />
      </g>
      <rect x="0" y="0" width="560" height="34" rx="14" fill="#F1EEE8" />
      <rect x="0" y="20" width="560" height="14" fill="#F1EEE8" />
      <circle cx="20" cy="17" r="5" fill="#E4685D" />
      <circle cx="37" cy="17" r="5" fill="#E9B949" />
      <circle cx="54" cy="17" r="5" fill="#69B36B" />
      <rect x="150" y="9" width="260" height="16" rx="8" fill="#fff" />
      <text x="280" y="21" text-anchor="middle" font-family={SANS} font-size="9" fill="#8B867D">
        {title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, 'et').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}.fr
      </text>
      {/* barre de navigation */}
      <text x="28" y="62" font-family={SERIF} font-size="15" font-weight="600" fill={dark}>{title}</text>
      <Bars x={300} y={56} w={34} n={1} />
      <rect x="344" y="56" width="34" height="4" rx="2" fill="#D9D3C7" />
      <rect x="388" y="56" width="34" height="4" rx="2" fill="#D9D3C7" />
      <rect x="452" y="47" width="82" height="22" rx="11" fill={accent} />
      <text x="493" y="62" text-anchor="middle" font-family={SANS} font-size="9" font-weight="600" fill="#fff">Demander un devis</text>
      {/* héros */}
      <rect x="28" y="88" width="504" height="150" rx="10" fill={dark} />
      {variant === 'artisan' ? (
        <g>
          <rect x="300" y="88" width="232" height="150" fill="#6B4A35" />
          {Array.from({ length: 9 }, (_, i) => (
            <path d={`M${300 + i * 26} 88 q 12 75 0 150`} stroke="#7D5840" stroke-width="10" fill="none" />
          ))}
          <rect x="356" y="128" width="120" height="70" rx="4" fill="#C9A27E" />
          <rect x="364" y="136" width="50" height="54" rx="2" fill="#B88D66" />
          <rect x="420" y="136" width="48" height="54" rx="2" fill="#B88D66" />
        </g>
      ) : variant === 'sante' ? (
        <g>
          <circle cx="430" cy="165" r="70" fill="#2D6A4F" />
          <circle cx="430" cy="165" r="44" fill="#40916C" />
          <path d="M405 168c10-18 40-18 50 0" stroke="#D8F3DC" stroke-width="6" fill="none" stroke-linecap="round" />
        </g>
      ) : (
        <g>
          <rect x="330" y="112" width="170" height="104" rx="8" fill="#26262C" />
          <rect x="344" y="126" width="80" height="8" rx="4" fill={accent} />
          <Bars x={344} y={146} w={130} n={4} fill="#3A3A42" />
        </g>
      )}
      <text x="50" y="135" font-family={SERIF} font-size="22" fill="#fff">
        {variant === 'sante' ? 'Votre santé,' : variant === 'agence' ? 'Votre entreprise,' : 'Le bois, travaillé'}
      </text>
      <text x="50" y="161" font-family={SERIF} font-size="22" font-style="italic" fill="#fff">
        {variant === 'sante' ? 'en mouvement.' : variant === 'agence' ? 'enfin visible.' : 'sur mesure.'}
      </text>
      <Bars x={50} y={180} w={170} n={2} fill="rgba(255,255,255,.35)" />
      <rect x="50" y="204" width="92" height="20" rx="10" fill={accent} />
      {/* cartes */}
      {[0, 1, 2].map((i) => (
        <g>
          <rect x={28 + i * 172} y="256" width="160" height="104" rx="10" fill="#F7F5F0" />
          <rect x={40 + i * 172} y="268" width="40" height="28" rx="6" fill={i === 1 ? accent : '#E6DFD3'} />
          <rect x={40 + i * 172} y="308" width="96" height="6" rx="3" fill="#2B2B2B" opacity=".75" />
          <Bars x={40 + i * 172} y={322} w={120} n={3} gap={8} h={3.5} />
        </g>
      ))}
    </svg>
  );
}

/** Flyer A5 (portrait). */
export function FlyerMock({ accent = '#B4436C', title = 'Studio Mèche', class: cls, x = 0, y = 0 }: P & { x?: number; y?: number }) {
  return (
    <g class={cls} transform={`translate(${x} ${y})`}>
      <g class="paper">
        <rect width="210" height="296" rx="3" fill="#FFFDF9" />
      </g>
      <rect width="210" height="150" rx="3" fill={accent} />
      <rect y="140" width="210" height="10" fill={accent} />
      <circle cx="160" cy="70" r="58" fill="#fff" opacity=".12" />
      <circle cx="160" cy="70" r="34" fill="#fff" opacity=".14" />
      <text x="20" y="38" font-family={SANS} font-size="9" letter-spacing="2" fill="#fff" opacity=".85">OUVERTURE</text>
      <text x="20" y="84" font-family={SERIF} font-size="30" fill="#fff">{title.split(' ')[0]}</text>
      <text x="20" y="116" font-family={SERIF} font-size="30" font-style="italic" fill="#fff">{title.split(' ').slice(1).join(' ') || 'Studio'}</text>
      <text x="20" y="182" font-family={SERIF} font-size="15" fill="#1D1B19">-20 % sur votre</text>
      <text x="20" y="200" font-family={SERIF} font-size="15" fill="#1D1B19">première visite</text>
      <Bars x={20} y={218} w={150} n={3} gap={9} h={4} />
      <rect x="20" y="256" width="86" height="22" rx="11" fill="#1D1B19" />
      <text x="63" y="270" text-anchor="middle" font-family={SANS} font-size="8" font-weight="600" fill="#fff">Prendre RDV</text>
      <rect x="150" y="248" width="40" height="40" rx="3" fill="#1D1B19" opacity=".9" />
      {[0, 1, 2, 3].map((i) => (
        <rect x={155 + (i % 2) * 16} y={253 + Math.floor(i / 2) * 16} width="12" height="12" fill="#fff" />
      ))}
    </g>
  );
}

/** Carte de visite 85 × 55 (échelle ×2,2). */
export function CardMock({ accent = '#B4436C', title = 'Studio Mèche', name = 'Camille Arnaud', x = 0, y = 0, back = false, rotate = 0, premium = false }: P & { name?: string; x?: number; y?: number; back?: boolean; rotate?: number; premium?: boolean }) {
  const bg = premium ? '#1B1B1F' : back ? accent : '#FFFDF9';
  const ink = premium || back ? '#fff' : '#1D1B19';
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <g class="paper">
        <rect width="187" height="121" rx="5" fill={bg} />
      </g>
      {back ? (
        <text x="93" y="68" text-anchor="middle" font-family={SERIF} font-size="18" font-style="italic" fill={ink}>{title}</text>
      ) : (
        <g>
          <rect x="16" y="16" width="26" height="26" rx="7" fill={premium ? 'none' : accent} stroke={premium ? '#D4AF37' : 'none'} stroke-width="1.5" />
          <text x="29" y="34" text-anchor="middle" font-family={SERIF} font-size="12" fill={premium ? '#D4AF37' : '#fff'}>{title[0]}</text>
          <text x="16" y="72" font-family={SERIF} font-size="13" fill={premium ? '#D4AF37' : ink}>{name}</text>
          <text x="16" y="86" font-family={SANS} font-size="7" fill={ink} opacity=".7">{title}</text>
          <Bars x={16} y={96} w={80} n={2} gap={7} h={2.6} fill={premium ? '#55555E' : '#D9D3C7'} />
        </g>
      )}
    </g>
  );
}

export function PrintComposition({ accent = '#B4436C', title = 'Studio Mèche' }: P) {
  return (
    <svg class="mock" viewBox="0 0 520 400" role="img" aria-label={`Maquette d’un flyer et de cartes de visite — ${title}`}>
      <rect width="520" height="400" rx="18" fill="#EDE7DD" />
      <FlyerMock accent={accent} title={title} x={52} y={52} />
      <CardMock accent={accent} title={title} x={290} y={92} rotate={-6} back />
      <CardMock accent={accent} title={title} x={300} y={220} rotate={4} />
    </svg>
  );
}

/** Planche d'identité visuelle. */
export function IdentityBoard({ accent = '#2F4858', title = 'Les Pages Lentes' }: P) {
  const palette = [accent, '#E9C46A', '#F4EDE2', '#1D1B19'];
  return (
    <svg class="mock" viewBox="0 0 520 400" role="img" aria-label={`Planche d’identité visuelle — ${title}`}>
      <rect width="520" height="400" rx="18" fill="#F4EDE2" />
      <g class="paper">
        <rect x="36" y="36" width="270" height="200" rx="10" fill="#fff" />
      </g>
      <g transform="translate(171 112)">
        <path d="M-46 -10 q46 -26 46 0 q0 -26 46 0 v46 q-46 -20 -46 6 q0 -26 -46 -6z" fill="none" stroke={accent} stroke-width="5" stroke-linejoin="round" />
        <path d="M0 -10 v52" stroke={accent} stroke-width="4" />
        <path d="M-10 -32 q6 -10 0 -18 M10 -32 q6 -10 0 -18" stroke="#E9C46A" stroke-width="3.5" fill="none" stroke-linecap="round" />
      </g>
      <text x="171" y="196" text-anchor="middle" font-family={SERIF} font-size="22" fill="#1D1B19">{title}</text>
      <text x="171" y="214" text-anchor="middle" font-family={SANS} font-size="8" letter-spacing="3" fill="#6B665E">CAFÉ · LIBRAIRIE</text>
      {palette.map((c, i) => (
        <g>
          <rect x={330} y={36 + i * 52} width="154" height="44" rx="8" fill={c} stroke="#E4DDD0" />
          <text x={344} y={63 + i * 52} font-family={SANS} font-size="9" fill={i === 2 ? '#1D1B19' : '#fff'}>{c.toUpperCase()}</text>
        </g>
      ))}
      <g class="paper">
        <rect x="36" y="258" width="130" height="106" rx="10" fill={accent} />
      </g>
      <text x="101" y="318" text-anchor="middle" font-family={SERIF} font-size="34" font-style="italic" fill="#F4EDE2">Aa</text>
      <g class="paper">
        <rect x="182" y="258" width="124" height="106" rx="10" fill="#fff" />
      </g>
      <circle cx="244" cy="311" r="34" fill="none" stroke={accent} stroke-width="3" />
      <text x="244" y="316" text-anchor="middle" font-family={SERIF} font-size="13" fill={accent}>PL</text>
      <g class="paper">
        <rect x="330" y="258" width="154" height="106" rx="10" fill="#1D1B19" />
      </g>
      <text x="407" y="306" text-anchor="middle" font-family={SERIF} font-size="15" fill="#F4EDE2">Carte de fidélité</text>
      {[0, 1, 2, 3, 4].map((i) => (
        <circle cx={367 + i * 20} cy="330" r="6" fill="none" stroke="#E9C46A" stroke-width="1.5" />
      ))}
    </svg>
  );
}

/** Téléphone avec publications réseaux sociaux. */
export function SocialMock({ accent = '#C2410C', title = 'Le Comptoir du Marché' }: P) {
  return (
    <svg class="mock" viewBox="0 0 520 400" role="img" aria-label={`Maquette de publications réseaux sociaux — ${title}`}>
      <rect width="520" height="400" rx="18" fill="#F3E9E1" />
      <g class="paper">
        <rect x="70" y="28" width="190" height="350" rx="28" fill="#16161A" />
      </g>
      <rect x="80" y="40" width="170" height="326" rx="20" fill="#fff" />
      <circle cx="102" cy="64" r="11" fill={accent} />
      <text x="120" y="68" font-family={SANS} font-size="9" font-weight="600" fill="#16161A">comptoirdumarche</text>
      <rect x="80" y="84" width="170" height="170" fill={accent} />
      <circle cx="165" cy="150" r="46" fill="#F7E3D5" />
      <circle cx="165" cy="150" r="30" fill="#E9B949" />
      <text x="96" y="226" font-family={SERIF} font-size="18" fill="#fff">Menu du jour</text>
      <text x="96" y="244" font-family={SANS} font-size="8" fill="#fff" opacity=".85">Mardi · produits du marché</text>
      <Bars x={92} y={270} w={140} n={3} gap={10} h={4} />
      {[0, 1].map((i) => (
        <g>
          <g class="paper">
            <rect x={292} y={40 + i * 170} width="160" height="150" rx="12" fill={i ? '#16161A' : '#fff'} />
          </g>
          <rect x={304} y={52 + i * 170} width="136" height="80" rx="8" fill={i ? accent : '#F3E9E1'} />
          <text x={304} y={152 + i * 170} font-family={SERIF} font-size="14" fill={i ? '#fff' : '#16161A'}>{i ? 'Soirée jazz' : 'En coulisses'}</text>
          <Bars x={304} y={162 + i * 170} w={110} n={2} gap={8} h={3.5} fill={i ? '#3A3A42' : '#D9D3C7'} />
        </g>
      ))}
    </svg>
  );
}

/** Brochure ouverte. */
export function BrochureMock({ accent = '#4D7C0F', title = 'Gîte des Trois Sources' }: P) {
  return (
    <svg class="mock" viewBox="0 0 520 400" role="img" aria-label={`Maquette de brochure — ${title}`}>
      <rect width="520" height="400" rx="18" fill="#ECEFE4" />
      <g class="paper">
        <path d="M40 70 L258 80 L258 350 L40 340Z" fill="#fff" />
        <path d="M262 80 L480 70 L480 340 L262 350Z" fill="#FFFDF7" />
      </g>
      <path d="M58 92 L240 100 L240 210 L58 202Z" fill={accent} />
      <path d="M90 190 q40 -60 80 -20 q30 -40 70 10 v20 H58z" fill="#3F6212" opacity=".85" />
      <circle cx="200" cy="130" r="14" fill="#FDE68A" />
      <text x="62" y="240" font-family={SERIF} font-size="18" fill="#1D2B12">{title.split(' ').slice(0, 2).join(' ')}</text>
      <text x="62" y="260" font-family={SERIF} font-size="18" font-style="italic" fill="#1D2B12">{title.split(' ').slice(2).join(' ')}</text>
      <Bars x={62} y={278} w={160} n={4} gap={10} h={4} />
      <text x="282" y="110" font-family={SANS} font-size="8" letter-spacing="2" fill={accent}>LES CHAMBRES</text>
      {[0, 1].map((i) => (
        <g>
          <rect x={282} y={124 + i * 104} width="84" height="84" rx="6" fill={i ? '#D9E4C7' : '#C7D6AE'} />
          <rect x={378} y={128 + i * 104} width="80" height="6" rx="3" fill="#1D2B12" opacity=".75" />
          <Bars x={378} y={144 + i * 104} w={84} n={4} gap={9} h={3.5} />
        </g>
      ))}
    </svg>
  );
}

// ─── Visuels du catalogue d'impression (format carte 4:3) ───

function Stage({ children, label, bg = '#EEE9E1' }: { children: unknown; label: string; bg?: string }) {
  return (
    <svg class="mock" viewBox="0 0 400 300" role="img" aria-label={label}>
      <rect width="400" height="300" rx="16" fill={bg} />
      {children}
    </svg>
  );
}

export function ProductVisual({ visual, accent = '#C2410C' }: { visual: string; accent?: string }) {
  switch (visual) {
    case 'flyer':
      return (
        <Stage label="Flyers">
          <g transform="translate(60 26) rotate(-5) scale(.8)">
            <FlyerMock accent="#1F3A34" title="Marché Bio" />
          </g>
          <g transform="translate(190 34) rotate(4) scale(.8)">
            <FlyerMock accent={accent} title="Portes Ouvertes" />
          </g>
        </Stage>
      );
    case 'cartes':
    case 'cartes-premium': {
      const premium = visual === 'cartes-premium';
      return (
        <Stage label={premium ? 'Cartes de visite premium' : 'Cartes de visite'} bg={premium ? '#E7E2DA' : '#EEE9E1'}>
          <CardMock accent={accent} title="Maison Valère" name="Léa Valère" x={46} y={70} rotate={-8} premium={premium} />
          <CardMock accent={premium ? '#1B1B1F' : accent} title="Maison Valère" x={176} y={118} rotate={5} back={!premium} premium={premium} />
        </Stage>
      );
    }
    case 'depliant':
      return (
        <Stage label="Dépliants">
          <g class="paper">
            <path d="M70 70 L150 60 L150 240 L70 250Z" fill="#fff" />
            <path d="M150 60 L235 72 L235 252 L150 240Z" fill="#F7F3EC" />
            <path d="M235 72 L320 62 L320 242 L235 252Z" fill="#fff" />
          </g>
          <path d="M78 80 L142 72 L142 140 L78 148Z" fill={accent} />
          <Bars x={160} y={96} w={64} n={6} gap={10} h={4} />
          <rect x="246" y="90" width="64" height="50" rx="4" fill="#E5DCCD" />
          <Bars x={246} y={154} w={64} n={4} gap={10} h={4} />
          <Bars x={82} y={168} w={56} n={4} gap={10} h={4} />
        </Stage>
      );
    case 'affiche':
      return (
        <Stage label="Affiches">
          <g class="paper">
            <rect x="120" y="22" width="170" height="240" rx="2" fill="#1D1B19" />
          </g>
          <circle cx="205" cy="110" r="56" fill={accent} />
          <circle cx="205" cy="110" r="30" fill="#F2C14E" />
          <text x="205" y="200" text-anchor="middle" font-family={SERIF} font-size="24" fill="#fff">Festival</text>
          <text x="205" y="222" text-anchor="middle" font-family={SERIF} font-size="16" font-style="italic" fill="#fff">d’automne</text>
          <Bars x={150} y={236} w={110} n={1} fill="#55555E" />
        </Stage>
      );
    case 'brochure':
      return (
        <Stage label="Brochures">
          <g class="paper">
            <rect x="96" y="40" width="150" height="212" rx="3" fill="#fff" />
          </g>
          <g class="paper">
            <rect x="160" y="30" width="150" height="212" rx="3" fill="#1F3A34" />
          </g>
          <rect x="176" y="48" width="118" height="100" rx="3" fill={accent} />
          <text x="176" y="180" font-family={SERIF} font-size="18" fill="#fff">Catalogue</text>
          <text x="176" y="200" font-family={SERIF} font-size="18" font-style="italic" fill="#fff">2027</text>
          <Bars x={176} y={214} w={90} n={2} gap={8} h={3.5} fill="#3B5A52" />
        </Stage>
      );
    case 'rollup':
      return (
        <Stage label="Roll-up">
          <rect x="196" y="20" width="8" height="250" fill="#B9B3A9" />
          <g class="paper">
            <rect x="140" y="22" width="120" height="240" rx="2" fill="#fff" />
          </g>
          <rect x="140" y="22" width="120" height="110" fill={accent} />
          <text x="200" y="86" text-anchor="middle" font-family={SERIF} font-size="18" fill="#fff">Votre stand</text>
          <Bars x={156} y={150} w={88} n={5} gap={12} h={5} />
          <rect x="128" y="262" width="144" height="12" rx="4" fill="#8E887E" />
        </Stage>
      );
    case 'etiquettes':
      return (
        <Stage label="Étiquettes">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g>
              <circle cx={90 + (i % 3) * 110} cy={100 + Math.floor(i / 3) * 104} r="42" fill="#fff" class="paper" />
              <circle cx={90 + (i % 3) * 110} cy={100 + Math.floor(i / 3) * 104} r="34" fill="none" stroke={accent} stroke-width="2" />
              <text x={90 + (i % 3) * 110} y={105 + Math.floor(i / 3) * 104} text-anchor="middle" font-family={SERIF} font-size="13" fill="#1D1B19">Miel</text>
            </g>
          ))}
        </Stage>
      );
    case 'stickers':
      return (
        <Stage label="Autocollants">
          <g class="paper">
            <circle cx="140" cy="130" r="64" fill={accent} />
          </g>
          <text x="140" y="138" text-anchor="middle" font-family={SERIF} font-size="22" font-style="italic" fill="#fff">Merci !</text>
          <g class="paper">
            <rect x="220" y="96" width="120" height="120" rx="22" fill="#1F3A34" />
          </g>
          <path d="M250 170 l20 -40 l20 40z" fill="#F2C14E" />
          <circle cx="300" cy="140" r="12" fill="#fff" />
        </Stage>
      );
    case 'bache':
      return (
        <Stage label="Bâches et banderoles">
          <rect x="30" y="90" width="340" height="6" fill="#8E887E" />
          <rect x="30" y="226" width="340" height="6" fill="#8E887E" />
          <g class="paper">
            <rect x="40" y="96" width="320" height="130" fill={accent} />
          </g>
          {[0, 1, 2, 3].map((i) => (
            <circle cx={52 + i * 98.7} cy="106" r="4" fill="#fff" opacity=".8" />
          ))}
          <text x="200" y="166" text-anchor="middle" font-family={SERIF} font-size="30" fill="#fff">Grande ouverture</text>
          <text x="200" y="196" text-anchor="middle" font-family={SANS} font-size="11" letter-spacing="3" fill="#fff" opacity=".85">SAMEDI 10 H</text>
        </Stage>
      );
    default:
      return <Stage label="Support imprimé">{null}</Stage>;
  }
}

/** Visuel d'une réalisation du portfolio. */
export function PortfolioVisual({ visual, accent, title }: { visual: string; accent: string; title: string }) {
  switch (visual) {
    case 'site-menuisier':
      return <BrowserMock accent={accent} title={title} variant="artisan" />;
    case 'site-sante':
      return <BrowserMock accent={accent} title={title} variant="sante" />;
    case 'identite-cafe':
      return <IdentityBoard accent={accent} title={title} />;
    case 'print-salon':
      return <PrintComposition accent={accent} title={title} />;
    case 'social-resto':
      return <SocialMock accent={accent} title={title} />;
    case 'brochure-gite':
      return <BrochureMock accent={accent} title={title} />;
    default:
      return <BrowserMock accent={accent} title={title} variant="agence" />;
  }
}

/** Composition de la page d'accueil : site + flyer + carte. */
export function HeroComposition({ accent }: { accent: string }) {
  return (
    <div class="hero-visual" aria-hidden="true">
      <div class="hv-browser">
        <BrowserMock accent={accent} title="Atelier Chêne & Fil" variant="artisan" />
      </div>
      <div class="hv-flyer">
        <StorefrontMock accent={accent} />
      </div>
      <div class="hv-card">
        <svg class="mock" viewBox="-6 -6 199 133">
          <CardMock accent={accent} title="Studio Mèche" />
        </svg>
      </div>
    </div>
  );
}

/** Devanture avec vitrophanie (commerce fictif). */
export function StorefrontMock({ accent = '#C2410C' }: { accent?: string }) {
  const stripes = Array.from({ length: 8 }, (_, i) => i);
  return (
    <svg class="mock" viewBox="0 0 220 250" role="img" aria-label="Illustration d’une vitrine de commerce habillée en vitrophanie">
      <rect x="4" y="18" width="212" height="228" rx="6" fill="#0E4A57" />
      <rect x="4" y="18" width="212" height="34" rx="6" fill="#0B3C47" />
      <text x="110" y="41" text-anchor="middle" font-family="Josefin Sans, sans-serif" font-weight="600" font-size="15" letter-spacing="3" fill="#fff">
        FOURNIL DU CAUX
      </text>
      {stripes.map((i) => (
        <path d={`M${4 + i * 26.5} 52h26.5l-3 22h-20.5z`} fill={i % 2 ? '#F6F1E8' : accent} />
      ))}
      <rect x="18" y="86" width="122" height="146" rx="3" fill="#BFD3D6" />
      <path d="M18 160 L80 86 H104 L18 190Z" fill="#fff" opacity=".28" />
      <text x="79" y="128" text-anchor="middle" font-family="Josefin Sans, sans-serif" font-weight="600" font-size="12" letter-spacing="1.2" fill="#fff">
        PAINS &amp;
      </text>
      <text x="79" y="146" text-anchor="middle" font-family="Josefin Sans, sans-serif" font-weight="600" font-size="11" letter-spacing="0.8" fill="#fff">
        VIENNOISERIES
      </text>
      <path d="M44 160c11.7-5 23.3-5 35 0s23.3 5 35 0" stroke={accent} stroke-width="3" fill="none" stroke-linecap="round" />
      <text x="79" y="214" text-anchor="middle" font-family="Inter Tight, sans-serif" font-size="8.5" fill="#0E4A57">
        Mar.–Dim. · 7 h – 19 h 30
      </text>
      <rect x="152" y="86" width="50" height="146" rx="3" fill="#A9C2C6" />
      <path d="M152 140 L190 86 H202 L152 170Z" fill="#fff" opacity=".25" />
      <circle cx="194" cy="162" r="2.6" fill="#F6F1E8" />
      <text x="177" y="112" text-anchor="middle" font-family="Inter Tight, sans-serif" font-weight="600" font-size="8" fill="#0E4A57">
        OUVERT
      </text>
    </svg>
  );
}

/** Panorama de falaises et de vagues (signature visuelle de la marque). */
export function CoastLine() {
  return (
    <svg class="coastline" viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path
        d="M0 160V70Q90 58 190 66L330 78Q380 84 392 104V160H360Q360 120 330 120Q300 120 300 160H250V120Q240 92 200 90L130 88Q60 86 0 96Z"
        fill="currentColor"
        opacity=".14"
      />
      <path d="M430 160L444 92L458 160Z" fill="currentColor" opacity=".14" />
      <path
        d="M1440 160V52Q1350 44 1250 54L1130 68Q1080 76 1068 100V160H1100Q1100 126 1126 126Q1152 126 1152 160Z"
        fill="currentColor"
        opacity=".14"
      />
      <path d="M1010 160L1022 104L1034 160Z" fill="currentColor" opacity=".14" />
      <path
        d="M0 142c40-12 80-12 120 0s80 12 120 0 80-12 120 0 80 12 120 0 80-12 120 0 80 12 120 0 80-12 120 0 80 12 120 0 80-12 120 0 80 12 120 0 80-12 120 0 80 12 120 0"
        stroke="var(--accent)"
        stroke-width="2.5"
        fill="none"
        opacity=".55"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Résultat de recherche locale (illustratif, noms fictifs). */
export function SeoMock({ accent = '#C2410C', name = 'Votre entreprise' }: P & { name?: string }) {
  // Exemple générique : n'affirme pas que l'agence apparaît déjà dans les résultats.
  return (
    <svg class="mock" viewBox="0 0 520 400" role="img" aria-label="Illustration d’une page de résultats de recherche locale">
      <rect width="520" height="400" rx="18" fill="#EEF0EA" />
      <g class="paper">
        <rect x="34" y="34" width="452" height="332" rx="14" fill="#fff" />
      </g>
      <rect x="58" y="56" width="300" height="30" rx="15" fill="#F2F1EE" stroke="#E2DED6" />
      <text x="76" y="76" font-family={SANS} font-size="11" fill="#5E5B57">création site internet près de chez moi</text>
      <circle cx="338" cy="71" r="7" fill="none" stroke={accent} stroke-width="2" />
      {/* carte locale */}
      <rect x="58" y="104" width="404" height="96" rx="10" fill="#E8EEE6" />
      {[[120, 140], [230, 128], [330, 160]].map(([x, y], i) => (
        <g>
          <path d={`M${x} ${y! + 14} c-8 -10 -12 -16 -12 -22 a12 12 0 0 1 24 0 c0 6 -4 12 -12 22z`} fill={i === 1 ? accent : '#9AA79A'} />
          <circle cx={x} cy={y! - 8} r="4" fill="#fff" />
        </g>
      ))}
      <path d="M58 170 q120 -40 220 0 t184 -10" stroke="#fff" stroke-width="8" fill="none" />
      {/* résultat principal */}
      <rect x="58" y="214" width="404" height="62" rx="10" fill="#fff" stroke={accent} stroke-width="1.5" />
      <text x="74" y="238" font-family={SERIF} font-size="14" fill="#16161A">{name}</text>
      <text x="74" y="256" font-family={SANS} font-size="9.5" fill="#5E5B57">Votre métier · Votre ville · Ouvert</text>
      <rect x="380" y="232" width="66" height="24" rx="12" fill={accent} />
      <text x="413" y="248" text-anchor="middle" font-family={SANS} font-size="9" font-weight="600" fill="#fff">Site web</text>
      {[0, 1].map((i) => (
        <g>
          <rect x="58" y={290 + i * 36} width="404" height="28" rx="8" fill="#F7F6F3" />
          <rect x="74" y={300 + i * 36} width={180 - i * 40} height="5" rx="2.5" fill="#CFCAC1" />
          <rect x="74" y={310 + i * 36} width={120} height="4" rx="2" fill="#E2DED6" />
        </g>
      ))}
    </svg>
  );
}

/** Tableau de bord de maintenance (illustratif). */
export function MaintenanceMock({ accent = '#C2410C' }: P) {
  const bars = [62, 70, 66, 74, 80, 78, 84, 82, 88, 86, 90, 92];
  return (
    <svg class="mock" viewBox="0 0 520 400" role="img" aria-label="Illustration d’un tableau de bord de maintenance">
      <rect width="520" height="400" rx="18" fill="#ECEEF1" />
      <g class="paper">
        <rect x="34" y="34" width="452" height="332" rx="14" fill="#fff" />
      </g>
      <text x="58" y="70" font-family={SERIF} font-size="18" fill="#16161A">État du site</text>
      {[['Disponibilité', 'En ligne'], ['Dernière sauvegarde', 'Cette nuit'], ['Mises à jour', 'À jour']].map(([k, v], i) => (
        <g>
          <rect x={58 + i * 140} y="88" width="128" height="70" rx="10" fill="#F7F6F3" />
          <circle cx={74 + i * 140} cy="110" r="5" fill="#3F9D63" />
          <text x={86 + i * 140} y="114" font-family={SANS} font-size="9" fill="#5E5B57">{k}</text>
          <text x={70 + i * 140} y="140" font-family={SERIF} font-size="15" fill="#16161A">{v}</text>
        </g>
      ))}
      <text x="58" y="194" font-family={SANS} font-size="10" fill="#5E5B57">Vitesse de chargement (score)</text>
      {bars.map((h, i) => (
        <rect x={58 + i * 34} y={340 - h * 1.4} width="22" height={h * 1.4} rx="4" fill={i === bars.length - 1 ? accent : '#D9D3C7'} />
      ))}
    </svg>
  );
}
