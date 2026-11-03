import { hash } from './map-freeze.mjs';
import { catalogFixture } from './catalog.mjs';
import { diagnosticRaw, binding, evidence } from './physical-resolution.mjs';
export { hash, diagnosticRaw, binding, evidence };
export function inventedFrontInput(raw) {
  return {
    version: 1,
    definitions: raw.cards
      .filter((c) => ['damage', 'fear'].includes(c.family))
      .map((c) => ({
        cardId: c.id,
        cardHash: hash(c),
        originalHash: hash(c.text.original),
        source: c.text.original?.reference ?? c.text.evidence[0],
        body: [{ op: 'self-flip-down' }],
        persistent: [],
      })),
    policies: [],
  };
}
export function frontFixture() {
  const raw = diagnosticRaw(),
    ir = inventedFrontInput(raw),
    catalog = catalogFixture();
  const heroes = catalog.heroes.slice(0, 3).map((h, i) => ({
    heroId: h.id,
    playerId: `00000000-0000-4000-8000-00000000001${i}`,
    spaceId: 'invented-space',
  }));
  const context = {
    preparation: {
      status: 'prepared',
      heroes: heroes
        .map((h, i) => ({
          ...h,
          roleId: `role-${i + 1}`,
          itemCopies: [],
          inspiration: 2,
          prepared: [`role-${i + 1}-skill-1:1`],
          deck: [
            'basic-1',
            'basic-2',
            'basic-3',
            'basic-4',
            'basic-5',
            'basic-6',
            ...catalog.heroes[i].skills,
            `role-${i + 1}-skill-2`,
            `role-${i + 1}-skill-3`,
            `weak-${i + 1}`,
          ].map((id) => `${id}:${id.startsWith('basic') ? i + 1 : 1}`),
          discard: [],
        }))
        .map(({ spaceId, ...h }) => h),
      weaknessDeck: catalog.weaknessCards.slice(3).map((id) => `${id}:1`),
    },
    depletion: [],
    boons: [],
  };
  const program = (children) => ({
    profile: 'source-fronts-v1',
    initialCredits: [0, 0, 0],
    limits: heroes.map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
    children,
    darknessHeroes: [],
  });
  return { raw, ir, catalog, heroes, context, program };
}
