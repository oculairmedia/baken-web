export const LINKS = {
  releases: 'https://github.com/oculairmedia/letta-mobile/releases/latest',
  appRepo: 'https://github.com/oculairmedia/letta-mobile',
  webRepo: 'https://github.com/oculairmedia/baken-web',
  // Security reports go through GitHub private vulnerability reporting until a mailbox exists
  securityAdvisory: 'https://github.com/oculairmedia/letta-mobile/security/advisories/new',
};

// Social profiles. Leave a value empty until the account exists: empty entries are not rendered.
export const SOCIALS: { label: string; href: string }[] = [
  { label: 'GitHub', href: 'https://github.com/oculairmedia/letta-mobile' },
  { label: 'X', href: '' },
  { label: 'Bluesky', href: '' },
  { label: 'Discord', href: '' },
  { label: 'YouTube', href: '' },
  { label: 'LinkedIn', href: '' },
];

// Company and legal facts used across the legal pages. TODO values must be confirmed before launch.
export const LEGAL = {
  operator: 'Oculair Media',
  location: 'Georgetown, Ontario, Canada',
  jurisdiction: 'the Province of Ontario and the federal laws of Canada applicable there',
  contactEmail: '', // TODO: set once baken.ca has mail routing (no MX record today)
  updated: '24 November 2026',
  license: '', // TODO: set when a licence file is added to letta-mobile; until then the source is "source available"
};

// Finalized 03 Basalt Planes (flush ground y=168, 0 overlap, 5px min / 10px median seam at 200x200)
export const BAKEN_ANCHOR =
  'M 33.05 45.11 C 35.20 32.93, 52.02 29.75, 63.34 33.97 C 73.67 38.26, 80.33 61.85, 83.54 107.74 C 86.19 145.65, 84.52 164.81, 68.70 167.92 C 49.82 170.25, 36.50 166.16, 34.11 146.28 C 30.46 108.45, 30.96 58.29, 33.05 45.11 Z';

export const BAKEN_PEBBLE =
  'M 90.98 132.84 C 93.79 106.97, 110.87 92.13, 133.75 94.73 C 155.62 97.26, 166.55 113.06, 162.74 138.86 C 159.14 161.66, 143.55 169.60, 119.61 167.92 C 97.66 166.39, 88.38 155.71, 90.98 132.84 Z';

// Canonical mascot bodies & eye glyphs from the app's Rive mascot pipeline
export const MASCOT_BODIES = {
  blob: 'M -5.1346 -147.6869 C 32.7294 -140.7887 65.6596 -126.8838 96.1502 -104.3418 C 126.6408 -81.7998 150.6662 -43.5705 149.6158 -3.057 C 148.5654 37.4566 125.6488 73.7656 97.923 100.0006 C 70.1972 126.2356 34.882 147.2541 -5.1346 149.7953 C -45.1512 152.3365 -85.2786 131.1135 -108.3175 100.1259 C -131.3565 69.1384 -142.459 34.3101 -147.8664 -3.057 C -153.2738 -40.4241 -147.1972 -85.8597 -118.3127 -116.235 C -89.4281 -146.6104 -42.9986 -154.5851 -5.1346 -147.6869 Z',
  triangle: 'M 0.0000 -150.0000 C 22.2201 -150.9701 35.9680 -112.7016 59.8535 -71.3306 C 83.7391 -29.9597 67.8154 -57.5403 91.7009 -16.1693 C 115.5864 25.2016 140.1736 55.2718 129.9038 75.0000 C 119.6339 94.7282 97.8779 87.5000 0.0000 87.5000 C -97.8779 87.5000 -119.6339 94.7282 -129.9038 75.0000 C -140.1736 55.2718 -115.5864 25.2016 -91.7009 -16.1693 C -67.8154 -57.5403 -83.7391 -29.9597 -59.8535 -71.3306 C -35.9680 -112.7016 -22.2201 -149.0298 0.0000 -150.0000 Z',
  squircle: 'M 0.0000 -150.0000 C 78.5760 -150.0000 129.6436 -154.8854 142.6777 -142.6777 C 155.7117 -130.4700 150.0000 -78.5760 150.0000 0.0000 C 150.0000 78.5760 154.8854 129.6436 142.6777 142.6777 C 130.4700 155.7117 78.5760 150.0000 0.0000 150.0000 C -78.5760 150.0000 -129.6436 154.8854 -142.6777 142.6777 C -155.7117 130.4700 -150.0000 78.5760 -150.0000 0.0000 C -150.0000 -78.5760 -154.8854 -129.6436 -142.6777 -142.6777 C -130.4700 -155.7117 -78.5760 -150.0000 0.0000 -150.0000 Z',
  circle: 'M 0 -150 C 39.7825 -150 77.9356 -134.1965 106.066 -106.066 C 134.1965 -77.9356 150 -39.7825 150 0 C 150 39.7825 134.1965 77.9356 106.066 106.066 C 77.9356 134.1965 39.7825 150 0 150 C -39.7825 150 -77.9356 134.1965 -106.066 106.066 C -134.1965 77.9356 -150 39.7825 -150 0 C -150 -39.7825 -134.1965 -77.9356 -106.066 -106.066 C -77.9356 -134.1965 -39.7825 -150 0 -150 Z',
};

export const GLYPHS = {
  idle: '<path d="M -14 -24 C -4 -24 9 -23 16 -22 C 21 -21 24 -18 24 -12 C 24 -2 23 10 22 17 C 21 22 17 24 11 24 C 1 24 -11 23 -17 22 C -22 21 -24 17 -24 11 C -24 1 -23 -11 -22 -17 C -21 -22 -18 -24 -14 -24 Z" fill="#111111"/>',
  listening: '<path d="M -17 -28 C -4 -28 9 -28 18 -27 C 24 -26 28 -22 28 -15 C 28 -3 27 11 26 19 C 25 25 20 28 13 28 C 2 28 -11 27 -19 26 C -26 25 -28 20 -28 12 C -28 1 -27 -12 -26 -20 C -25 -26 -22 -28 -17 -28 Z" fill="#111111"/>',
  thinking: '<path d="M -20 -8 C -3 -8 9 -6 20 -5 C 24 -5 26 -2 26 2 C 26 6 23 8 19 8 C 5 7 -7 5 -20 4 C -24 4 -26 1 -26 -2 C -26 -6 -24 -8 -20 -8 Z" fill="#111111"/>',
  loading: '<path d="M 11 0 C 11 6.0751 6.0751 11 0 11 C -6.0751 11 -11 6.0751 -11 0 C -11 -6.0751 -6.0751 -11 0 -11 C 6.0751 -11 11 -6.0751 11 0 Z" fill="#111111"/>',
  success: '<path d="M -24 9 C -17 -3 -8 -12 2 -10 C 12 -9 20 -1 24 7" fill="none" stroke="#111111" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>',
  sleeping: '<path d="M -24 -9 C -19 3 -9 11 1 10 C 11 10 19 1 24 -7" fill="none" stroke="#111111" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>',
};
