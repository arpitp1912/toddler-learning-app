// Icon set lifted from the design export. All decorative: aria-hidden.
const base = { class: 'icon', 'aria-hidden': 'true' as const, focusable: 'false' as const };
const line = { fill: 'none', 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const };

export const PlayIcon = () => (
  <svg {...base} viewBox="0 0 24 24">
    <path d="M8.5 5.8c0-.9 1-1.5 1.8-1l9 5.6c.7.5.7 1.6 0 2.1l-9 5.6c-.8.5-1.8-.1-1.8-1z" fill="var(--c-paper)" />
  </svg>
);

export const HomeIcon = () => (
  <svg {...base} {...line} viewBox="0 0 24 24" stroke="var(--c-ink)" stroke-width="2.2">
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9.5h13V10" />
    <path d="M10 19.5v-5h4v5" />
  </svg>
);

export const ChevronIcon = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg {...base} {...line} viewBox="0 0 24 24" stroke="var(--c-ink-soft)" stroke-width="3">
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
);

export const SpeakerIcon = () => (
  <svg {...base} {...line} viewBox="0 0 24 24" stroke="var(--c-ink)" stroke-width="2">
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="var(--c-ink)" />
    <path d="M15.5 9a4 4 0 0 1 0 6" />
    <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
);

export const SunIcon = () => (
  <svg {...base} viewBox="0 0 132 132">
    <g stroke="var(--c-sun)" stroke-width="8" stroke-linecap="round">
      <path d="M66 8v14" /><path d="M66 110v14" /><path d="M8 66h14" /><path d="M110 66h14" />
      <path d="M25 25l10 10" /><path d="M97 97l10 10" /><path d="M107 25 97 35" /><path d="M35 97 25 107" />
    </g>
    <circle cx="66" cy="66" r="32" fill="var(--c-sun)" />
  </svg>
);

export const StarIcon = () => (
  <svg {...base} viewBox="0 0 24 24">
    <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="var(--c-moonface)" />
  </svg>
);

export const MoonFace = () => (
  <svg {...base} class="icon icon--face" viewBox="0 0 280 280">
    <circle cx="140" cy="140" r="130" fill="var(--c-moonface)" />
    <circle cx="98" cy="96" r="16" fill="#E8D08C" />
    <circle cx="190" cy="196" r="12" fill="#E8D08C" />
    <path d="M84 146q18 16 36 0" fill="none" stroke="#6B5A3A" stroke-width="7" stroke-linecap="round" />
    <path d="M160 146q18 16 36 0" fill="none" stroke="#6B5A3A" stroke-width="7" stroke-linecap="round" />
    <path d="M124 190q16 10 32 0" fill="none" stroke="#6B5A3A" stroke-width="6" stroke-linecap="round" />
    <circle cx="80" cy="176" r="12" fill="#EFB9A0" opacity=".7" />
    <circle cx="200" cy="176" r="12" fill="#EFB9A0" opacity=".7" />
  </svg>
);

export const ZzzIcon = () => (
  <svg {...base} {...line} class="icon lock-zzz" viewBox="0 0 120 120" stroke="var(--c-night-line)">
    <path d="M20 70h26L20 100h26" stroke-width="7" opacity=".7" />
    <path d="M64 24h20L64 48h20" stroke-width="6" opacity=".5" />
  </svg>
);

export const PadlockIcon = () => (
  <svg {...base} {...line} viewBox="0 0 24 24" stroke="var(--c-night-line)" stroke-width="2">
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </svg>
);

export const TwoFingerIcon = () => (
  <svg {...base} viewBox="0 0 96 96">
    <circle cx="34" cy="48" r="16" fill="none" stroke="var(--c-night-line)" stroke-width="3" />
    <circle cx="62" cy="48" r="16" fill="none" stroke="var(--c-night-line)" stroke-width="3" />
  </svg>
);

// Home tile for Peekaboo: a bush with two eyes peeking over the top.
export const PeekabooIcon = () => (
  <svg {...base} class="icon icon--tile" viewBox="0 0 200 200">
    <g fill="var(--tint-sage-edge)">
      <circle cx="40" cy="118" r="30" />
      <circle cx="72" cy="88" r="34" />
      <circle cx="112" cy="78" r="36" />
      <circle cx="150" cy="98" r="32" />
      <circle cx="168" cy="132" r="24" />
      <rect x="14" y="110" width="172" height="72" rx="30" />
    </g>
    <g fill="var(--c-hill-back)">
      <circle cx="44" cy="124" r="22" />
      <circle cx="74" cy="96" r="26" />
      <circle cx="112" cy="86" r="28" />
      <circle cx="148" cy="106" r="24" />
      <circle cx="162" cy="140" r="18" />
      <rect x="22" y="118" width="156" height="56" rx="24" />
    </g>
    <ellipse cx="100" cy="122" rx="44" ry="26" fill="var(--c-ink)" opacity=".55" />
    <g fill="var(--c-paper)">
      <ellipse cx="82" cy="122" rx="13" ry="15" />
      <ellipse cx="118" cy="122" rx="13" ry="15" />
    </g>
    <circle cx="85" cy="125" r="6.5" fill="var(--c-ink)" />
    <circle cx="121" cy="125" r="6.5" fill="var(--c-ink)" />
    <circle cx="87" cy="122" r="2" fill="var(--c-paper)" />
    <circle cx="123" cy="122" r="2" fill="var(--c-paper)" />
    <g fill="var(--c-hill-front)">
      <circle cx="56" cy="158" r="7" />
      <circle cx="146" cy="160" r="6" />
      <circle cx="106" cy="66" r="7" />
      <circle cx="64" cy="82" r="6" />
    </g>
    <circle cx="40" cy="146" r="5" fill="var(--c-terracotta)" />
    <circle cx="160" cy="118" r="5" fill="var(--c-terracotta)" />
    <circle cx="136" cy="84" r="4.5" fill="var(--c-terracotta)" />
  </svg>
);

// Home tile for Bubbles: three bubbles, a duck inside the largest.
const TileBubble = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
  <>
    <circle cx={cx} cy={cy} r={r} fill="var(--c-paper)" fill-opacity=".45" stroke="var(--tint-sky-edge)" stroke-width="4" />
    <ellipse
      cx={cx - r * 0.38}
      cy={cy - r * 0.45}
      rx={r * 0.26}
      ry={r * 0.13}
      transform={`rotate(-38 ${cx - r * 0.38} ${cy - r * 0.45})`}
      fill="var(--c-paper)"
    />
  </>
);

export const BubblesIcon = () => (
  <svg {...base} class="icon icon--tile" viewBox="0 0 200 200">
    <circle cx="94" cy="112" r="62" fill="var(--c-paper)" fill-opacity=".45" stroke="var(--tint-sky-edge)" stroke-width="4" />
    {/* Duck */}
    <ellipse cx="90" cy="130" rx="32" ry="20" fill="var(--c-honey)" />
    <path d="M62 124q-8-14 4-16q6 8 10 14z" fill="var(--c-honey)" />
    <circle cx="112" cy="102" r="17" fill="var(--c-honey)" />
    <path d="M126 100q14-1 16 6q-8 6-17 4z" fill="var(--c-terracotta)" />
    <circle cx="116" cy="98" r="3.4" fill="var(--c-ink)" />
    <path d="M78 128q12 10 26 0" fill="none" stroke="var(--c-sun)" stroke-width="4" stroke-linecap="round" />
    <ellipse cx="70" cy="76" rx="16" ry="8" transform="rotate(-38 70 76)" fill="var(--c-paper)" />
    <TileBubble cx={160} cy={62} r={26} />
    <TileBubble cx={150} cy={160} r={17} />
  </svg>
);

// An ear with sound arriving from the left. Used by the replay button and the tile.
const Ear = ({ fill = 'var(--tint-peach)' }: { fill?: string }) => (
  <>
    <path
      d="M66 14C90 14 104 32 104 54C104 72 94 80 88 88C82 96 82 108 68 108C56 108 52 98 52 90C52 82 46 78 44 70C40 60 40 50 42 42C46 24 56 14 66 14Z"
      fill={fill}
      stroke="var(--c-ink)"
      stroke-width="5"
      stroke-linejoin="round"
    />
    <path d="M60 76C55 66 58 54 67 50C77 46 85 54 83 64C81 72 73 74 73 84" fill="none" stroke="var(--c-ink)" stroke-width="6" stroke-linecap="round" />
  </>
);

/** Guess sound round: the replay button. */
export const EarIcon = () => (
  <svg {...base} viewBox="0 0 120 120">
    <g fill="none" stroke="var(--c-terracotta)" stroke-width="6" stroke-linecap="round">
      <path d="M28 46q-8 14 0 28" />
      <path d="M14 36q-16 24 0 48" />
    </g>
    <Ear />
  </svg>
);

/** A cow's face, centred near (78, 118) in a 200 box. Shared by the Look and Guess art. */
const CowFace = () => (
  <>
    <ellipse cx="34" cy="96" rx="16" ry="9" transform="rotate(-24 34 96)" fill="var(--c-paper)" stroke="var(--c-ink)" stroke-width="4" />
    <ellipse cx="122" cy="96" rx="16" ry="9" transform="rotate(24 122 96)" fill="var(--c-paper)" stroke="var(--c-ink)" stroke-width="4" />
    <path d="M52 84q-4-14 6-18" fill="none" stroke="var(--c-honey)" stroke-width="7" stroke-linecap="round" />
    <path d="M104 84q4-14-6-18" fill="none" stroke="var(--c-honey)" stroke-width="7" stroke-linecap="round" />
    <rect x="44" y="80" width="68" height="92" rx="32" fill="var(--c-paper)" stroke="var(--c-ink)" stroke-width="4" />
    <path d="M48 104q4-18 22-20q-2 16-22 20z" fill="var(--c-ink)" />
    <circle cx="66" cy="114" r="5" fill="var(--c-ink)" />
    <circle cx="92" cy="114" r="5" fill="var(--c-ink)" />
    <ellipse cx="78" cy="150" rx="30" ry="20" fill="var(--tint-peach-edge)" stroke="var(--c-ink)" stroke-width="4" />
    <ellipse cx="68" cy="150" rx="4" ry="6" fill="var(--c-ink)" />
    <ellipse cx="88" cy="150" rx="4" ry="6" fill="var(--c-ink)" />
  </>
);

/** Home tile for Look: a wide-open eye with a cow inside it. */
export const LookIcon = () => (
  <svg {...base} class="icon icon--tile" viewBox="0 0 200 200">
    <g fill="none" stroke="var(--c-ink)" stroke-width="5" stroke-linecap="round">
      <path d="M52 52 42 36" />
      <path d="M100 38V20" />
      <path d="M148 52l10-16" />
    </g>
    <path d="M10 104Q100 8 190 104Q100 200 10 104Z" fill="var(--c-paper)" stroke="var(--c-ink)" stroke-width="5" stroke-linejoin="round" />
    <circle cx="100" cy="104" r="54" fill="var(--tint-sky)" stroke="var(--c-ink)" stroke-width="5" />
    <g transform="translate(100 108) scale(.56) translate(-78 -120)">
      <CowFace />
    </g>
    <ellipse cx="72" cy="78" rx="10" ry="6" transform="rotate(-38 72 78)" fill="var(--c-paper)" opacity=".85" />
  </svg>
);

/** Home tile for Guess: an ear listening, and a hand pointing to choose. */
export const GuessIcon = () => (
  <svg {...base} class="icon icon--tile" viewBox="0 0 200 200">
    <g fill="none" stroke="var(--c-terracotta)" stroke-width="6" stroke-linecap="round">
      <path d="M30 52q-8 14 0 28" />
      <path d="M16 42q-16 24 0 48" />
    </g>
    <g transform="translate(6 2) scale(.95)">
      <Ear fill="var(--c-paper)" />
    </g>
    {/* A hand, index finger pointing up and to the left */}
    <g transform="rotate(-30 128 150)" stroke="var(--c-ink)" stroke-width="4.5" stroke-linejoin="round">
      <rect x="160" y="128" width="20" height="50" rx="6" fill="var(--c-terracotta)" />
      <rect x="54" y="134" width="74" height="24" rx="12" fill="var(--c-paper)" />
      <rect x="106" y="124" width="60" height="60" rx="22" fill="var(--c-paper)" />
      <path d="M112 128q4-16 22-14q8 2 6 12" fill="var(--c-paper)" />
      <g fill="none" stroke-linecap="round">
        <path d="M112 160h22" />
        <path d="M112 174h18" />
      </g>
    </g>
  </svg>
);

/** Guess word round: the replay button, a speech bubble. */
export const SpeechIcon = () => (
  <svg {...base} viewBox="0 0 120 120">
    <path
      d="M24 20h72a14 14 0 0 1 14 14v40a14 14 0 0 1-14 14H56L32 106l4-18h-12a14 14 0 0 1-14-14V34a14 14 0 0 1 14-14z"
      fill="var(--tint-peach)"
      stroke="var(--c-ink)"
      stroke-width="5"
      stroke-linejoin="round"
    />
    <g fill="var(--c-terracotta)">
      <circle cx="40" cy="54" r="7" />
      <circle cx="60" cy="54" r="7" />
      <circle cx="80" cy="54" r="7" />
    </g>
  </svg>
);

/** One sparkle point for the correct-answer burst. */
export const SparkIcon = () => (
  <svg {...base} viewBox="0 0 24 24">
    <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" fill="var(--c-sun)" />
  </svg>
);
