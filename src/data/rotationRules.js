/**
 * Crop rotation rules for bio-intensive market gardening.
 * Based on the 4-year rotation cycle: Heavy Feeders → Legumes → Leafy → Root
 */

/** Minimum years before replanting the same family in the same bed. */
export const familyRotationMinimums = {
  Solanaceae: 4,
  Amaryllidaceae: 4,
  Brassicaceae: 3,
  Cucurbitaceae: 3,
  Fabaceae: 3,
  Asteraceae: 3,
  Amaranthaceae: 3,
  Apiaceae: 3,
  Lamiaceae: 2,
  Poaceae: 1,
};

export const DEFAULT_ROTATION_MIN = 3;

/**
 * Rotation role classification for the 4-year cycle.
 * Families not listed here are "neutral" — no role-based suggestion.
 */
export const familyRoles = {
  Solanaceae: 'heavyFeeder',
  Cucurbitaceae: 'heavyFeeder',
  Brassicaceae: 'heavyFeeder',
  Poaceae: 'heavyFeeder',

  Fabaceae: 'legume',

  Asteraceae: 'leafy',
  Amaranthaceae: 'leafy',
  Lamiaceae: 'leafy',

  Apiaceae: 'root',
  Amaryllidaceae: 'root',
  Convolvulaceae: 'root',
};

/** The 4-year rotation cycle with reasons. */
export const roleCycle = [
  { role: 'heavyFeeder', nextRole: 'legume', reason: 'Legumes fix nitrogen depleted by heavy feeders' },
  { role: 'legume', nextRole: 'leafy', reason: 'Leafy greens benefit from nitrogen left by legumes' },
  { role: 'leafy', nextRole: 'root', reason: 'Root crops break up soil compacted by leafy production' },
  { role: 'root', nextRole: 'heavyFeeder', reason: 'Heavy feeders thrive in loose, root-worked soil' },
];

/** Special family-to-family successor recommendations. */
export const specialSuccessors = [
  { after: 'Brassicaceae', recommend: 'Amaryllidaceae', reason: 'Alliums disrupt brassica pest cycles' },
  { after: 'Solanaceae', recommend: 'Fabaceae', reason: 'Legumes restore nitrogen after tomatoes/peppers' },
  { after: 'Cucurbitaceae', recommend: 'Fabaceae', reason: 'Legumes restore nitrogen after squash/melon' },
];
