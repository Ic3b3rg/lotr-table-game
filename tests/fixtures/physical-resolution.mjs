import { physicalPack } from './physical-content.mjs';

export const binding = {
  scenarioId: '00000000-0000-4000-8000-000000000001',
  packFingerprint: 'a'.repeat(64),
  projectionFingerprint: 'b'.repeat(64),
};
export const participants = Array.from({ length: 3 }, (_, i) => ({
  heroId: `invented-hero-${i}`,
  playerId: `00000000-0000-4000-8000-00000000001${i}`,
  spaceId: 'invented-space',
}));
export const source = {
  effectId: 'principal:1:0',
  instanceId: 'principal',
  state: 1,
  entry: 1,
  action: 0,
  parameterHash: 'c'.repeat(64),
};
export const suffer = (hero, damage, fear, prevention = []) => ({
  kind: 'suffer',
  hero,
  face: 'facedown',
  cards: [
    { family: 'damage', amount: damage },
    { family: 'fear', amount: fear },
  ],
  prevention,
});
export const grant = (actor = 1, budget = 2, creditCost = 1) => ({
  id: 'invented-authorization',
  actor,
  budget,
  creditCost,
  sameSpace: true,
});
export const discard = (hero = 0, count = 2, mode = 'exact') => ({
  kind: 'discard',
  hero,
  count,
  mode,
  families: ['damage', 'fear'],
});
export const program = (children = [suffer(0, 3, 2, [grant()]), suffer(2, 1, 1), discard()]) => ({
  profile: 'synthetic-no-abilities-v1',
  initialCredits: [1, 1, 1],
  limits: participants.map(() => ({ kind: 'synthetic-fixed', damage: 56, fear: 56 })),
  children,
});
export function diagnosticRaw() {
  const raw = physicalPack();
  for (const card of raw.cards.filter((c) => c.family === 'boon')) {
    card.quantity.status = 'unresolved';
    card.quantity.value = null;
    card.quantity.note = 'Invented unresolved quantity, deliberately diagnostic.';
    card.copies = [];
  }
  return raw;
}
export const evidence = (i = 0, playerId = participants[1].playerId) => ({
  playerId,
  requestId: `invented-physical-request-${String(i).padStart(4, '0')}`,
  pendingId: `00000000-0000-4000-8000-${String(i + 100).padStart(12, '0')}`,
  sourceFingerprint: 'd'.repeat(64),
  revision: i + 10,
});
