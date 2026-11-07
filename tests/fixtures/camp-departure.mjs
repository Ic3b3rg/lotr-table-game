// Completely invented geometry, cards, policies, instructions and quantities.
import { battleSource, f32, hash } from './battle-map.mjs';
import { compileBattleMapSource } from '../../dist/battle-map-library.mjs';
import { compileSourceDeployment } from '../../dist/combat-library.mjs';
import { compilePhysicalFronts } from '../../dist/physical-resolution-library.mjs';
import { deploymentSource } from './source-deployment.mjs';
export function departureBoardSource() {
  const s = battleSource();
  const record = (id, kind) => {
    s.records.push({ id, kind, file: 'invented', locator: `departure/${id}`, sha256: hash(id) });
    return id;
  };
  const transform = (id, position, rotation = [0, 0, 0, 1], parent = null) => {
    s.transforms.push({
      record: record(id, 'transform'),
      parent,
      position: position.map(f32),
      rotation: rotation.map(f32),
      scale: [1, 1, 1].map(f32),
    });
    return id;
  };
  for (const alt of s.alternatives)
    for (const [bi, b] of alt.boards.entries()) {
      b.patches = Array.from({ length: 9 }, (_, i) => {
        const mesh = `departure-mesh-${alt.id}-${bi}-${i}`,
          x = bi * 6 + (i % 3) * 2,
          y = Math.floor(i / 3) * 2;
        s.meshes.push({
          record: record(mesh, 'mesh'),
          codec: 'float32',
          vertices: [
            [x, y, 0],
            [x + 2, y, 0],
            [x + 2, y + 2, 0],
            [x, y + 2, 0],
          ].map((p, n) => ({
            index: n,
            position: p,
            positionBits: p.map((v) => f32(v).float32le),
            uv: [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ][n],
            uvBits: [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ][n].map((v) => f32(v).float32le),
          })),
          submeshes: [{ index: 0, vertices: [0, 1, 2, 3] }],
        });
        return {
          record: record(`departure-patch-${alt.id}-${bi}-${i}`, 'patch'),
          mesh,
          submesh: 0,
          transform: transform(
            `departure-transform-${alt.id}-${bi}-${i}`,
            [0, 0, 0],
            [0, 0, 0, 1],
            b.transform,
          ),
          staticBatched: true,
        };
      });
    }
  for (const face of s.policy.faces)
    face.regions = [
      { id: 'atrium', patches: [0, 3] },
      { id: 'veranda', patches: [1, 2] },
      { id: 'walk', patches: [5, 8] },
      { id: 'yard', patches: [6, 7] },
      { id: 'heart', patches: [4] },
    ];
  s.policyFingerprint = hash(s.policy);
  const rows = [
    ['heroes', 'hero', 1, 3],
    ['ranged', 'spawn', 11, 3],
    ['middle', 'spawn', 7, 3],
    ['last', 'spawn', 3, 5],
    ['shrub-a', 'terrain', 3, 1],
    ['shrub-b', 'terrain', 5, 3],
    ['divider-a', 'wall', 6, 1],
    ['divider-b', 'wall', 6, 5],
    ['divider-c', 'wall', 7, 4],
    ['flame', 'terrain', 9, 3],
    ['stone', 'terrain', 3, 3],
    ['danger', 'threat', 9, 1],
    ['clue', 'search', 9, 5],
  ];
  s.anchors = rows.map(([id, kind, x, y], n) => ({
    id,
    kind,
    order: kind === 'spawn' ? n - 1 : null,
    transform: transform(
      `departure-anchor-${id}`,
      [x, y, 0],
      id === 'divider-c' ? [0, 0, Math.SQRT1_2, Math.SQRT1_2] : [0, 0, 0, 1],
    ),
    record: kind === 'hero' ? null : record(`departure-node-${id}`, 'anchor'),
    wall: kind === 'wall' ? { mesh: 'strip', submesh: 0, children: [] } : null,
  }));
  const rename = (v) =>
    Array.isArray(v)
      ? v.map(rename)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, v]) => [k, k === 'kind' ? v : rename(v)]))
        : v === 'model'
          ? 'example.assets:980'
          : v;
  return rename(s);
}
function titleDefinitions(raw) {
  return raw.cards
    .filter((c) => c.family === 'title')
    .map((c) => {
      const localized = (f) => ({
          text: f.value,
          kind: f.origin === 'working-translation' ? 'translated' : 'official-it',
          source: f.evidence.map((e) => e.locator).join(' · '),
          verified: f.status === 'verified',
        }),
        printing = c.printing.value;
      return {
        id: c.id,
        kind: 'title',
        ownerId: null,
        number: printing.number,
        success: printing.icons
          .filter((i) => i.symbol === 'success')
          .reduce((n, i) => n + i.count, 0),
        fate: printing.icons.filter((i) => i.symbol === 'fate').reduce((n, i) => n + i.count, 0),
        traits: printing.traits,
        quantity: c.quantity.value,
        name: localized(c.name),
        text: localized(c.text),
        identityStatus: 'confirmed',
        notes: [],
      };
    });
}
export function attachDeparture(pack, catalog, raw, frontInput, { roleScout = false } = {}) {
  const next = pack.manifest.failure.next;
  next.id = 2;
  next.source = 'example.assets:980';
  for (const d of pack.definitions)
    for (const s of d.states)
      for (const a of s.actions)
        if (a.op === 'nextAdventure') {
          a.id = 2;
          a.source = next.source;
        }
  pack.manifest.campSkills.failureFingerprint = hash(pack.manifest.failure);
  pack.manifest.campItems.failureFingerprint = hash(pack.manifest.failure);
  pack.manifest.campPreparation.itemsFingerprint = hash(pack.manifest.campItems);
  pack.manifest.campPreparation.skillsFingerprint = hash(pack.manifest.campSkills);
  const board = compileBattleMapSource(departureBoardSource()),
    purchases = pack.manifest.campSkills.roles.flatMap((r) => r.upgrades).map((o) => o.card),
    titles = titleDefinitions(raw),
    campaignSkills = [...purchases, ...titles];
  const initial = new Set(catalog.roles.map((r) => r.skills[0]));
  frontInput.policies = [
    ...frontInput.policies.filter((p) => !initial.has(p.id)),
    ...catalog.skills
      .filter((c) => initial.has(c.id))
      .map((c) => ({
        id: c.id,
        kind: 'skill',
        definitionHash: hash(c),
        source: { sourceId: 'invented-startup', locator: `invented:${c.id}` },
        effects: [
          { op: 'after-prepare-inspiration' },
          ...(roleScout ? [{ op: 'after-prepare-scout', count: 1 }] : []),
        ],
      })),
  ];
  const fronts = compilePhysicalFronts(raw, frontInput, catalog, campaignSkills);
  const cards = [
    ...catalog.skills.map((c, n) => ({
      id: c.id,
      kind: c.kind,
      ownerId: c.ownerId,
      number: c.number ?? n - 53,
      copies: Array.from({ length: c.quantity }, (_, i) => `${c.id}:${i + 1}`),
      identity: 'bound',
      definitionHash: hash(c),
      evidence: [{ sourceId: 'invented-book', locator: `invented:${c.id}` }],
    })),
    ...purchases.map((c) => ({
      id: c.id,
      kind: 'purchased',
      ownerId: c.ownerId,
      number: c.number,
      copies: [`${c.id}:1`],
      identity: 'bound',
      definitionHash: hash(c),
      evidence: [{ sourceId: 'invented-book', locator: `invented:${c.id}` }],
    })),
    ...titles.map((c, i) => ({
      id: c.id,
      kind: 'title',
      ownerId: null,
      number: i + 1,
      copies: [`${c.id}:1`],
      identity: 'bound',
      definitionHash: hash(c),
      evidence: [{ sourceId: 'invented-book', locator: `invented:${c.id}` }],
    })),
  ];
  const deployment = deploymentSource();
  deployment.assets.find((a) => a.source === deployment.adventure).source = next.source;
  deployment.adventure = next.source;
  deployment.files.push({ file: 'example.assets', sha256: hash('invented next model file') });
  deployment.texts.EXAMPLE_11 = 'Custode inventato';
  deployment.texts.EXAMPLES_11 = 'Custodi inventati';
  const ranged = deployment.assets.find((a) => a.source === 'fixture.assets:10').data;
  ranged.Traits = 1024;
  ranged.Costs = [
    { Num: 1, Cost: 10 },
    { Num: 2, Cost: 18 },
    { Num: 3, Cost: 26 },
  ];
  deployment.assets.find((a) => a.source === 'fixture.assets:11').data.Traits = 4;
  deployment.mechanics.normalBanners = Array.from({ length: 6 }, (_, n) => n + 1);
  deployment.mechanics.eliteBanners = Array.from({ length: 6 }, (_, n) => n + 7);
  deployment.assets.find((a) => a.cls === 'AdventureModel').data.GlobalEnemyFilter = {
    MustHaveAny: 0,
    MustHaveAll: 0,
    ExcludeIfAny: 0,
  };
  for (const a of deployment.assets) a.dataHash = hash(a.data);
  const instruction = (op, fields = {}, n = 0) => ({
    op,
    origin: { state: n + 1, action: 0, parameterHash: hash([op, fields]) },
    text: `Allestimento inventato · ${op}`,
    ...fields,
  });
  const instructions = [
    instruction('threshold', { perHero: 3, limitPerHero: 13 }),
    instruction('board'),
    instruction('heroes', { anchor: 'heroes' }),
    instruction('scout', { count: 3 }),
    instruction('loss-weakness', {
      enHash: hash('invented EN weakness'),
      itHash: hash('invented conflicting IT'),
      targets: 'one-owner-one-hero',
    }),
    instruction('terrain', { anchors: ['shrub-a', 'shrub-b'], kinds: ['bush', 'bush'] }),
    instruction('terrain', {
      anchors: ['divider-a', 'divider-b', 'divider-c'],
      kinds: ['wall', 'wall', 'wall'],
    }),
    instruction('terrain', { anchors: ['flame', 'stone'], kinds: ['fire', 'rock'] }),
    instruction('message', { text: 'Introduzione inventata prima dei nemici.' }),
    ...['ranged', 'middle', 'last'].map((anchor, n) =>
      instruction('spawn', {
        anchor,
        perHero: [4, 6, 5][n],
        filter: { MustHaveAny: n === 0 ? 1024 : 0, MustHaveAll: 0, ExcludeIfAny: 136 },
      }),
    ),
    instruction('marker', { anchor: 'danger', kind: 'threat', lore: 0 }),
    instruction('marker', { anchor: 'clue', kind: 'search', lore: 2 }),
    instruction('objective', {
      id: 0,
      text: 'Racconto inventato: difendete la torre mentre arrivano i nemici.',
      objectiveText: 'Difendete la torre inventata.',
    }),
    instruction('handoff'),
  ].map((i, n) => ({ ...i, origin: { ...i.origin, state: n + 1 } }));
  pack.manifest.campDeparture = {
    version: 'source-camp-departure-v1',
    catalogHash: hash(catalog),
    preparationHash: hash(pack.manifest.campPreparation),
    evidenceHash: hash('invented departure attestation'),
    ownedProductIds: [0],
    target: {
      id: 2,
      model: next.source,
      principal: 'example.assets:981',
      name: 'Battaglia2 · fonte e partita inventate',
    },
    board,
    boardFingerprint: board.artifactFingerprint,
    deckCatalog: {
      fingerprint: hash(catalog),
      heroIds: catalog.heroes.map((h) => h.id),
      roleIds: catalog.roles.map((r) => r.id),
      cards,
    },
    campaignSkills,
    fronts,
    frontsFingerprint: fronts.fingerprint,
    windows: [...catalog.skills, ...catalog.items, ...campaignSkills].map((c) => ({
      cardId: c.id,
      definitionHash: hash(c),
      policyHash: fronts.policies.some((p) => p.id === c.id)
        ? hash(fronts.policies.find((p) => p.id === c.id))
        : null,
      prepare: fronts.policies
        .find((p) => p.id === c.id)
        ?.effects.some((e) => e.op.startsWith('after-prepare-'))
        ? 'supported'
        : 'none',
      setup: fronts.policies
        .find((p) => p.id === c.id)
        ?.effects.some((e) => e.op.startsWith('after-setup-'))
        ? 'supported'
        : 'none',
    })),
    spawnPolicy: 'source-spawn-points-v1',
    deployment,
    deploymentHash: hash(compileSourceDeployment(deployment)),
    reserved: [],
    reservedEliteBanners: 0,
    instructions,
    quantities: { status: 'invented', values: [0, 0, 0] },
  };
  return pack.manifest.campDeparture;
}

export async function departureFixture() {
  const { preparationCompilation } = await import('./camp-preparation.mjs');
  const { campItemCatalog } = await import('./camp-items.mjs');
  const { diagnosticRaw, inventedFrontInput } = await import('./physical-fronts.mjs');
  const input = preparationCompilation(),
    catalog = campItemCatalog(),
    raw = diagnosticRaw(),
    fronts = inventedFrontInput(raw);
  const cap = attachDeparture(input.pack, catalog, raw, fronts);
  return { input, catalog, raw, fronts, cap };
}
export { hash };
