/**
 * Desk accessories — the hired four (brief #8 decision record): quill, letter
 * knife, thread spool, pounce pot. Bodies lifted from the round-03 comp's
 * accessory drawer. These are AMBIENCE: pointer-events none, aria-hidden, and
 * all of them vanish in flat mode (.gv-acc). State arrives as props, and every
 * state has an explicit labeled twin on the hosting screen — the accessory
 * never carries a fact alone.
 */

/** Inkwell + quill. Resting: quill leans in the well (nothing awaits you).
 *  Pending: the quill lies out in front, nib inked — a choice or order waits. */
export function InkwellQuill({ pending }: { pending: boolean }) {
  return (
    <svg width={92} height={96} viewBox="0 0 92 96">
      <ellipse cx={40} cy={88} rx={28} ry={6} fill="#000000" opacity={0.3} />
      {!pending && (
        <g>
          <path d="M84 6 C 68 10, 57 26, 53 46 C 61 41, 74 23, 84 6 Z" fill="#e6dcbc" />
          <path d="M84 6 C 74 17, 63 36, 55 54 C 58 40, 69 18, 84 6 Z" fill="#c2b48c" />
          <path d="M84 6 C 70 15, 58 38, 51 60" fill="none" stroke="#8a6c38" strokeWidth={1.6} />
          <path d="M51 60 l-2 4" stroke="#12151c" strokeWidth={2} />
        </g>
      )}
      <path d="M16 58 q0 -15 24 -15 q24 0 24 15 l-4 23 q-20 9 -40 0 Z" fill="url(#gv-acc-pot)" />
      <ellipse cx={40} cy={58} rx={24} ry={8} fill="url(#gv-acc-brass)" />
      <ellipse cx={40} cy={59} rx={17} ry={5} fill="#0d0b10" />
      <ellipse cx={34} cy={58} rx={6} ry={1.6} fill="#434b5c" opacity={0.9} />
      {pending && (
        <g transform="translate(2,74) rotate(-4)">
          <path d="M12 8 C 32 2, 58 0, 78 5 C 58 9, 32 12, 12 8 Z" fill="#e6dcbc" />
          <path d="M12 8 C 34 5, 58 3, 78 5 C 56 6, 32 9, 12 8 Z" fill="#c2b48c" />
          <path d="M78 5 l9 2" stroke="#8a6c38" strokeWidth={1.6} fill="none" />
          <path d="M87 7 l4 1.4" stroke="#12151c" strokeWidth={2.4} />
          <ellipse cx={90} cy={12} rx={2.4} ry={1.2} fill="#12151c" opacity={0.8} />
        </g>
      )}
      <defs>
        <linearGradient id="gv-acc-pot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#434b5c" /><stop offset="0.55" stopColor="#232833" /><stop offset="1" stopColor="#12151c" />
        </linearGradient>
        <linearGradient id="gv-acc-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9a86a" /><stop offset="0.6" stopColor="#a4854c" /><stop offset="1" stopColor="#6e5426" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The letter knife — lies across correspondence whenever letters await. */
export function LetterKnife() {
  return (
    <svg width={128} height={40} viewBox="0 0 128 40">
      <ellipse cx={62} cy={30} rx={56} ry={4} fill="#000000" opacity={0.25} />
      <g transform="rotate(-3 62 20)">
        <path d="M4 20 C 28 13, 56 11, 78 15 L 78 25 C 56 27, 28 25, 4 20 Z" fill="url(#gv-acc-steel)" />
        <path d="M6 20 C 30 16, 56 14, 76 17" stroke="#ffffff88" strokeWidth={1} fill="none" />
        <rect x={77} y={11} width={42} height={17} rx={8} fill="url(#gv-acc-brass2)" />
        <circle cx={88} cy={19.5} r={2} fill="#55401c" /><circle cx={106} cy={19.5} r={2} fill="#55401c" />
      </g>
      <defs>
        <linearGradient id="gv-acc-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d4d8dd" /><stop offset="0.5" stopColor="#a8adb4" /><stop offset="1" stopColor="#7e838a" />
        </linearGradient>
        <linearGradient id="gv-acc-brass2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9a86a" /><stop offset="0.6" stopColor="#a4854c" /><stop offset="1" stopColor="#6e5426" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The pounce pot — the week-advance anchor. Re-keying the sand group fires
 *  the brief resolution shimmer (the scribe sanding the ledger). */
export function PouncePot({ shimmerKey }: { shimmerKey: number }) {
  return (
    <svg width={72} height={92} viewBox="0 0 72 92">
      <ellipse cx={36} cy={84} rx={26} ry={5} fill="#000000" opacity={0.3} />
      <path d="M22 36 q14 -25 28 0 Z" fill="url(#gv-acc-brass3)" />
      <g fill="#2a1f0e">
        <circle cx={36} cy={18} r={1.6} /><circle cx={29} cy={24} r={1.6} /><circle cx={43} cy={24} r={1.6} />
        <circle cx={33} cy={30} r={1.6} /><circle cx={40} cy={30} r={1.6} />
      </g>
      <rect x={19} y={35} width={34} height={5} rx={2.5} fill="#8a6c38" />
      <path d="M22 40 q-6 19 2 32 q12 7 24 0 q8 -13 2 -32 Z" fill="url(#gv-acc-brass3)" />
      <path d="M26 44 q-3 14 1 24" stroke="#ffffff44" strokeWidth={2} fill="none" />
      <rect x={17} y={71} width={38} height={7} rx={3.5} fill="#6e5426" />
      <g key={shimmerKey} className="gv-acc-sand" fill="#d8c494">
        <circle cx={14} cy={82} r={1} /><circle cx={60} cy={80} r={1} />
        <circle cx={56} cy={84} r={1.2} /><circle cx={10} cy={79} r={1.2} />
        <circle cx={30} cy={86} r={1} /><circle cx={44} cy={87} r={1} />
      </g>
      <defs>
        <linearGradient id="gv-acc-brass3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9a86a" /><stop offset="0.6" stopColor="#a4854c" /><stop offset="1" stopColor="#6e5426" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The thread spool — the red thread's visual origin (the chart draws the thread). */
export function ThreadSpool() {
  return (
    <svg width={92} height={72} viewBox="0 0 92 72">
      <ellipse cx={44} cy={60} rx={30} ry={5} fill="#000000" opacity={0.3} />
      <rect x={28} y={16} width={32} height={34} fill="#9c3428" />
      <g stroke="#b8544a" strokeWidth={1.2}>
        <line x1={28} y1={22} x2={60} y2={21} /><line x1={28} y1={29} x2={60} y2={28} />
        <line x1={28} y1={36} x2={60} y2={35} /><line x1={28} y1={43} x2={60} y2={42} />
      </g>
      <rect x={17} y={9} width={11} height={48} rx={4.5} fill="url(#gv-acc-wood)" />
      <rect x={60} y={9} width={11} height={48} rx={4.5} fill="url(#gv-acc-wood)" />
      <path d="M60 46 C 76 44, 74 60, 90 57" fill="none" stroke="#9c3428" strokeWidth={1.5} />
      <defs>
        <linearGradient id="gv-acc-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a5530" /><stop offset="1" stopColor="#3f2a16" />
        </linearGradient>
      </defs>
    </svg>
  );
}
