// Entirely invented cards, prices, identities and source evidence.
import { catalogFixture } from './catalog.mjs';
import { lairCompilation } from './lair-victory.mjs';
import { hash } from './map-freeze.mjs';

export function attachCampSkills(pack, catalog = catalogFixture()) {
  const material = { id: 'invented', kind: 'derived', sha256: hash('invented source') };
  const evidence = (locator) => [{ sourceId: material.id, locator }];
  const model = (role, n, cost) => ({
    source: `invented.assets:${10000 + role * 100 + n}`,
    modelId: role * 100 + n,
    objectHash: hash({ role, n }),
    roleSource: `invented.assets:${9000 + role}`,
    sourceType: 2,
    titleSource: null,
    cost,
  });
  const cap = {
    version: 'source-camp-skills-v1',
    evidenceHash: hash('invented complete training evidence'),
    catalogFingerprint: hash(catalog),
    failureFingerprint: hash(pack.manifest.failure),
    sources: [material],
    methods: Object.fromEntries(
      [
        'editable',
        'hero',
        'roles',
        'page',
        'load',
        'select',
        'skillRole',
        'close',
        'getXP',
        'setXP',
        'getSkills',
        'add',
        'remove',
      ].map((name) => [
        name,
        {
          assemblyHash: pack.manifest.failure.methods.signal.assemblyHash,
          method: '06009999',
          bodyHash: hash(name),
        },
      ]),
    ),
    roles: catalog.roles.map((role, i) => ({
      id: role.id,
      source: `invented.assets:${9001 + i}`,
      modelId: i + 1,
      objectHash: hash({ role: i + 1 }),
      core: [model(i + 1, 1, 0), model(i + 1, 2, 0)],
      upgrades: Array.from({ length: 9 }, (_, j) => {
        const id = `invented-upgrade-${i + 1}-${j + 4}`;
        const price = [2, 4, 6, 8, 9, 10, 11, 13, 15][j];
        return {
          card: {
            id,
            name: {
              text: `Tecnica inventata ${i + 1}/${j + 4}`,
              kind: 'translated',
              source: 'fixture: invented',
              verified: true,
            },
            text: {
              text: 'Durante una futura finestra inventata, puoi scegliere un effetto che richiede un consumer ulteriore.',
              kind: 'translated',
              source: 'fixture: invented',
              verified: true,
            },
            quantity: 1,
            identityStatus: 'confirmed',
            notes: [],
            kind: 'role',
            ownerId: role.id,
            number: j + 4,
            success: j % 2,
            fate: 1,
            traits: ['Tecnica inventata'],
          },
          copy: `${id}:1`,
          cost: price,
          binding: 'exact',
          models: [model(i + 1, j + 3, price)],
          originalText: 'An invented future ability.',
          mechanics: {
            execution: 'requires-consumer',
            clauses: [
              {
                timing: 'Invented timing',
                condition: null,
                cost: null,
                effect: 'Invented effect',
                limit: null,
              },
            ],
            keywords: [],
          },
          evidence: Object.fromEntries(
            ['identity', 'cost', 'icons', 'text', 'mechanics'].map((key) => [
              key,
              evidence(`invented:${id}:${key}`),
            ]),
          ),
        };
      }),
    })),
  };
  pack.manifest.campSkills = cap;
  return cap;
}

export function campCompilation() {
  const input = lairCompilation();
  attachCampSkills(input.pack);
  input.campSkillsCertificate = { instructionHash: hash(input.pack.manifest.campSkills) };
  return input;
}
