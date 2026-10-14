// Peekaboo covers, drawn inline with the design tokens (no image files). Each
// cover is split into the parts that move when it opens; the motion lives in
// app.css (.cover--<type> .cover-part--<name>).
const svg = { 'aria-hidden': 'true' as const, focusable: 'false' as const, preserveAspectRatio: 'none' };

export type CoverType = 'bush' | 'door' | 'cloud' | 'blanket';
export const COVER_TYPES: CoverType[] = ['bush', 'door', 'cloud', 'blanket'];

// One half of the bush, drawn for the left; the right half mirrors it.
// It reaches 20 units past the middle so the two halves overlap.
const BushHalf = ({ mirror }: { mirror?: boolean }) => (
  <svg {...svg} viewBox="0 0 120 200">
    <g transform={mirror ? 'matrix(-1 0 0 1 120 0)' : undefined}>
      <g fill="var(--tint-sage-edge)">
        <rect x="8" y="40" width="112" height="160" rx="18" />
        <circle cx="34" cy="44" r="32" />
        <circle cx="80" cy="30" r="32" />
        <circle cx="120" cy="34" r="30" />
        <circle cx="20" cy="96" r="22" />
        <circle cx="16" cy="146" r="22" />
        <circle cx="22" cy="184" r="18" />
      </g>
      <g fill="var(--c-hill-back)">
        <circle cx="38" cy="54" r="24" />
        <circle cx="82" cy="40" r="24" />
        <circle cx="118" cy="46" r="22" />
        <circle cx="32" cy="104" r="20" />
        <circle cx="74" cy="92" r="26" />
        <circle cx="114" cy="104" r="22" />
        <circle cx="30" cy="156" r="22" />
        <circle cx="72" cy="150" r="26" />
        <circle cx="116" cy="160" r="22" />
        <circle cx="52" cy="190" r="20" />
        <circle cx="100" cy="192" r="20" />
      </g>
      <g fill="var(--c-hill-front)">
        <circle cx="44" cy="46" r="9" />
        <circle cx="86" cy="32" r="8" />
        <circle cx="78" cy="84" r="9" />
        <circle cx="36" cy="148" r="8" />
        <circle cx="76" cy="142" r="9" />
      </g>
      <circle cx="58" cy="118" r="6" fill="var(--c-terracotta)" />
      <circle cx="96" cy="68" r="5" fill="var(--c-terracotta)" />
    </g>
  </svg>
);

const Door = () => (
  <svg {...svg} viewBox="0 0 200 200">
    <rect x="6" y="0" width="188" height="200" rx="16" fill="var(--c-terracotta-deep)" />
    <rect x="16" y="10" width="168" height="190" rx="10" fill="var(--c-terracotta)" />
    <g fill="none" stroke="var(--c-terracotta-deep)" stroke-width="5">
      <rect x="38" y="30" width="124" height="62" rx="10" />
      <rect x="38" y="110" width="124" height="70" rx="10" />
    </g>
    <circle cx="160" cy="102" r="10" fill="var(--c-honey)" />
    <circle cx="157" cy="99" r="3.5" fill="var(--c-paper)" />
  </svg>
);

const Cloud = () => (
  <svg {...svg} viewBox="0 0 200 200">
    <g fill="var(--tint-sky-edge)">
      <circle cx="46" cy="98" r="44" />
      <circle cx="104" cy="62" r="58" />
      <circle cx="160" cy="100" r="40" />
      <rect x="6" y="96" width="188" height="104" rx="40" />
    </g>
    <g fill="var(--tint-sky)">
      <circle cx="48" cy="100" r="36" />
      <circle cx="104" cy="66" r="50" />
      <circle cx="158" cy="102" r="32" />
      <rect x="14" y="100" width="172" height="88" rx="34" />
    </g>
    <g fill="var(--c-paper)" opacity=".75">
      <circle cx="84" cy="48" r="16" />
      <circle cx="40" cy="92" r="10" />
      <circle cx="108" cy="40" r="7" />
    </g>
  </svg>
);

const BLANKET = 'M26 4H174Q196 4 196 26V174Q196 196 174 196H50L4 150V26Q4 4 26 4Z';
const DOTS: [number, number][] = [];
for (let y = 34; y < 200; y += 40) for (let x = (y / 40) % 2 ? 34 : 54; x < 200; x += 40) DOTS.push([x, y]);

// A blanket with its bottom-left corner already turned up, which is where it lifts from.
const Blanket = () => (
  <svg {...svg} viewBox="0 0 200 200">
    <clipPath id="blanket-clip">
      <path d={BLANKET} />
    </clipPath>
    <path d={BLANKET} fill="var(--tint-lilac)" />
    <g clip-path="url(#blanket-clip)" fill="var(--c-butter)">
      {DOTS.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="8" />
      ))}
    </g>
    <path
      d="M30 16H170Q184 16 184 30V170Q184 184 170 184H54L16 146V30Q16 16 30 16Z"
      fill="none"
      stroke="var(--tint-lilac-edge)"
      stroke-width="4"
      stroke-dasharray="10 8"
    />
    <path d="M4 150L50 196L50 150Z" fill="var(--tint-lilac-edge)" stroke="var(--tint-lilac-edge)" stroke-width="4" stroke-linejoin="round" />
  </svg>
);

/** The parts of each cover, positioned and animated by CSS. */
export function CoverArt({ type }: { type: CoverType }) {
  switch (type) {
    case 'bush':
      return (
        <>
          <span class="cover-part cover-part--left"><BushHalf /></span>
          <span class="cover-part cover-part--right"><BushHalf mirror /></span>
        </>
      );
    case 'door':
      return <span class="cover-part cover-part--door"><Door /></span>;
    case 'cloud':
      return <span class="cover-part cover-part--cloud"><Cloud /></span>;
    case 'blanket':
      return <span class="cover-part cover-part--blanket"><Blanket /></span>;
  }
}
