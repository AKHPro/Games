/* Flat illustrated avatars (from Imagina's design). Not real people. */
const CORAL = '#FF4D28', NAVY = '#122033';
const FACES = {
  noa:    { bg: '#F1D2BC', skin: '#E8C4A8', hair: '#3B2416', shirt: CORAL,     kind: 'bob' },
  daniel: { bg: '#E7C4A4', skin: '#D2A07A', hair: '#1C1410', shirt: NAVY,      kind: 'short' },
  maya:   { bg: '#F0D0B4', skin: '#E0B090', hair: '#1A1410', shirt: '#6EBFB0', kind: 'long' },
  yossi:  { bg: '#EED4B8', skin: '#E0BE96', hair: '#3A2A20', shirt: '#C4A062', kind: 'beard' },
};
export function avatar(who, size = 48) {
  const f = FACES[who] || FACES.daniel;
  let hair = '';
  if (f.kind === 'bob') hair = `<path fill="${f.hair}" d="M18 30c0-16 10-26 22-26s22 10 22 26v10c-4-10-11-14-22-14S22 30 18 40V30Z"/><path fill="${f.hair}" d="M16 36c2-16 8-22 16-24v10c-6 1-10 6-12 14h-4z"/><path fill="${f.hair}" d="M64 36c-2-16-8-22-16-24v10c6 1 10 6 12 14h4z"/>`;
  else if (f.kind === 'short') hair = `<path fill="${f.hair}" d="M20 34c1-16 8-26 20-26s19 10 20 26c-5-8-11-11-20-11s-15 3-20 11Z"/>`;
  else if (f.kind === 'long') hair = `<path fill="${f.hair}" d="M14 58c2-28 8-48 26-48s24 20 26 48v8c-3-18-8-28-26-28S17 48 14 66v-8Z"/><path fill="${f.hair}" d="M18 34c2-16 9-24 22-24s20 8 22 24c-5-9-12-13-22-13s-17 4-22 13Z"/>`;
  else hair = `<path fill="${NAVY}" d="M16 30c2-10 10-18 24-18s22 8 24 18v6H16v-6Z"/><path fill="${NAVY}" d="M14 30h52v6H14z"/><path fill="${f.hair}" d="M24 58c2 10 8 16 16 16s14-6 16-16c-4 4-9 6-16 6s-12-2-16-6Z"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 80 80" aria-hidden="true">
    <rect width="80" height="80" fill="${f.bg}"/>
    <ellipse cx="40" cy="78" rx="28" ry="16" fill="${f.shirt}"/>
    <ellipse cx="22" cy="48" rx="5" ry="7" fill="${f.skin}"/><ellipse cx="58" cy="48" rx="5" ry="7" fill="${f.skin}"/>
    <circle cx="40" cy="42" r="18" fill="${f.skin}"/>${hair}
    <path d="M28 35.2h8M44 35.2h8" stroke="${f.hair}" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="32" cy="40" r="2.1" fill="#1A1720"/><circle cx="48" cy="40" r="2.1" fill="#1A1720"/>
    <path d="M34 48c2 3 10 3 12 0" fill="none" stroke="#C26A5A" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
}
