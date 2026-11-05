import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  openPhysical,
  answerPhysical,
  validatePhysical,
} from '../dist/physical-resolution-library.mjs';
import { linkedRuntime, leaveFirst } from './linked-runtime-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { evidence } from './fixtures/physical-fronts.mjs';
export function acquireTitle(f, recipient = 0) {
  leaveFirst(f);
  f.commit(1, 1);
  f.finishPhysical();
  f.answer({ kind: 'choice', event: 'SOLVE' });
  f.finishPhysical();
  f.answer({ kind: 'ack' });
  f.commit(0, 2, 'DELIVER');
  f.finishPhysical();
  f.answer({ kind: 'ack' });
  f.answer({ kind: 'choose-hero', heroId: f.heroes[recipient].heroId });
  f.finishPhysical();
}
function open(f, children, combat) {
  const p = f.physical,
    context = structuredClone(p.snapshot.resolution.resources);
  return openPhysical(
    p,
    {
      effectId: randomUUID(),
      instanceId: 'invented-following-consumer',
      state: 1,
      entry: 1,
      action: 0,
      parameterHash: hash(children),
    },
    {
      profile: 'source-fronts-v1',
      initialCredits: f.heroes.map(() => 0),
      limits: f.heroes.map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
      darknessHeroes: [],
      children,
      ...(combat ? { combat } : {}),
    },
    context,
    { heroes: f.heroes, connections: [] },
    randomUUID(),
  );
}
function answer(f, option) {
  const p = f.physical,
    q = p.snapshot.active,
    n = p.runs.reduce((n, r) => n + r.answers.length, 0) + 100;
  answerPhysical(p, q.runId, { kind: 'physical-choice', option }, evidence(n, q.actorPlayerId));
}
test('a scenario title uses the existing attack modifier window, pays removal once and cannot be re-awarded or transferred', () => {
  const f = linkedRuntime();
  acquireTitle(f);
  const owned = f.physical.snapshot.lastStand.titles[0],
    grant = f.sc.pack.manifest.linked.title;
  const combat = {
    version: 'combat-windows-v1',
    roundId: f.state.round.id,
    artifactFingerprint: hash('invented-after-title-combat'),
    clauses: [],
    heroes: [],
  };
  const id = open(
    f,
    [
      {
        kind: 'attack-test',
        hero: 0,
        stat: 'might',
        groupId: 'invented-group',
        replaceCopy: null,
        slots: [
          {
            id: 'invented-slot',
            copyId: 'invented-weapon:1',
            cost: 1,
            hits: 1,
            modifiers: [],
            label: 'Slot inventato',
          },
        ],
      },
    ],
    combat,
  );
  answer(f, 'resolve');
  let q = f.physical.snapshot.active;
  assert.ok(
    q.options.some((o) => o.id.startsWith('title-modifier:')),
    'the genuine prepared title offers its own effect',
  );
  const offer = q.options.find((o) => o.id.endsWith(':sunder'));
  assert.ok(offer);
  answer(f, offer.id);
  q = f.physical.snapshot.active;
  assert.ok(!q.options.some((o) => o.id.startsWith('title-modifier:')));
  answer(f, 'apply');
  const parent = f.physical.snapshot.parents.find((p) => p.id === id);
  assert.deepEqual(parent.results[0].attack.modifiers, ['sunder']);
  assert.equal(f.physical.snapshot.lastStand.titles[0].removed, true);
  assert.ok(
    !f.physical.snapshot.resolution.resources.preparation.heroes[0].prepared.includes(owned.copy),
  );
  const before = structuredClone(f.physical.snapshot.lastStand.titles);
  open(f, [{ kind: 'scenario-title', hero: 1, grant }]);
  assert.equal(f.physical.snapshot.active.actorPlayerId, f.heroes[1].playerId);
  answer(f, 'ack');
  assert.deepEqual(f.physical.snapshot.lastStand.titles, before);
  assert.equal(f.physical.snapshot.lastStand.selections.length, 0);
  assert.doesNotThrow(() => validatePhysical(structuredClone(f.physical)));
});

test('a mismatched title card blocks the entire linked attempt before any cost', () => {
  const f = linkedRuntime();
  f.sc.pack.manifest.linked.title.cardHash = 'f'.repeat(64);
  const before = structuredClone(f.state);
  assert.throws(() => f.commit(), /titolo|carta|seguito/i);
  assert.deepEqual(f.state, before);
});
