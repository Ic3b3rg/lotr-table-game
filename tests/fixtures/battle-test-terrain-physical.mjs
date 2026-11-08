// Finite invented physical fixtures; no random-order search or production source.
import { frontFixture, binding, evidence, hash } from './physical-fronts.mjs';
import { source } from './physical-resolution.mjs';
import { inventedLastStand } from './last-stand.mjs';
import { terrainPolicy } from './battle-test-terrain.mjs';
import {
  compilePhysicalFronts,
  compileLastStand,
  freezePhysical,
  openPhysical,
  answerPhysical,
  validatePhysical,
} from '../../dist/physical-resolution-library.mjs';
export function terrainPhysical({
  kind = 'fire',
  tokens = 1,
  success = 1,
  fate = 1,
  reveal = 3,
  inspiration = 2,
  otherCell = false,
} = {}) {
  const f = frontFixture();
  for (const c of f.catalog.skills) {
    c.success = success;
    c.fate = fate;
  }
  for (const h of f.catalog.heroes) h.stats.might = reveal;
  f.context.preparation.heroes[0].inspiration = inspiration;
  f.p = freezePhysical(
    f.raw,
    binding,
    f.heroes,
    '1'.repeat(64),
    undefined,
    { artifact: compilePhysicalFronts(f.raw, f.ir, f.catalog), catalog: f.catalog },
    compileLastStand(f.raw, inventedLastStand(f.raw)),
  );
  f.p.version = 3;
  f.spatial = {
    heroes: f.heroes,
    connections: [],
    testTerrain: {
      policy: terrainPolicy(),
      capabilityFingerprint: hash('invented authority'),
      boardFingerprint: hash('invented board'),
      tokens: Array.from({ length: tokens }, (_, n) => ({
        anchor: `invented-${kind}-${n}`,
        kind,
        spaceId: otherCell ? 'another-space' : f.heroes[0].spaceId,
      })),
    },
  };
  f.programFor = (children) => ({
    ...f.program(children),
    combat: {
      version: 'combat-windows-v1',
      roundId: '00000000-0000-4000-8000-000000000099',
      artifactFingerprint: hash('invented combat'),
      clauses: [],
      heroes: [],
    },
  });
  f.open = (children) => openPhysical(f.p, source, f.programFor(children), f.context, f.spatial);
  return f;
}
export const terrainSlots = [
  {
    id: 'one',
    copyId: 'invented-weapon:1',
    cost: 1,
    hits: 2,
    modifiers: [],
    label: '1 successo: 2 colpi',
  },
  {
    id: 'two',
    copyId: 'invented-weapon:1',
    cost: 2,
    hits: 3,
    modifiers: [],
    label: '2 successi: 3 colpi',
  },
];
export const attackChild = {
  kind: 'attack-test',
  hero: 0,
  stat: 'might',
  groupId: 'invented-group',
  slots: terrainSlots,
  replaceCopy: null,
};
export function enemyChild(id = 'enemy') {
  return {
    kind: 'enemy-attack',
    hero: 0,
    negate: 'might',
    addition: null,
    outcome: {
      attackId: id,
      groupId: 'invented-group',
      instructionId: 'fixture.assets:50',
      instructionHash: hash('instruction'),
      recipientHeroId: 'hero-1',
      cause: 'counterattack',
      rootSource: id,
      directSource: `${id}:base`,
      returnTo: 'invented-return',
      artifactFingerprint: hash('combat'),
      projectionFingerprint: hash('board'),
      figureIds: ['figure'],
      offered: { damage: 1, fear: 0 },
      negated: { damage: 0, fear: 0 },
      prevented: { damage: 0, fear: 0 },
      suffered: { damage: 0, fear: 0 },
      childSources: [],
      sealed: false,
    },
  };
}
export function physicalAnswer(f, answer) {
  const q = f.p.snapshot.active;
  answerPhysical(
    f.p,
    q.runId,
    typeof answer === 'string' ? { kind: 'physical-choice', option: answer } : answer,
    evidence(f.p.runs.at(-1).answers.length, q.actorPlayerId),
  );
}
export function settleSelection(f, copy) {
  const q = f.p.snapshot.active;
  if (q?.mode === 'select')
    physicalAnswer(f, {
      kind: 'physical-select',
      ids: [q.options.find((o) => !copy || o.id.includes(copy)).id],
    });
}
export function finishPhysical(f) {
  for (let n = 0; f.p.snapshot.active && n < 150; n++) {
    const q = f.p.snapshot.active;
    if (q.mode === 'choose')
      physicalAnswer(
        f,
        ['resolve', 'apply', 'close', 'keep', 'close-rest', 'reveal'].find((id) =>
          q.options.some((o) => o.id === id && !o.unavailable),
        ) ?? q.options.find((o) => !o.unavailable).id,
      );
    else if (q.mode === 'select')
      physicalAnswer(f, {
        kind: 'physical-select',
        ids: q.options.slice(0, q.minimum).map((o) => o.id),
      });
    else if (q.mode === 'allocate') {
      const successes = q.maximum;
      physicalAnswer(f, {
        kind: 'physical-allocate',
        ability: null,
        damage: Math.min(successes, q.remaining.damage),
        fear: Math.min(Math.max(0, successes - q.remaining.damage), q.remaining.fear),
      });
    } else
      physicalAnswer(f, {
        kind: 'physical-scout',
        prepare: null,
        discard: null,
        top: q.options.map((o) => o.id),
        bottom: [],
      });
  }
  if (f.p.snapshot.active) throw Error('Invented physical consumer did not finish');
  validatePhysical(JSON.parse(JSON.stringify(f.p)));
}
